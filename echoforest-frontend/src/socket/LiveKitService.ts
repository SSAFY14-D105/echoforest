import {
    Room,
    RoomEvent,
    RemoteParticipant,
    RemoteTrackPublication,
    RemoteTrack,
    Track,
    createLocalTracks,
    DataPacket_Kind,
    DisconnectReason,
} from 'livekit-client';
import { LIVEKIT_SERVER_URL as API_LIVEKIT_SERVER_URL, getLiveKitToken } from '../apis/livekitApi';
import { LIVEKIT_URL as CONFIG_LIVEKIT_URL } from '../config';
import { useGameStore } from '../store/useGameStore';

// LiveKit 서버 URL (Docker 로컬 또는 배포 서버)
const LIVEKIT_URL = CONFIG_LIVEKIT_URL || API_LIVEKIT_SERVER_URL;

export interface ParticipantInfo {
    identity: string;
    isSpeaking: boolean;
    isMuted: boolean;
    isCameraEnabled: boolean;
    videoTrack: RemoteTrack | null;
    audioTrack: RemoteTrack | null;
}

type ParticipantUpdateCallback = (participants: ParticipantInfo[]) => void;
type ConnectionCallback = () => void;
type ErrorCallback = (error: string) => void;

export class LiveKitService {
    private room: Room | null = null;
    private localVideoElement: HTMLVideoElement | null = null;
    private connectionOpId = 0; // Async race condition 방지용 ID
    private _cameraEnabledPreference = true; // 사용자 카메라 ON/OFF 상태 저장

    private participantCallbacks: Set<ParticipantUpdateCallback> = new Set();
    // [FIX] Connection/Disconnection 콜백도 다중 구독 지원 (Set)
    private connectedCallbacks: Set<ConnectionCallback> = new Set();
    private disconnectedCallbacks: Set<ConnectionCallback> = new Set();
    private onErrorCallback: ErrorCallback | null = null;
    // [FIX] DataReceived 콜백도 다중 구독 지원 (Set)
    private dataReceivedCallbacks: Set<(payload: Uint8Array, participant: RemoteParticipant | undefined, kind: DataPacket_Kind) => void> = new Set();

    // [NEW] 재접속을 위한 상태 저장
    private lastRoomId: string | null = null;
    private lastUsername: string | null = null;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;

    // 콜백 설정 메서드들 (구독 패턴 - 여러 컴포넌트가 동시에 구독 가능)
    onParticipantsChange(callback: ParticipantUpdateCallback): () => void {
        this.participantCallbacks.add(callback);

        // [FIX] 구독 즉시 현재 참가자 상태 전달 (이미 연결된 경우 대비)
        if (this.room) {
            try {
                callback(this.getParticipants());
            } catch (error) {
                // console.warn('[LiveKitService] Initial participant callback failed:', error);
            }
        }

        // 언마운트 시 콜백 제거를 위한 unsubscribe 함수 반환
        return () => {
            this.participantCallbacks.delete(callback);
        };
    }

    onConnected(callback: ConnectionCallback): () => void {
        this.connectedCallbacks.add(callback);
        if (this.isConnected) {
            callback();
        }
        return () => {
            this.connectedCallbacks.delete(callback);
        };
    }

    onDisconnected(callback: ConnectionCallback): () => void {
        this.disconnectedCallbacks.add(callback);
        return () => {
            this.disconnectedCallbacks.delete(callback);
        };
    }

    onError(callback: ErrorCallback) {
        this.onErrorCallback = callback;
        return this;
    }

    // [FIX] DataReceived 구독 패턴으로 변경 및 unsubscribe 반환
    onDataReceived(callback: (payload: Uint8Array, participant: RemoteParticipant | undefined, kind: DataPacket_Kind) => void): () => void {
        this.dataReceivedCallbacks.add(callback);
        return () => {
            this.dataReceivedCallbacks.delete(callback);
        };
    }

    // [FIX] 로컬 트랙 발행 이벤트 콜백
    private localTrackPublishedCallbacks: Set<() => void> = new Set();

