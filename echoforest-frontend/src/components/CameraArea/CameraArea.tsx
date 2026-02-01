import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { liveKitService } from '../../socket/LiveKitService';
import type { ParticipantInfo } from '../../socket/LiveKitService';
import styles from './CameraArea.module.css';

const MAX_PLAYERS = 4;

interface CameraAreaProps {
    startSlot?: number;
    endSlot?: number;
    participantInfos?: ParticipantInfo[];
    isLiveKitConnected?: boolean;
}

export default function CameraArea({
    startSlot = 0,
    endSlot = MAX_PLAYERS,
    participantInfos: externalParticipantInfos,
    isLiveKitConnected: externalIsConnected
}: CameraAreaProps) {
    // 1. Stable State (Primitive values)
    const nickname = useGameStore(state => state.nickname);
    // const roomId = useGameStore(state => state.roomId);
    const isSoloMode = useGameStore(state => state.isSoloMode);
    // [FIX] 게임 시작 여부 확인
    const isGameStarted = useGameStore(state => state.isGameStarted);
    // 2. Optimized Subscription: Subscribe to whole players array
    const players = useGameStore(useShallow(state => state.players));

    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);

    // [FIX] callback ref - 비디오 엘리먼트가 DOM에 마운트되는 즉시 LiveKit에 등록
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoCallbackRef = (element: HTMLVideoElement | null) => {
        // ref 업데이트
        (localVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = element;

        // DOM에 마운트되면 즉시 LiveKit에 등록
        if (element) {
            liveKitService.setLocalVideoElement(element);
        }
    };

    // Remote Participants State (fallback for standalone usage, e.g., in game)
    const [internalParticipantInfos, setInternalParticipantInfos] = useState<ParticipantInfo[]>([]);

    const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]);
    const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

    // Remote Video Refs map (key: identity or index)
    const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    // Use external participantInfos if provided (from WaitingRoom), otherwise use internal
    const displayParticipantInfos = externalParticipantInfos ?? internalParticipantInfos;
    const isConnected = externalIsConnected ?? liveKitService.isConnected;

    // [Fallback] 내부 참가자 구독 - 외부에서 제공되지 않을 때만 사용 (예: 게임 중)
    useEffect(() => {
        // 외부에서 참가자 정보를 이미 제공받으면 내부 구독 불필요
        if (externalParticipantInfos !== undefined) return;
        if (isSoloMode) return;

        const unsubscribe = liveKitService.onParticipantsChange((infos) => {
            setInternalParticipantInfos(infos);
            // [FIX] 참가자 업데이트 시 로컬 비디오도 다시 attach 시도
            if (localVideoRef.current && liveKitService.isLocalTrackReady) {
                liveKitService.setLocalVideoElement(localVideoRef.current);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [isSoloMode, externalParticipantInfos]);

    // 마이크/카메라 상태 동기화
    useEffect(() => {
        if (isConnected) {
            setIsMicEnabled(liveKitService.isMicEnabled);
            setIsCameraEnabled(liveKitService.isCameraEnabled);
        }
    }, [isConnected]);

    // [FIX] 연결 상태 변경 시 비디오 attach + 트랙 준비될 때까지 폴링
    useEffect(() => {
        if (!isConnected) return;

        // 즉시 시도
        if (localVideoRef.current) {
            liveKitService.setLocalVideoElement(localVideoRef.current);
        }

        // 트랙이 준비될 때까지 폴링 (최대 3초)
        let attempts = 0;
        const maxAttempts = 6;
        const interval = setInterval(() => {
            attempts++;
            if (localVideoRef.current && liveKitService.isLocalTrackReady) {
                liveKitService.setLocalVideoElement(localVideoRef.current);
                clearInterval(interval);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [isConnected]);

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
            {Array.from({ length: endSlot - startSlot }).map((_, i) => {
                const slotIndex = startSlot + i;

                // [FIX] colorIndex로 플레이어 찾기, 없으면 fallback 로직 사용
                let player = players.find(p => p.colorIndex === slotIndex);

                // [FIX] 만약 colorIndex로 못 찾고, 이 슬롯이 startSlot(첫 슬롯)이면서
                // 아직 colorIndex가 할당 안 된 로컬 플레이어가 있으면 해당 슬롯에 표시
                // (서버 동기화 전에 내 카메라를 보여주기 위함)
                if (!player && slotIndex === 0) {
                    const localPlayerWithoutColorIndex = players.find(
                        p => p.isLocal && (p.colorIndex === undefined || p.colorIndex === null)
                    );
                    if (localPlayerWithoutColorIndex) {
                        player = localPlayerWithoutColorIndex;
                    }
                }

                const playerNickname = player?.nickname;
                const isDisconnectedRaw = player?.isDisconnected;

                // [FIX] 로비 화면(게임 시작 전)에서는 연결 끊김을 빈 슬롯으로 처리
                // 게임 중일 때만 Disconnected UI 표시
                const isDisconnected = isDisconnectedRaw && isGameStarted;

                // 플레이어가 없거나, 로비에서 끊겼으면 빈 슬롯 처리
                const isEmpty = !playerNickname || (isDisconnectedRaw && !isGameStarted);

                const isMe = player?.isLocal;

                // 해당 슬롯 플레이어의 LiveKit 정보 찾기
                const participantInfo = !isEmpty
                    ? displayParticipantInfos.find(p => p.identity === playerNickname)
                    : null;

                if (isEmpty) {
                    return (
                        <div
                            key={slotIndex}
                            className={`${styles.cameraBox} ${styles.waiting}`}
                        >
                            P{slotIndex + 1} (대기중...)
                        </div>
                    );
                }

                if (isDisconnected) {
                    return (
                        <div
                            key={slotIndex}
                            className={`${styles.cameraBox} ${styles.disconnected}`}
                        >
                            <div className={styles.cameraOff}>🚫</div>
                            <span className={styles.playerLabel} style={{ color: '#aaa' }}>Disconnected</span>
                        </div>
                    );
                }

                return (
                    <div
                        key={slotIndex}
                        className={`${styles.cameraBox} ${styles.active}`}
                    >
                        {/* Video Area */}
                        {isMe ? (
                            <div className={styles.cameraContent}>
                                {/* Always render video element, hide with CSS when camera off */}
                                <video
                                    ref={localVideoCallbackRef}
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
                                    P{slotIndex + 1}: {playerNickname}
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
                                        onClick={() => setShowVolumeSlider(showVolumeSlider === slotIndex ? null : slotIndex)}
                                    >
                                        <div className={styles.speakerIcon}></div>
                                    </button>
                                    {showVolumeSlider === slotIndex && (
                                        <div className={styles.volumeSliderContainer} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="range" min="0" max="100" value={playerVolumes[slotIndex - 1] ?? 70}
                                                onChange={(e) => handlePlayerVolumeChange(slotIndex - 1, Number(e.target.value))}
                                                className={styles.verticalSlider}
                                            />
                                            <span className={styles.volumeText}>{playerVolumes[slotIndex - 1] ?? 70}%</span>
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
