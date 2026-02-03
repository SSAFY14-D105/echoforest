import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { liveKitService } from '../../socket/LiveKitService';
import type { ParticipantInfo } from '../../socket/LiveKitService';
import styles from './CameraArea.module.css';

const MAX_PLAYERS = 4;
const ANIMAL_ICONS = ['🍄', '🌰', '🌱', '🍂'];

interface CameraAreaProps {
    startSlot?: number;
    endSlot?: number;
    participantInfos?: ParticipantInfo[];
    isLiveKitConnected?: boolean;
}

const CameraArea = memo(function CameraArea({
    startSlot = 0,
    endSlot = MAX_PLAYERS,
    participantInfos: externalParticipantInfos,
    isLiveKitConnected: externalIsConnected
}: CameraAreaProps) {
    // 1. Stable State (Primitive values)
    // const nickname = useGameStore(state => state.nickname);
    // const roomId = useGameStore(state => state.roomId);
    const isSoloMode = useGameStore(state => state.isSoloMode);
    // [FIX] 게임 시작 여부 확인
    const isGameStarted = useGameStore(state => state.isGameStarted);
    // 2. Optimized Subscription: Subscribe to whole players array
    const players = useGameStore(useShallow(state => state.players));

    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);

    const localVideoRef = useRef<HTMLVideoElement>(null);

    // [FIX] callback ref - 비디오 엘리먼트가 DOM에 마운트되는 즉시 LiveKit에 등록 (useCallback으로 안정화)
    const onLocalVideoRef = useCallback((element: HTMLVideoElement | null) => {
        // ref 업데이트
        localVideoRef.current = element;

        // DOM에 마운트되면 LiveKit에 등록 (null이면 detach 처리됨)
        liveKitService.setLocalVideoElement(element);
    }, []);

    // Remote Participants State (fallback for standalone usage, e.g., in game)
    const [internalParticipantInfos, setInternalParticipantInfos] = useState<ParticipantInfo[]>([]);

    const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]);
    const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

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

    // [FIX] 연결 상태 변경 시 비디오 attach + 트랙 감지 이벤트 리스너 등록
    useEffect(() => {
        if (!isConnected) {
            // 연결 끊김 시 로컬 비디오 정리 (선택적)
            // if (localVideoRef.current) liveKitService.detachLocalVideo(localVideoRef.current);
            return;
        }

        // 1. 연결 복구 시 즉시 시도 (중요: 재접속 시 트랙을 다시 붙여야 함)
        if (localVideoRef.current) {
            liveKitService.setLocalVideoElement(localVideoRef.current);
        }

        // 2. 트랙이 나중에 준비될 경우를 대비해 이벤트 구독
        const unsubscribe = liveKitService.onLocalTrackPublished(() => {
            // console.log('[CameraArea] Local track published event received');
            if (localVideoRef.current) {
                liveKitService.setLocalVideoElement(localVideoRef.current);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [isConnected]); // isConnected가 false -> true로 변할 때 실행됨

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
                            <img
                                src="/assets/ui/waiting_people.png"
                                alt="Waiting"
                                className={styles.waitingPeopleImage}
                            />
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
                                    ref={onLocalVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={styles.localVideo}
                                    style={{ display: isCameraEnabled ? 'block' : 'none' }}
                                />
                                {!isCameraEnabled && (
                                    <div className={styles.cameraOff}>
                                        <img src="/assets/ui/camera_off.png" alt="Camera Off" className={styles.cameraOffImage} />
                                    </div>
                                )}
                                <span className={styles.playerLabel}>나 {ANIMAL_ICONS[slotIndex]}</span>
                            </div>
                        ) : (
                            <RemoteVideo
                                participantInfo={participantInfo}
                                nickname={playerNickname}
                                slotIndex={slotIndex}
                                className={styles.remoteVideo}
                            />
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
                                        <div className={styles.micIcon}></div>
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
        </div >
    );
});

export default CameraArea;

// [FIX] Separate Component for Remote Video to ensure Ref stability
// 부모 리렌더링 시에도 ref가 유지되도록 컴포넌트 분리
function RemoteVideo({
    participantInfo,
    nickname,
    slotIndex,
    className
}: {
    participantInfo: ParticipantInfo | null | undefined,
    nickname: string | undefined,
    slotIndex: number,
    className: string
}) {
    // [FIX] Ref stability and track attachment
    const videoRef = useRef<HTMLVideoElement>(null);
    const trackSid = participantInfo?.videoTrack?.sid;

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl || !participantInfo?.videoTrack) return;

        // console.log(`[RemoteVideo] Attaching track ${participantInfo.videoTrack.sid} to video element`);
        participantInfo.videoTrack.attach(videoEl);

        const playVideo = async () => {
            try {
                await videoEl.play();
                // console.log(`[RemoteVideo] Playing ${nickname}`);
            } catch (e) {
                console.warn(`[RemoteVideo] Autoplay failed for ${nickname}:`, e);
            }
        };
        playVideo();

        return () => {
            // [FIX] Clean up attachment
            if (participantInfo.videoTrack) {
                participantInfo.videoTrack.detach(videoEl);
            }
        };
    }, [participantInfo?.videoTrack, trackSid]); // trackSid가 바뀌면 재실행

    const isVideoVisible = participantInfo?.videoTrack && participantInfo.isCameraEnabled;

    return (
        <div className={styles.cameraContent}>
            <video
                ref={videoRef}
                key={trackSid} // [FIX] 트랙이 바뀌면 비디오 엘리먼트 재생성
                autoPlay
                playsInline
                className={className}
                style={{ display: isVideoVisible ? 'block' : 'none' }}
            />

            {!isVideoVisible && (
                <div className={styles.cameraOff}>
                    {participantInfo ? (
                        <img src="/assets/ui/camera_off.png" alt="Camera Off" className={styles.cameraOffImage} />
                    ) : (
                        '...'
                    )}
                </div>
            )}

            <div className={styles.remoteLabel}>
                {ANIMAL_ICONS[slotIndex]} {nickname}
            </div>
        </div>
    );
}
