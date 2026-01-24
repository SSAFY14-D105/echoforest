import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { liveKitService } from '../../socket/LiveKitService';
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

    const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]);
    const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

    // LiveKit Connection
    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;
        if (isLiveKitConnecting || liveKitService.isConnected) return;

        const connectLiveKit = async () => {
            console.log(`[CameraArea] Connecting to LiveKit. Room: ${roomId}, Nick: ${nickname}`);
            setIsLiveKitConnecting(true);
            try {
                liveKitService.setLocalVideoElement(localVideoRef.current);
                const userId = localStorage.getItem('loginId') || nickname;
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
        // Note: We might want to keep the connection if we navigate within the game, 
        // but since CameraArea is mounted in GamePage, unmounting it usually means leaving the game.
        return () => {
            // liveKitService.disconnect(); 
            // Disconnect is handled in GamePage cleanup or leaveGame usually, 
            // but if we move it here, we should be careful. 
            // For now, let's keep it consistent: disconnect on unmount.
            liveKitService.disconnect();
        };
    }, [roomId, nickname, isSoloMode]);

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
                const isMe = player?.nickname === nickname;
                const isEmpty = !player;

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
                                {/* Remote video placeholder */}
                                P{index + 1}: {player.nickname}
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
