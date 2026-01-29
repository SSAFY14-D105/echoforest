/**
 * LiveKit 서비스
 * 음성/화상 통신 연결 및 관리 (Hook 대신 클래스 기반)
 */

import {
    Room,
    RoomEvent,
    Track,
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    VideoPresets,
    createLocalTracks
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

    private onParticipantUpdate: ParticipantUpdateCallback | null = null;
    private onConnectedCallback: ConnectionCallback | null = null;
    private onDisconnectedCallback: ConnectionCallback | null = null;
    private onErrorCallback: ErrorCallback | null = null;

    // 콜백 설정 메서드들
    onParticipantsChange(callback: ParticipantUpdateCallback) {
        this.onParticipantUpdate = callback;
        return this;
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

    // 로컬 비디오 엘리먼트 설정
    setLocalVideoElement(element: HTMLVideoElement | null) {
        this.localVideoElement = element;
    }

    // 참가자 정보 수집
    private getParticipants(): ParticipantInfo[] {
        if (!this.room) return [];

        const participantInfos: ParticipantInfo[] = [];

        this.room.remoteParticipants.forEach((participant: RemoteParticipant) => {
            let videoTrack: RemoteTrack | null = null;
            let audioTrack: RemoteTrack | null = null;

            participant.trackPublications.forEach((pub: RemoteTrackPublication) => {
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

    // 참가자 업데이트 통지
    private notifyParticipantUpdate() {
        this.onParticipantUpdate?.(this.getParticipants());
    }

    // LiveKit Room 연결 (토큰 직접 입력 - 테스트용)
    async connectWithToken(_roomName: string, token: string, _username: string = 'Guest'): Promise<void> {
        this.disconnect();
        const myId = ++this.connectionOpId;
        console.log(`[LiveKitService] 수동 연결 시도 #${myId} - Token 제공됨`);

        try {
            // 2. Room 생성 및 연결 (공통 로직 Reuse 권장되지만, 중복 방지를 위해 여기도 구현)
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

            console.log('✅ LiveKit Room 연결 성공 (수동 토큰)');
            this.setupLocalTracks(myId);
            this.onConnectedCallback?.();
            this.notifyParticipantUpdate();

        } catch (err: any) {
            if (myId === this.connectionOpId) {
                console.error('LiveKit 수동 연결 실패:', err);
                this.onErrorCallback?.(err?.message || 'LiveKit 연결 실패');
                throw err;
            }
        }
    }

    // LiveKit Room 연결 (API 사용)
    private setupRoomEvents() {
        if (!this.room) return;

        this.room.on(RoomEvent.ParticipantConnected, () => {
            //console.log('📥 참가자 입장');
            this.notifyParticipantUpdate();
        });

        this.room.on(RoomEvent.ParticipantDisconnected, () => {
            //console.log('📤 참가자 퇴장');
            this.notifyParticipantUpdate();
        });

        this.room.on(RoomEvent.TrackSubscribed, (track) => {
            //console.log('🎥 트랙 구독:', track.kind, participant.identity);

            // 오디오 트랙은 자동으로 재생되도록 attach
            if (track.kind === Track.Kind.Audio) {
                const audioElement = track.attach();
                audioElement.play().catch(e => console.warn('오디오 자동재생 실패:', e));
            }

            this.notifyParticipantUpdate();
        });

        this.room.on(RoomEvent.TrackUnsubscribed, () => {
            this.notifyParticipantUpdate();
        });

        this.room.on(RoomEvent.Disconnected, () => {
            console.log('🔌 연결 종료');
            this.onDisconnectedCallback?.();
        });
    }

    private async setupLocalTracks(opId: number) {
        try {
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
            if (!this._cameraEnabledPreference && this.room?.localParticipant) {
                await this.room.localParticipant.setCameraEnabled(false);
            }
        } catch (publishErr) {
            console.warn('트랙 발행 중 오류 (연결 해제됨?):', publishErr);
        }
    }



    // LiveKit Room 연결 (API 사용)
    async connect(roomName: string, userId: string, username: string): Promise<void> {
        this.disconnect();
        const myId = ++this.connectionOpId;
        console.log(`[LiveKitService] 연결 시도 #${myId} - Room: ${roomName}, User: ${username}`);

        try {
            const { token } = await getLiveKitToken({ roomId: roomName, userId, username });

            if (myId !== this.connectionOpId) return;

            console.log('✅ LiveKit 토큰 발급 성공');

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

            console.log('✅ LiveKit Room 연결 성공');
            await this.setupLocalTracks(myId);
            this.onConnectedCallback?.();
            this.notifyParticipantUpdate();
        } catch (err: any) {
            if (myId === this.connectionOpId) {
                console.error('LiveKit 연결 실패:', err);
                this.onErrorCallback?.(err?.message || 'LiveKit 연결에 실패했습니다.');
                throw err;
            } else {
                console.log(`[LiveKitService] 이전 연결 시도 #${myId} 에러 무시됨`);
            }
        }
    }

    // 연결 종료
    disconnect() {
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
    get isCameraEnabled(): boolean {
        return this.room?.localParticipant.isCameraEnabled ?? false;
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
}

// 싱글턴 인스턴스
export const liveKitService = new LiveKitService();
