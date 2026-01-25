import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { liveKitService } from '../../socket/LiveKitService';
import type { ParticipantInfo } from '../../socket/LiveKitService';
import styles from './CameraArea.module.css';

const PLAYER_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];
const MAX_PLAYERS = 4;

export default function CameraArea() {
    const {
        nickname,
        roomId,
        players,
        isSoloMode
    } = useGameStore();

    // LiveKit State
    const [isLiveKitConnecting, setIsLiveKitConnecting] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Remote Participants State
    const [participantInfos, setParticipantInfos] = useState<ParticipantInfo[]>([]);

    const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]);
    const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

    // Remote Video Refs map (key: identity or index)
    const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    // LiveKit Connection
    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;

        // 참가자 업데이트 리스너 등록
        liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });

        // 이미 연결되어 있다면 상태 초기화만 수행
        if (liveKitService.isConnected) {
            setIsMicEnabled(liveKitService.isMicEnabled);
            setIsCameraEnabled(liveKitService.isCameraEnabled);
            // 초기 참가자 정보 가져오기
        }

        if (isLiveKitConnecting || liveKitService.isConnected) return;

        const connectLiveKit = async () => {
            console.log(`[CameraArea] Connecting to LiveKit. Room: ${roomId}, Nick: ${nickname}`);
            setIsLiveKitConnecting(true);
            try {
                liveKitService.setLocalVideoElement(localVideoRef.current);
                const userId = localStorage.getItem('loginId') || nickname; // Use stored ID if available
                await liveKitService.connect(roomId, userId, nickname);

                setIsMicEnabled(liveKitService.isMicEnabled);
                setIsCameraEnabled(liveKitService.isCameraEnabled);
            } catch (error) {
                console.error('LiveKit connection failed:', error);
            } finally {
                setIsLiveKitConnecting(false);
            }
        };

        connectLiveKit();

        // Cleanup
        return () => {
            liveKitService.disconnect();
        };
    }, [roomId, nickname, isSoloMode]);

    // Remote Video Track Attachment
    useEffect(() => {
        // participantInfos가 변경될 때마다 비디오 트랙 연결
        participantInfos.forEach(info => {
            if (info.identity === nickname) return; // Skip local

            const videoEl = remoteVideoRefs.current[info.identity];
            if (videoEl && info.videoTrack) {
                info.videoTrack.attach(videoEl);
            }
        });
    }, [participantInfos, nickname]);

    const handleToggleMic = async () => {
        const newState = await liveKitService.toggleMic();
        setIsMicEnabled(newState);
    };

    const handleToggleCamera = async () => {
        const newState = await liveKitService.toggleCamera();
        setIsCameraEnabled(newState);
    };

    const handlePlayerVolumeChange = (playerIndex: number, volume: number) => {
        const newVolumes = [...playerVolumes];
        newVolumes[playerIndex] = volume;
        setPlayerVolumes(newVolumes);
    };

    return (
        <div className={styles.cameraArea}>
            {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
                const player = players[index];
                const isEmpty = !player;
                const isMe = player?.nickname === nickname;

                // 해당 슬롯 플레이어의 LiveKit 정보 찾기
                const participantInfo = !isEmpty
                    ? participantInfos.find(p => p.identity === player.nickname)
                    : null;

                if (isEmpty) {
                    return (
                        <div
                            key={index}
                            className={`${styles.cameraBox} ${styles.waiting}`}
                            style={{ borderColor: PLAYER_COLORS[index] }}
                        >
                            P{index + 1} (대기중...)
                        </div>
                    );
                }

                return (
                    <div
                        key={index}
                        className={`${styles.cameraBox} ${styles.active}`}
                        style={{ borderColor: PLAYER_COLORS[index] }}
                    >
                        {/* Video Area */}
                        {isMe ? (
                            <div className={styles.cameraContent}>
                                {isCameraEnabled ? (
                                    <video ref={localVideoRef} autoPlay muted playsInline className={styles.localVideo} />
                                ) : (
                                    <div className={styles.cameraOff}>📹</div>
                                )}
                                <span className={styles.playerLabel}>나</span>
                            </div>
                        ) : (
                            <div className={styles.cameraContent}>
                                {/* Remote Video */}
                                <video
                                    ref={el => { remoteVideoRefs.current[player.nickname] = el; }}
                                    autoPlay
                                    playsInline
                                    className={styles.remoteVideo}
                                    style={{ display: participantInfo?.videoTrack && participantInfo.isCameraEnabled ? 'block' : 'none' }}
                                />

                                {(!participantInfo?.videoTrack || !participantInfo.isCameraEnabled) && (
                                    <div className={styles.cameraOff}>
                                        {participantInfo ? '📹' : '...'}
                                    </div>
                                )}

                                <div className={styles.remoteLabel}>
                                    P{index + 1}: {player.nickname}
                                </div>
                            </div>
                        )}

                        {/* My Controls */}
                        {isMe && (
                            <div className={styles.controls}>
                                <div className={styles.controlBtn}>
                                    <button
                                        className={styles.btn}
                                        onClick={handleToggleMic}
                                    >
                                        <div className={isMicEnabled ? styles.micIcon : styles.micOffIcon}></div>
                                    </button>
                                </div>
                                <button className={styles.btn} onClick={handleToggleCamera}>
                                    <div className={isCameraEnabled ? styles.cameraIcon : styles.cameraOffIcon}></div>
                                </button>
                            </div>
                        )}

                        {/* Others Controls */}
                        {!isMe && (
                            <div className={styles.controls}>
                                <div className={styles.controlBtn}>
                                    <button
                                        className={styles.btn}
                                        onClick={() => setShowVolumeSlider(showVolumeSlider === index ? null : index)}
                                    >
                                        <div className={styles.speakerIcon}></div>
                                    </button>
                                    {showVolumeSlider === index && (
                                        <div className={styles.volumeSliderContainer} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="range" min="0" max="100" value={playerVolumes[index - 1] ?? 70}
                                                onChange={(e) => handlePlayerVolumeChange(index - 1, Number(e.target.value))}
                                                className={styles.verticalSlider}
                                            />
                                            <span className={styles.volumeText}>{playerVolumes[index - 1] ?? 70}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
