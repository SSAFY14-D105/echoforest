
import {
    Room,
    RoomEvent,
    Track,
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    VideoPresets,
    createLocalTracks,
    DataPacket_Kind
} from 'livekit-client';
import { LIVEKIT_SERVER_URL as API_LIVEKIT_SERVER_URL, getLiveKitToken } from '../apis/livekitApi';
import { LIVEKIT_URL as CONFIG_LIVEKIT_URL } from '../config';

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
    private onConnectedCallback: ConnectionCallback | null = null;
    private onDisconnectedCallback: ConnectionCallback | null = null;
    private onErrorCallback: ErrorCallback | null = null;
    // [FIX] DataReceived 콜백도 다중 구독 지원 (Set)
    private dataReceivedCallbacks: Set<(payload: Uint8Array, participant: RemoteParticipant | undefined, kind: DataPacket_Kind) => void> = new Set();

    // 콜백 설정 메서드들 (구독 패턴 - 여러 컴포넌트가 동시에 구독 가능)
    onParticipantsChange(callback: ParticipantUpdateCallback): () => void {
        this.participantCallbacks.add(callback);

        // [FIX] 구독 즉시 현재 참가자 상태 전달 (이미 연결된 경우 대비)
        if (this.room) {
            try {
                callback(this.getParticipants());
            } catch (error) {
                console.warn('[LiveKitService] Initial participant callback failed:', error);
            }
        }

        // 언마운트 시 콜백 제거를 위한 unsubscribe 함수 반환
        return () => {
            this.participantCallbacks.delete(callback);
        };
    }

    onConnected(callback: ConnectionCallback) {
        this.onConnectedCallback = callback;
        return this;
    }

    onDisconnected(callback: ConnectionCallback) {
        this.onDisconnectedCallback = callback;
        return this;
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
            console.warn('[LiveKitService] Cannot send data: not connected');
            return;
        }
        const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        await this.room.localParticipant.publishData(payload, { reliable });
    }

    // 로컬 비디오 엘리먼트 설정 (새 엘리먼트가 설정되면 기존 트랙 자동 연결)
    setLocalVideoElement(element: HTMLVideoElement | null) {
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

    // NodeJS.Timeout 대신 ReturnType<typeof setInterval> 사용 (환경 호환성)
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private lastParticipantInfos: ParticipantInfo[] = [];

    // 참가자 업데이트 통지 (모든 구독자에게 알림)
    private notifyParticipantUpdate() {
        if (!this.room) return;
        const currentInfos = this.getParticipants();

        // [FIX] 중복 업데이트 방지 (Change Detection)
        // 1초 폴링이 돌아도 실제 데이터가 변하지 않았으면 리렌더링 유발 안 함
        if (this.areParticipantInfosEqual(this.lastParticipantInfos, currentInfos)) {
            return;
        }

        this.lastParticipantInfos = currentInfos;
        this.participantCallbacks.forEach(callback => callback(currentInfos));
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

    // LiveKit Room 연결 (토큰 직접 입력 - 테스트용)
    async connectWithToken(_roomName: string, token: string, _username: string = 'Guest'): Promise<void> {
        this.disconnect();
        const myId = ++this.connectionOpId;
        console.log(`[LiveKitService] 연결 시도 #${myId} - Room: ${_roomName}, User: ${_username}`);

        try {
            // 2. Room 생성 및 연결
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: VideoPresets.h540.resolution,
                }
            });

            this.setupRoomEvents();

            await this.room.connect(LIVEKIT_URL, token);

            if (myId !== this.connectionOpId) {
                this.room.disconnect();
                this.room = null;
                return;
            }

            console.log('✅ LiveKit 연결 성공 (OpId:', myId, ')');

            // [FIX] 트랙 설정 대기 (최대 5초)
            try {
                await this.setupLocalTracks(myId);
                // 트랙 설정 완료 후 이벤트 발생
                this.notifyLocalTrackPublished();
            } catch (trackError) {
                console.warn('[LiveKitService] Setup local tracks failed but connected:', trackError);
            }

            this.onConnectedCallback?.();
            this.startSyncInterval(); // [FIX] 폴링 시작
            this.notifyParticipantUpdate();

        } catch (err: any) {
            if (myId === this.connectionOpId) {
                console.error('LiveKit 연결 실패:', err);
                this.onErrorCallback?.(err?.message || 'LiveKit 연결 실패');
                throw err;
            }
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
            console.log('[LiveKitService] Reconnecting...');
            // Wait for reconnection before attempting updates
        });

        this.room.on(RoomEvent.Reconnected, () => {
            console.log('[LiveKitService] Reconnected!');
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
                    audioElement.play().catch(e => console.warn('오디오 자동재생 실패:', e));
                } catch (e) {
                    console.warn('[LiveKitService] Audio attach error:', e);
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
                    track.detach().forEach(el => el.remove());
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

        this.room.on(RoomEvent.Disconnected, () => {
            // console.log('🔌 연결 종료');
            this.onDisconnectedCallback?.();
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

    private async setupLocalTracks(opId: number) {

        try {
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
            console.warn('트랙 발행 중 오류 (연결 해제됨?):', publishErr);
        }
    }



    // LiveKit Room 연결 (API 사용)
    async connect(roomName: string, username: string): Promise<void> {
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

    // 연결 종료
    disconnect() {
        this.stopSyncInterval(); // [FIX] 폴링 중지
        this.connectionOpId++; // 진행 중인 연결 시도 모두 무효화
        if (this.room) {
            console.log('[LiveKitService] 연결 종료');
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
    async setVideoResolution(preset: 'h540' | 'h720'): Promise<void> {
        if (!this.room || !this.room.localParticipant) {
            console.warn('[LiveKitService] Cannot change resolution: not connected');
            return;
        }

        const resolution = preset === 'h720'
            ? VideoPresets.h720.resolution
            : VideoPresets.h540.resolution;

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
            console.warn('[LiveKitService] Cannot force camera on: not connected');
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
