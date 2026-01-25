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

    // Mock Mode State (For UI Testing without Backend)
    const [isMockMode, setIsMockMode] = useState(false);

    // Remote Video Refs map (key: identity or index)
    const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    const toggleMockMode = () => {
        setIsMockMode(prev => !prev);
    };

    // Derived Players for Rendering
    const displayPlayers = isMockMode
        ? [
            { nickname: nickname || 'Me', isHost: true },
            { nickname: 'SimUser1', isHost: false },
            { nickname: 'SimUser2', isHost: false },
            { nickname: 'SimUser3', isHost: false }
        ]
        : players;

    // Mock Participants Info
    const displayParticipantInfos = isMockMode
        ? [
            { identity: 'SimUser1', isSpeaking: true, isMuted: false, isCameraEnabled: true, videoTrack: null, audioTrack: null },
            { identity: 'SimUser2', isSpeaking: false, isMuted: true, isCameraEnabled: false, videoTrack: null, audioTrack: null },
            { identity: 'SimUser3', isSpeaking: false, isMuted: false, isCameraEnabled: true, videoTrack: null, audioTrack: null }
        ]
        : participantInfos;

    // LiveKit Connection
    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;

        liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });

        if (liveKitService.isConnected) {
            setIsMicEnabled(liveKitService.isMicEnabled);
            setIsCameraEnabled(liveKitService.isCameraEnabled);
        }

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

        if (!isMockMode) {
            connectLiveKit();
        }

        return () => {
            liveKitService.disconnect();
        };
    }, [roomId, nickname, isSoloMode, isMockMode]);

    // Remote Video Track Attachment
    useEffect(() => {
        displayParticipantInfos.forEach(info => {
            if (info.identity === nickname) return;
            const videoEl = remoteVideoRefs.current[info.identity];
            if (videoEl && info.videoTrack) {
                info.videoTrack.attach(videoEl);
            }
        });
    }, [displayParticipantInfos, nickname]);

    const handleToggleMic = async () => {
        if (isMockMode) {
            console.log('[Mock] Toggle Mic');
            setIsMicEnabled(prev => !prev);
            return;
        }
        const newState = await liveKitService.toggleMic();
        setIsMicEnabled(newState);
    };

    const handleToggleCamera = async () => {
        if (isMockMode) {
            console.log('[Mock] Toggle Camera');
            setIsCameraEnabled(prev => !prev);
            return;
        }
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
            {/* Debug Toggle Button (Dev Only) */}
            <div style={{ position: 'fixed', bottom: 150, right: 10, zIndex: 9999 }}>
                <button
                    onClick={toggleMockMode}
                    style={{
                        fontSize: '10px',
                        padding: '2px 5px',
                        background: isMockMode ? '#ff4444' : '#444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        opacity: 0.7
                    }}>
                    {isMockMode ? 'Mock: ON' : 'Mock: OFF'}
                </button>
            </div>

            {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
                const player = displayPlayers[index];
                const isEmpty = !player;
                const isMe = player?.nickname === nickname; // In Mock mode, nickname might be 'Me' or 'UserA'

                // 해당 슬롯 플레이어의 LiveKit 정보 찾기
                const participantInfo = !isEmpty
                    ? displayParticipantInfos.find(p => p.identity === player.nickname)
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
                                    ref={el => { if (el && player) remoteVideoRefs.current[player.nickname] = el; }}
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