    onLocalTrackPublished(callback: () => void): () => void {
        this.localTrackPublishedCallbacks.add(callback);
        // 이미 트랙이 준비되어 있으면 즉시 실행
        if (this.isLocalTrackReady) {
            callback();
        }
        return () => {
            this.localTrackPublishedCallbacks.delete(callback);
        };
    }

    private notifyLocalTrackPublished() {
        this.localTrackPublishedCallbacks.forEach(callback => callback());
    }

    // 데이터 전송 (DataChannel)
    async sendData(data: string | Uint8Array, reliable: boolean = true) {
        if (!this.room || !this.room.localParticipant) {
            // console.warn('[LiveKitService] Cannot send data: not connected');
            return;
        }
        const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        await this.room.localParticipant.publishData(payload, { reliable });
    }

    // 로컬 비디오 엘리먼트 설정 (새 엘리먼트가 설정되면 기존 트랙 자동 연결)
    setLocalVideoElement(element: HTMLVideoElement | null) {
        // [FIX] 동일한 엘리먼트가 이미 설정되어 있으면 무시 (flickering 방지)
        if (element && element === this.localVideoElement) {
            // 트랙이 아직 연결 안 되어 있으면 연결 시도
            if (this.room?.localParticipant) {
                const cameraPublication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
                if (cameraPublication?.track && !element.srcObject) {
                    cameraPublication.track.attach(element);
                }
            }
            return;
        }

        // [FIX] 기존 엘리먼트가 있다면 트랙에서 분리 (누수 방지)
        if (this.localVideoElement && this.localVideoElement !== element) {
            if (this.room?.localParticipant) {
                const cameraPublication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
                if (cameraPublication?.track) {
                    cameraPublication.track.detach(this.localVideoElement);
                }
            }
        }

        this.localVideoElement = element;

        // [FIX] 트랙이 있으면 바로 연결, 없으면 대기 (notifyLocalTrackPublished에서 처리됨)
        if (element && this.room?.localParticipant) {
            const cameraPublication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);

            if (cameraPublication?.track) {
                cameraPublication.track.attach(element);
                // console.log('[LiveKitService] Local video attached successfully');
            } else {
                // console.log('[LiveKitService] Video element set, waiting for track...');
            }
        }
    }

    // [NEW] 로컬 오디오 트랙 준비 완료 여부 (STT 충돌 방지용)
    // STT와 충돌하는 것은 마이크(오디오)이므로 오디오 트랙 확인
    get isLocalTrackReady(): boolean {
        if (!this.room?.localParticipant) return false;
        const micPublication = this.room.localParticipant.getTrackPublication(Track.Source.Microphone);
        return !!micPublication?.track;
    }

    // 참가자 정보 수집
    private getParticipants(): ParticipantInfo[] {
        if (!this.room) return [];

        const participantInfos: ParticipantInfo[] = [];

        this.room.remoteParticipants.forEach((participant: RemoteParticipant) => {
            let videoTrack: RemoteTrack | null = null;
            let audioTrack: RemoteTrack | null = null;

            participant.trackPublications.forEach((pub: RemoteTrackPublication) => {

                // [FIX] isSubscribed 체크 제거 - 트랙 객체가 존재하면 사용 (구독 상태와 무관하게 표시 시도)
                if (pub.track) {
                    if (pub.track.kind === Track.Kind.Video) {
                        videoTrack = pub.track;
                    } else if (pub.track.kind === Track.Kind.Audio) {
                        audioTrack = pub.track;
                    }
                }
            });

            participantInfos.push({
                identity: participant.identity,
                isSpeaking: participant.isSpeaking,
                isMuted: !participant.isMicrophoneEnabled,
                isCameraEnabled: participant.isCameraEnabled,
                videoTrack,
                audioTrack
            });
        });

        return participantInfos;
    }

    // [FIX] Debounce timer for participant updates (prevents flickering)
    private updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly UPDATE_DEBOUNCE_MS = 150; // 150ms debounce
    private lastParticipantInfos: ParticipantInfo[] = [];

    // 참가자 업데이트 통지 (모든 구독자에게 알림)
    private notifyParticipantUpdate() {
        if (!this.room) return;

        // [FIX] Debounce rapid updates to prevent flickering
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
        }

        this.updateDebounceTimer = setTimeout(() => {
            if (!this.room) return;

            const currentInfos = this.getParticipants();

            // [FIX] 중복 업데이트 방지 (Change Detection)
            if (this.areParticipantInfosEqual(this.lastParticipantInfos, currentInfos)) {
                return;
            }

            this.lastParticipantInfos = currentInfos;
            this.participantCallbacks.forEach(callback => callback(currentInfos));
        }, this.UPDATE_DEBOUNCE_MS);
    }

    // 변경 감지 (Deep Compare for ParticipantInfo)
    private areParticipantInfosEqual(prev: ParticipantInfo[], curr: ParticipantInfo[]): boolean {
        if (prev.length !== curr.length) return false;

        for (let i = 0; i < prev.length; i++) {
            const p1 = prev[i];
            const p2 = curr[i];

            if (p1.identity !== p2.identity) return false;
            // if (p1.isSpeaking !== p2.isSpeaking) return false; // Speaking은 너무 자주 변하므로 생략 가능 (필요 시 포함)
            if (p1.isMuted !== p2.isMuted) return false;
            if (p1.isCameraEnabled !== p2.isCameraEnabled) return false;
            if (p1.videoTrack !== p2.videoTrack) return false; // Track Reference Check
            if (p1.audioTrack !== p2.audioTrack) return false;
        }
        return true;
    }

    /*
    private startSyncInterval() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        // 1초마다 상태 동기화 (이벤트 누락 방지 및 상태 수렴용)
        this.syncInterval = setInterval(() => {
            if (this.room && this.room.state === 'connected') {
                this.notifyParticipantUpdate();
            }
        }, 1000);
    }

    private stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    */


    // LiveKit Room 연결 (토큰 직접 입력 - 테스트용)
    async connectWithToken(_roomName: string, token: string, _username: string = 'Guest'): Promise<void> {
        this.disconnect(false); // [FIX] 재접속 정보 유지
        const myId = ++this.connectionOpId;
        // console.log(`[LiveKitService] 연결 시도 #${myId} - Room: ${_roomName}, User: ${_username}`);

        try {
            // 2. Room 생성 및 연결
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: { width: 960, height: 540, frameRate: 30 },
                }
            });

            this.setupRoomEvents();

            await this.room.connect(LIVEKIT_URL, token);

            if (myId !== this.connectionOpId) {
                this.room.disconnect();
                this.room = null;
                return;
            }

            // console.log('✅ LiveKit 연결 성공 (OpId:', myId, ')');

            // [FIX] 트랙 설정 대기 (최대 5초)
            try {
                await this.setupLocalTracks(myId);
                // 트랙 설정 완료 후 이벤트 발생
                this.notifyLocalTrackPublished();
            } catch (trackError) {
                // console.warn('[LiveKitService] Setup local tracks failed but connected:', trackError);
            }

            this.connectedCallbacks.forEach(cb => cb());
            // this.startSyncInterval(); // [FIX] 폴링 제거 - 이벤트 기반으로 변경
            this.notifyParticipantUpdate();

        } catch (err: any) {
            if (myId === this.connectionOpId) {
                console.error('LiveKit 연결 실패:', err);
                this.onErrorCallback?.(err?.message || 'LiveKit 연결 실패');
                throw err;
            }
        }
    }

    // [FIX] Audio Element 관리를 위한 Map (Identity -> AudioElements[])
    private audioElements: Map<string, HTMLMediaElement[]> = new Map();

    // [NEW] 참가자 볼륨 조절
    setParticipantVolume(identity: string, volume: number) {
        // volume: 0 ~ 100
        const normalizedVolume = Math.max(0, Math.min(1, volume / 100));
        const elements = this.audioElements.get(identity);

        if (elements) {
            elements.forEach(el => {
                el.volume = normalizedVolume;
            });
            // console.log(`[LiveKitService] Set volume for ${identity}: ${volume}%`);
        }
    }

    // LiveKit Room 연결 (API 사용)
    private setupRoomEvents() {
        if (!this.room) return;

        this.room.on(RoomEvent.ParticipantConnected, () => {
            // console.log('📥 참가자 입장:', this.room?.remoteParticipants.size);
            this.notifyParticipantUpdate();
        });

        this.room.on(RoomEvent.ParticipantDisconnected, () => {
            // console.log('📤 참가자 퇴장');
            this.notifyParticipantUpdate();
        });

        // [FIX] Reconnection Handling to prevent Negotiation Errors
        this.room.on(RoomEvent.Reconnecting, () => {
            // console.log('[LiveKitService] Reconnecting...');
            // Wait for reconnection before attempting updates
        });

        this.room.on(RoomEvent.Reconnected, () => {
            // console.log('[LiveKitService] Reconnected!');
            this.notifyParticipantUpdate();
            // Re-verify local tracks if needed
            if (this.isLocalTrackReady) {
                this.notifyLocalTrackPublished();
            }
        });

        this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
            // console.log('🎥 트랙 구독:', track.kind, participant.identity);

            // 오디오 트랙은 자동으로 재생되도록 attach
            if (track.kind === Track.Kind.Audio) {
                try {
                    const audioElement = track.attach();

                    // [FIX] 요소 추적 (Identity 기반)
                    // this.createdAudioElements.add(audioElement); 
                    const identity = participant.identity;
                    const elements = this.audioElements.get(identity) || [];
                    elements.push(audioElement);
                    this.audioElements.set(identity, elements);

                    // [NEW] 초기 볼륨 적용
                    const store = useGameStore.getState();
                    const player = store.players.find(p => p.nickname === identity);
                    if (player && player.colorIndex !== undefined && player.colorIndex >= 0) {
                        const initialVol = store.playerVolumes[player.colorIndex] ?? 70;
                        audioElement.volume = initialVol / 100;
                        // console.log(`[LiveKitService] Applied initial volume for ${identity}: ${initialVol}%`);
                    }

                    audioElement.play().catch(() => {
                        // console.warn('오디오 자동재생 실패:', e);
                        // [NEW] 사용자에게 알림 (toast 등은 여기서 직접 못하므로 로그만)
                    });
                } catch (e) {
                    // console.warn('[LiveKitService] Audio attach error:', e);
                }
            }

            // [FIX] 약간의 지연 후 업데이트 (내부 상태 반영 대기)
            setTimeout(() => {
                this.notifyParticipantUpdate();
            }, 100);
        });

        this.room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
            // [FIX] 오디오 트랙 구독 해제 시 detach하여 WebMediaPlayer 해제
            if (track.kind === Track.Kind.Audio) {
                try {
                    // Safe detach: check if track is valid
                    const detachedElements = track.detach();
                    detachedElements.forEach(el => {
                        el.remove();
                        // [FIX] 추적 제거
                        const identity = participant.identity;
                        const elements = this.audioElements.get(identity);
                        if (elements) {
                            const newElements = elements.filter(e => e !== el);
                            if (newElements.length > 0) {
                                this.audioElements.set(identity, newElements);
                            } else {
                                this.audioElements.delete(identity);
                            }
                        }
                    });
                } catch (e) {
                    // Ignore 'failed to remove track' warnings if already removed
                    // console.warn('[LiveKitService] Audio detach warning:', e);
                }
            }
            this.notifyParticipantUpdate();
        });

        // [FIX] 트랙 Mute/Unmute 이벤트 추가 (상대방 카메라 ON/OFF 시 UI 업데이트)
        this.room.on(RoomEvent.TrackMuted, () => {
            this.notifyParticipantUpdate();
        });

        this.room.on(RoomEvent.TrackUnmuted, () => {
            this.notifyParticipantUpdate();
        });

        // [FIX] 트랙 발행 이벤트 추가 (새 트랙이 publish되면 UI 업데이트)
        this.room.on(RoomEvent.TrackPublished, () => {
            this.notifyParticipantUpdate();
        });

        // [FIX] 트랙 구독 상태 변경 이벤트 (구독 완료 시 UI 업데이트)
        this.room.on(RoomEvent.TrackSubscriptionStatusChanged, () => {
            this.notifyParticipantUpdate();
        });

        // [NEW] 로컬 트랙 발행됨 이벤트
        this.room.on(RoomEvent.LocalTrackPublished, () => {
            // console.log('[LiveKitService] Local track published!');

            // 만약 대기중인 비디오 엘리먼트가 있으면 연결
            if (this.localVideoElement) {
                this.setLocalVideoElement(this.localVideoElement);
            }

            this.notifyLocalTrackPublished();
            this.notifyParticipantUpdate();
        });

        this.room.on(RoomEvent.Disconnected, (reason) => {
            // console.log('🔌 연결 종료', reason);
            this.cleanupAudioElements(); // [FIX] 연결 종료 시 모든 오디오 정리
            this.lastParticipantInfos = []; // [FIX] 이전 참가자 정보 초기화 (재접속 시 갱신 보장)
            this.disconnectedCallbacks.forEach(cb => cb());

            // [NEW] 자동 재접속 로직 (비정상 종료 시)
            // if (reason !== DisconnectReason.CLIENT_INITIATED) { ... }
            // LiveKit Client SDK가 자체적으로 Reconnecting/Reconnected 이벤트를 처리하므로,
            // 여기서 Disconnected는 '완전히 끊김'을 의미합니다.
            // 필요한 경우 여기서 재접속 시도 로직을 트리거할 수 있습니다.
            if (reason && reason !== DisconnectReason.CLIENT_INITIATED && reason !== DisconnectReason.DUPLICATE_IDENTITY) {
                this.attemptReconnect();
            }
        });

        this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, kind?: DataPacket_Kind) => {
            // console.log(`[LiveKitService] Data received from ${participant?.identity}: ${new TextDecoder().decode(payload)}`);
            this.dataReceivedCallbacks.forEach(callback => {
                try {
                    callback(payload, participant, kind || DataPacket_Kind.RELIABLE);
                } catch (e) {
                    console.error('[LiveKitService] DataReceived callback error:', e);
                }
            });
        });
    }

    // [FIX] 생성된 모든 오디오 엘리먼트 정리
    private cleanupAudioElements() {
        this.audioElements.forEach(elements => {
            elements.forEach(el => el.remove());
        });
        this.audioElements.clear();
    }

    private async setupLocalTracks(opId: number) {

        try {
            // [FIX] 기존 트랙 정리 (재연결 시 중복 발행 방지)
            if (this.room?.localParticipant) {
                const existingTracks = Array.from(this.room.localParticipant.trackPublications.values());
                for (const pub of existingTracks) {
                    if (pub.track) {
                        try {
                            pub.track.stop(); // 미디어 스트림 정지
                            // await this.room.localParticipant.unpublishTrack(pub.track);
                            // unpublishTrack는 오래 걸릴 수 있으므로 track.stop()만으로도 충분할 수 있음
                        } catch (e) {
                            // console.warn('Track stop failed:', e);
                        }
                    }
                }
            }

            // LiveKit 음성 채팅 활성화
            // React Strict Mode 제거 후 STT와 공존 가능한지 테스트
            const tracks = await createLocalTracks({
                audio: true,
                video: true
            });


            if (opId !== this.connectionOpId || !this.room) {

                tracks.forEach(t => t.stop());
                return;
            }

            for (const track of tracks) {

                if (this.room && this.room.state === 'connected') {
                    await this.room.localParticipant.publishTrack(track);


                    // 로컬 비디오 표시
                    if (track.kind === Track.Kind.Video && this.localVideoElement) {
                        track.attach(this.localVideoElement);

                    }
                }
            }

            // 저장된 카메라 상태 적용 (대기실에서 꺼둔 경우 유지)
            // _cameraEnabledPreference가 false인 경우에만 끔 (default: true)
            if (this.room?.localParticipant) {
                if (!this._cameraEnabledPreference) {
                    await this.room.localParticipant.setCameraEnabled(false);
                } else {
                    // 확실하게 켜짐 상태 동기화
                    if (!this.room.localParticipant.isCameraEnabled) {
                        await this.room.localParticipant.setCameraEnabled(true);
                    }
                }
            }
        } catch (publishErr) {
            // console.warn('트랙 발행 중 오류 (연결 해제됨?):', publishErr);
        }
    }



    // LiveKit Room 연결 (API 사용)
    async connect(roomName: string, username: string): Promise<void> {
        // [NEW] 재접속 정보 저장
        this.lastRoomId = roomName;
        this.lastUsername = username;
        this.reconnectAttempts = 0;

        // 내부적으로 connectWithToken과 동일한 흐름을 타도록 토큰만 발급하고 위임
        try {
            const { token } = await getLiveKitToken({ roomId: roomName, username });
            await this.connectWithToken(roomName, token, username);
        } catch (err: any) {
            console.error('LiveKit Token Fetch Failed:', err);
            this.onErrorCallback?.(err?.message || 'LiveKit 토큰 발급 실패');
            throw err;
        }
    }

    // [NEW] 재접속 시도 로직
    private async attemptReconnect() {
        if (!this.lastRoomId || !this.lastUsername) return;
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            // console.warn('[LiveKitService] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff
        // console.log(`[LiveKitService] Attempting reconnect #${this.reconnectAttempts} in ${delay}ms...`);

        setTimeout(async () => {
            if (this.lastRoomId && this.lastUsername) {
                try {
                    await this.connect(this.lastRoomId, this.lastUsername);
                } catch (e) {
                    // console.warn('[LiveKitService] Reconnect failed:', e);
                    // 재귀적으로 다시 시도하고 싶다면 여기서 호출 (하지 않으면 다음 시도는 없음)
                    // 현재 로직상 connect 내부 오류는 throw되므로, 여기서 잡아서 다시 시도 가능
                    this.attemptReconnect();
                }
            }
        }, delay);
    }

    // 레거시 호환성을 위해 파라미터 기본값 설정
    disconnect(clearReconnectionInfo: boolean = true) {
        // [FIX] 명시적 종료 시에만 재접속 정보 초기화 (connect 내부 호출 시에는 유지)
        if (clearReconnectionInfo) {
            this.lastRoomId = null;
            this.lastUsername = null;
            this.reconnectAttempts = 0;
        }

        // this.stopSyncInterval(); // [FIX] 폴링 제거
        this.connectionOpId++; // 진행 중인 연결 시도 모두 무효화
        if (this.room) {
            // console.log('[LiveKitService] 연결 종료');
            this.room.disconnect();
            this.room = null;
        }
    }

    // 마이크 토글
    async toggleMic(): Promise<boolean> {
        if (!this.room || !this.room.localParticipant) return false;
        const newState = !this.room.localParticipant.isMicrophoneEnabled;
        await this.room.localParticipant.setMicrophoneEnabled(newState);
        return newState;
    }

    // 카메라 토글
    async toggleCamera(): Promise<boolean> {
        if (!this.room || !this.room.localParticipant) return this._cameraEnabledPreference;
        const newState = !this.room.localParticipant.isCameraEnabled;
        await this.room.localParticipant.setCameraEnabled(newState);
        this._cameraEnabledPreference = newState; // 상태 저장
        return newState;
    }

    // 마이크 상태
    get isMicEnabled(): boolean {
        return this.room?.localParticipant.isMicrophoneEnabled ?? false;
    }

    // 카메라 상태
    // [FIX] 트랙이 아직 발행되지 않은 경우 사용자 preference 반환
    get isCameraEnabled(): boolean {
        // 트랙이 발행되지 않았으면 preference 반환 (default: true)
        if (!this.isLocalTrackReady) {
            return this._cameraEnabledPreference;
        }
        return this.room?.localParticipant.isCameraEnabled ?? this._cameraEnabledPreference;
    }

    // 연결 상태
    get isConnected(): boolean {
        return this.room?.state === 'connected';
    }

    // 참가자 비디오 연결
    attachParticipantVideo(participantId: string, videoElement: HTMLVideoElement) {
        const participants = this.getParticipants();
        const participant = participants.find(p => p.identity === participantId);
        if (participant?.videoTrack) {
            participant.videoTrack.attach(videoElement);
        }
    }

    // 비디오 해상도 변경 (엔딩 미션용)
    async setVideoResolution(preset: 'h360' | 'h540' | 'h720'): Promise<void> {
        if (!this.room || !this.room.localParticipant) {
            // console.warn('[LiveKitService] Cannot change resolution: not connected');
            return;
        }

        let resolution = { width: 640, height: 360, frameRate: 30 }; // Default h360

        if (preset === 'h720') {
            resolution = { width: 1280, height: 720, frameRate: 30 };
        } else if (preset === 'h540') {
            resolution = { width: 960, height: 540, frameRate: 30 };
        } // else h360

        try {
            // 현재 카메라 트랙 찾기
            const cameraPublication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);

            if (cameraPublication?.track) {
                // 트랙의 미디어 스트림 제약 조건 업데이트
                const mediaStreamTrack = cameraPublication.track.mediaStreamTrack;
                if (mediaStreamTrack) {
                    await mediaStreamTrack.applyConstraints({
                        width: { ideal: resolution.width },
                        height: { ideal: resolution.height }
                    });
                    // console.log(`[LiveKitService] Video resolution changed to ${preset}`);
                }
            }
        } catch (error) {
            console.error('[LiveKitService] Failed to change video resolution:', error);
        }
    }

    // 카메라 강제 켜기 (엔딩 미션용)
    async forceCameraOn(): Promise<boolean> {
        if (!this.room || !this.room.localParticipant) {
            // console.warn('[LiveKitService] Cannot force camera on: not connected');
            return false;
        }

        try {
            // 카메라가 꺼져있으면 강제로 켜기
            if (!this.room.localParticipant.isCameraEnabled) {
                await this.room.localParticipant.setCameraEnabled(true);
                // console.log('[LiveKitService] Camera forced on for ending mission');
            }
            return true;
        } catch (error) {
            console.error('[LiveKitService] Failed to force camera on:', error);
            return false;
        }
    }

    // 카메라 상태 복원 (엔딩 미션 종료 시)
    async restoreCameraState(): Promise<void> {
        if (!this.room || !this.room.localParticipant) return;

        // 원래 사용자 설정대로 복원
        if (!this._cameraEnabledPreference) {
            await this.room.localParticipant.setCameraEnabled(false);
            // console.log('[LiveKitService] Camera restored to user preference (off)');
        }
    }

    /**
     * 로컬 비디오 트랙을 HTML video 엘리먼트에 연결 (Legacy)
     * @param videoElement 연결할 video 엘리먼트
     * @returns 성공 여부
     */
    attachLocalVideo(videoElement: HTMLVideoElement): boolean {
        this.setLocalVideoElement(videoElement);
        return true;
    }

    /**
     * 로컬 비디오 트랙을 HTML video 엘리먼트에서 분리
     * @param videoElement 분리할 video 엘리먼트
     */
    detachLocalVideo(videoElement: HTMLVideoElement): void {
        if (!this.room || !this.room.localParticipant) return;

        const cameraPublication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraPublication?.track) {
            cameraPublication.track.detach(videoElement);
            // console.log('[LiveKitService] Local video detached');
        }
    }
}

// 싱글턴 인스턴스
export const liveKitService = new LiveKitService();
