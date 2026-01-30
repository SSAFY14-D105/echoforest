import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { liveKitService } from '../../socket/LiveKitService';
import type { ParticipantInfo } from '../../socket/LiveKitService';
import styles from './CameraArea.module.css';

const PLAYER_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];
const MAX_PLAYERS = 4;

export default function CameraArea() {
    // 1. Stable State (Primitive values)
    const nickname = useGameStore(state => state.nickname);
    const roomId = useGameStore(state => state.roomId);
    const isSoloMode = useGameStore(state => state.isSoloMode);

    // 2. Optimized Subscription: Only subscribe to the list of nicknames
    // This prevents re-renders when x, y, anim coordinates change (30fps)
    const playerNicknames = useGameStore(
        useShallow(state => state.players.map(p => p.nickname))
    );

    // LiveKit State
    const [isLiveKitConnecting, setIsLiveKitConnecting] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Remote Participants State
    const [participantInfos, setParticipantInfos] = useState<ParticipantInfo[]>([]);

    const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]);
    const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

    // Derived Players for Rendering
    // Remote Video Refs map (key: identity or index)
    const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    // Mock Participants Info
    const displayParticipantInfos = participantInfos;

    // LiveKit Connection
    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;

        const unsubscribe = liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });

        if (liveKitService.isConnected) {
            setIsMicEnabled(liveKitService.isMicEnabled);
            setIsCameraEnabled(liveKitService.isCameraEnabled);
        }

        // 이미 연결 중이거나 연결됨 -> 연결 로직 스킵하지만 cleanup은 유지
        if (isLiveKitConnecting || liveKitService.isConnected) {
            return () => {
                unsubscribe();
            };
        }

        const connectLiveKit = async () => {
            // console.log(`[CameraArea] Connecting to LiveKit. Room: ${roomId}, Nick: ${nickname}`);
            setIsLiveKitConnecting(true);
            try {
                liveKitService.setLocalVideoElement(localVideoRef.current);
                // [FIX] nickname을 identity로 사용하여 다른 플레이어와 매칭
                await liveKitService.connect(roomId, nickname, nickname);
                setIsMicEnabled(liveKitService.isMicEnabled);
                setIsCameraEnabled(liveKitService.isCameraEnabled);
            } catch (error) {
                console.error('LiveKit connection failed:', error);
            } finally {
                setIsLiveKitConnecting(false);
            }
        };

        connectLiveKit();

        return () => {
            unsubscribe();
            liveKitService.disconnect();
        };
    }, [roomId, nickname, isSoloMode]);

    // [FIX] localVideoRef가 DOM에 attach된 후 LiveKit에 설정
    useEffect(() => {
        if (localVideoRef.current && liveKitService.isConnected) {
            liveKitService.setLocalVideoElement(localVideoRef.current);
        }
    }, [localVideoRef.current, liveKitService.isConnected]);

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
                const playerNickname = playerNicknames[index];
                const isEmpty = !playerNickname;
                const isMe = playerNickname === nickname;

                // 해당 슬롯 플레이어의 LiveKit 정보 찾기
                const participantInfo = !isEmpty
                    ? displayParticipantInfos.find(p => p.identity === playerNickname)
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
                                {/* Always render video element, hide with CSS when camera off */}
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={styles.localVideo}
                                    style={{ display: isCameraEnabled ? 'block' : 'none' }}
                                />
                                {!isCameraEnabled && (
                                    <div className={styles.cameraOff}>📹</div>
                                )}
                                <span className={styles.playerLabel}>나</span>
                            </div>
                        ) : (
                            <div className={styles.cameraContent}>
                                {/* Remote Video */}
                                <video
                                    ref={el => { if (el && playerNickname) remoteVideoRefs.current[playerNickname] = el; }}
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
                                    P{index + 1}: {playerNickname}
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
