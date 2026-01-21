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
import { getLiveKitToken } from '../apis/livekitApi';

// LiveKit 서버 URL (Docker 로컬 또는 배포 서버)
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://i14d105.p.ssafy.io:7880';

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

    // LiveKit Room 연결
    async connect(roomName: string, userId: string, username: string): Promise<void> {
        try {
            // 1. 백엔드에서 토큰 발급
            const { token } = await getLiveKitToken({ roomName, userId, username });
            console.log('✅ LiveKit 토큰 발급 성공');

            // 2. Room 생성 및 연결
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: VideoPresets.h720.resolution,
                }
            });

            // 3. 이벤트 리스너 설정
            this.room.on(RoomEvent.ParticipantConnected, () => {
                console.log('📥 참가자 입장');
                this.notifyParticipantUpdate();
            });

            this.room.on(RoomEvent.ParticipantDisconnected, () => {
                console.log('📤 참가자 퇴장');
                this.notifyParticipantUpdate();
            });

            this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
                console.log('🎥 트랙 구독:', track.kind, participant.identity);
                this.notifyParticipantUpdate();
            });

            this.room.on(RoomEvent.TrackUnsubscribed, () => {
                this.notifyParticipantUpdate();
            });

            this.room.on(RoomEvent.Disconnected, () => {
                console.log('🔌 연결 종료');
                this.onDisconnectedCallback?.();
            });

            // 4. 연결
            await this.room.connect(LIVEKIT_URL, token);
            console.log('✅ LiveKit Room 연결 성공');

            // 5. 로컬 트랙 생성 및 발행
            const tracks = await createLocalTracks({
                audio: true,
                video: true
            });

            for (const track of tracks) {
                await this.room.localParticipant.publishTrack(track);

                // 로컬 비디오 표시
                if (track.kind === Track.Kind.Video && this.localVideoElement) {
                    track.attach(this.localVideoElement);
                }
            }

            this.onConnectedCallback?.();
            this.notifyParticipantUpdate();

        } catch (err: any) {
            console.error('LiveKit 연결 실패:', err);
            this.onErrorCallback?.(err?.message || 'LiveKit 연결에 실패했습니다.');
            throw err;
        }
    }

    // 연결 종료
    disconnect() {
        if (this.room) {
            this.room.disconnect();
            this.room = null;
        }
    }

    // 마이크 토글
    async toggleMic(): Promise<boolean> {
        if (!this.room) return false;
        const newState = !this.room.localParticipant.isMicrophoneEnabled;
        await this.room.localParticipant.setMicrophoneEnabled(newState);
        return newState;
    }

    // 카메라 토글
    async toggleCamera(): Promise<boolean> {
        if (!this.room) return false;
        const newState = !this.room.localParticipant.isCameraEnabled;
        await this.room.localParticipant.setCameraEnabled(newState);
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
        return this.room !== null;
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
