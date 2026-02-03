/**
 * 엔딩 미션 오버레이 컴포넌트
 * 모든 플레이어가 골대에 도착했을 때 4분할 카메라 그리드 표시
 * 각 참가자에게 랜덤 포즈를 할당하고 모션 인식
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ParticipantInfo } from '../../../socket/LiveKitService';
import { liveKitService } from '../../../socket/LiveKitService';
import { captureAllParticipants } from '../../../utils/captureUtils';
import { assignPosesToParticipants } from '../../../utils/PoseManager';
import { useMultiMotionDetector, type ParticipantPoseState } from '../../../hooks/useMultiMotionDetector';
import styles from './EndingMissionOverlay.module.css';

// 타입 확장을 통해 isDummy 등 내부 속성 처리
interface ExtendedParticipant {
    identity: string;
    isLocal: boolean;
    isDummy?: boolean;
    videoTrack?: any;
}

interface EndingMissionOverlayProps {
    /** 참가자 정보 (LiveKit) */
    participantInfos: ParticipantInfo[];
    /** 현재 유저 닉네임 */
    nickname: string;
    /** 방 ID (포즈 시드 생성용) */
    roomId?: string;
    /** 스테이지 번호 (포즈 할당 시드용) */
    stage?: number | null;
    /** 모션 인식 완료 콜백 */
    onMotionCleared?: () => void;
    /** 이미지 캡처 완료 콜백 */
    onCaptureComplete?: (captures: Blob[]) => void;
    /** 오버레이 닫기 콜백 */
    onClose?: () => void;
}

const PLAYER_COLORS = ['#4CAF50', '#4CAF50', '#4CAF50', '#4CAF50'];

export default function EndingMissionOverlay({
    participantInfos = [],
    nickname,
    roomId = 'default-room',
    stage = null,
    onMotionCleared,
    onCaptureComplete,
    onClose
}: EndingMissionOverlayProps) {
    const [captureComplete, setCaptureComplete] = useState(false);
    const captureStartedRef = useRef(false); // [FIX] 캡처 시작 여부 추적 (중복 방지)
    const previousStatesRef = useRef<ParticipantPoseState[]>([]); // [NEW] 이전 상태 추적 (포즈 완료 감지용)

    // 리모트 참가자의 클리어 상태 관리
    const [remoteStates, setRemoteStates] = useState<Map<string, boolean>>(new Map());

    // 클리어 메시지 전송 여부 추적 (중복 전송 방지)
    const clearedSentRef = useRef<Set<string>>(new Set());

    // 비디오 refs를 Map으로 관리
    const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
    const localVideoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

    // 실제 참가자 수 (더미 제외)
    const realParticipantCount = useMemo(() => {
        return 1 + (participantInfos?.filter(p => p.identity !== nickname).length || 0);
    }, [participantInfos, nickname]);

    // 참가자 목록 (로컬 + 리모트) - 항상 4명 채우기
    const allParticipants = useMemo<ExtendedParticipant[]>(() => {
        try {
            const real: ExtendedParticipant[] = [
                { identity: nickname, isLocal: true, isDummy: false },
                ...(participantInfos || []).filter(p => p.identity !== nickname).map(p => ({ ...p, isLocal: false, isDummy: false }))
            ];

            // 4명 미만일 경우 더미 추가
            if (real.length < 4) {
                const dummies = Array(4 - real.length).fill(null).map((_, i) => ({
                    identity: `Waiting Player ${real.length + i + 1}`,
                    isLocal: true,
                    isDummy: true
                }));
                const result = [...real, ...dummies];
                return result;
            }
            return real.slice(0, 4);
        } catch (e) {
            console.error('[EndingMissionOverlay] Participant calculation error:', e);
            return [{ identity: nickname, isLocal: true, isDummy: false }];
        }
    }, [participantInfos, nickname]);

    // roomId 기반으로 각 참가자에게 포즈 할당
    // [FIX] 실제 참가자만 포즈 할당 (더미는 포즈 없음)
    // [FIX] 스테이지 번호를 포함하여 스테이지별로 다른 포즈 할당
    const poseAssignments = useMemo(() => {
        const realIdentities = allParticipants
            .filter(p => !p.isDummy)
            .slice(0, 4)
            .map(p => p.identity);
        return assignPosesToParticipants(realIdentities, roomId, stage);
    }, [allParticipants, roomId, stage]);

    // 멀티 모션 감지 훅 (내 비디오만 감지)
    const { isLoaded, participantStates } = useMultiMotionDetector({
        videoRefs: localVideoRefs,
        poseAssignments,
        enabled: !captureComplete
    });

    // DataChannel 수신 (리모트 클리어 상태 업데이트)
    useEffect(() => {
        const unsubscribe = liveKitService.onDataReceived((payload, participant) => {
            if (!participant) return;
            try {
                if (typeof TextDecoder === 'undefined') return;
                const message = new TextDecoder().decode(payload);
                if (message === 'POSE_CLEARED') {
                    setRemoteStates(prev => {
                        const newMap = new Map(prev);
                        newMap.set(participant.identity, true);
                        return newMap;
                    });
                }
            } catch (e) {
                console.error('[EndingMissionOverlay] Data decode error:', e);
            }
        });
        return unsubscribe;
    }, []);

    // 내 포즈 클리어 시 브로드캐스트
    useEffect(() => {
        if (!participantStates) return;

        participantStates.forEach(state => {
            if (state.identity === nickname && state.isCleared && !clearedSentRef.current.has(nickname)) {
                liveKitService.sendData('POSE_CLEARED').catch(err => {
                    console.warn('[EndingMissionOverlay] Send data failed:', err);
                });
                clearedSentRef.current.add(nickname);
            }
        });
    }, [participantStates, nickname]);



    // 엔딩 미션 시작 시 720p로 해상도 변경 + 카메라 강제 켜기
    useEffect(() => {
        try {
            liveKitService.forceCameraOn();
            liveKitService.setVideoResolution('h720');
        } catch (e) {
            console.error('Camera setup error:', e);
        }

        return () => {
            try {
                liveKitService.setVideoResolution('h540');
                liveKitService.restoreCameraState();
            } catch (e) {
                console.warn('Camera restore error:', e);
            }
        };
    }, []);

    // [FIX] 로컬 비디오 연결 폴링 (타이밍 이슈 해결)
    useEffect(() => {
        // 마운트 후 짧게 폴링하여 로컬 비디오가 확실히 연결되도록 함
        let attempts = 0;
        const maxAttempts = 10;
        console.log('[EndingMissionOverlay] Starting local video polling...');
        const interval = setInterval(() => {
            attempts++;
            const localEl = localVideoRefs.current.get(nickname);
            if (localEl) {
                console.log(`[EndingMissionOverlay] Polling attempt ${attempts}: localEl found`, {
                    readyState: localEl.readyState,
                    videoWidth: localEl.videoWidth,
                    videoHeight: localEl.videoHeight
                });
                const success = liveKitService.attachLocalVideo(localEl);
                if (success) {
                    console.log('[EndingMissionOverlay] ✅ Local video attached via polling');
                    clearInterval(interval);
                }
            } else {
                console.warn(`[EndingMissionOverlay] Polling attempt ${attempts}: localEl NOT found`);
            }
            if (attempts >= maxAttempts) {
                console.warn('[EndingMissionOverlay] Max polling attempts reached');
                clearInterval(interval);
            }
        }, 300);

        return () => clearInterval(interval);
    }, [nickname]);

    // [FIX] participantInfos를 ref로 관리하여 handleVideoRef의 의존성 제거
    const participantInfosRef = useRef(participantInfos);
    useEffect(() => {
        participantInfosRef.current = participantInfos;
    }, [participantInfos]);

    // [FIX] 비디오 엘리먼트 Ref 콜백 - 의존성 없음 (stable)
    const handleVideoRef = useCallback((el: HTMLVideoElement | null, identity: string, isLocal: boolean) => {
        if (el) {
            videoRefs.current.set(identity, el);

            if (isLocal) {
                localVideoRefs.current.set(identity, el);
                // [DEBUG] 로그 과다 방지를 위해 상태 변경 시에만 로그 출력 고려 (일단 유지)
                // console.log(`[EndingMissionOverlay] Local video added: ${identity}`);
                try {
                    liveKitService.attachLocalVideo(el);
                } catch (e) {
                    console.error('Attach local video failed:', e);
                }
            } else {
                const info = (participantInfosRef.current || []).find(p => p.identity === identity);
                if (info && info.videoTrack) {
                    info.videoTrack.attach(el);
                }
            }
        } else {
            // [FIX] 언마운트 시 트랙에서 detach하여 WebMediaPlayer 누수 방지
            const existingEl = videoRefs.current.get(identity);
            if (existingEl) {
                if (isLocal) {
                    try {
                        liveKitService.detachLocalVideo(existingEl);
                    } catch (e) {
                        console.warn('Detach local video failed:', e);
                    }
                } else {
                    const info = (participantInfosRef.current || []).find(p => p.identity === identity);
                    if (info && info.videoTrack) {
                        try {
                            info.videoTrack.detach(existingEl);
                        } catch (e) {
                            console.warn('Detach remote video failed:', e);
                        }
                    }
                }
            }

            videoRefs.current.delete(identity);
            if (isLocal) {
                localVideoRefs.current.delete(identity);
                // console.log(`[EndingMissionOverlay] Local video removed: ${identity}`);
            }
        }
    }, []); // 의존성 없음

    // 리모트 비디오 트랙 재연결
    useEffect(() => {
        if (!participantInfos) return;

        participantInfos.forEach(info => {
            if (info.identity === nickname) return;
            const videoEl = videoRefs.current.get(info.identity);
            if (videoEl && info.videoTrack) {
                try {
                    info.videoTrack.attach(videoEl);
                } catch (e) {
                    // ignore
                }
            }
        });
    }, [participantInfos, nickname]);



    // [NEW] 즉시 캡처 (포즈 완료 순간에 바로 촬영)
    const handleInstantCapture = useCallback(async () => {
        if (captureStartedRef.current) return;
        captureStartedRef.current = true;

        try {
            const localParticipant = allParticipants.find(p => p.isLocal);
            if (localParticipant) {
                const videoEl = videoRefs.current.get(localParticipant.identity);
                if (videoEl) {
                    console.log('[EndingMissionOverlay] 📸 Capturing pose completion moment:', localParticipant.identity);
                    const captures = await captureAllParticipants([videoEl]);
                    onCaptureComplete?.(captures);
                    setCaptureComplete(true);
                } else {
                    console.warn('[EndingMissionOverlay] Local video element not found for capture');
                }
            }
        } catch (error) {
            console.error('[EndingMissionOverlay] Capture failed:', error);
        }
    }, [allParticipants, onCaptureComplete]);

    // [NEW] 포즈 완료 감지 및 즉시 캡처
    useEffect(() => {
        if (captureComplete) return;

        // 로컬 참가자의 상태 변화 감지
        const localState = participantStates.find(s => s.identity === nickname);
        const previousLocalState = previousStatesRef.current.find(s => s.identity === nickname);

        // 이전에는 클리어 안됐는데 지금 클리어됨 → 즉시 캡처!
        if (localState && !previousLocalState?.isCleared && localState.isCleared) {
            console.log('[EndingMissionOverlay] ✅ Pose completed! Capturing immediately...');
            handleInstantCapture().then(() => {
                onMotionCleared?.();
                // 3초 후 닫기
                setTimeout(() => {
                    onClose?.();
                }, 3000);
            });
        }

        // 현재 상태를 이전 상태로 저장
        previousStatesRef.current = participantStates;
    }, [participantStates, captureComplete, handleInstantCapture, nickname, onMotionCleared, onClose]);

    // 참가자별 포즈 상태 조회
    const getDisplayState = useCallback((participant: ExtendedParticipant) => {
        if (participant.isDummy) {
            return {
                isCleared: true,
                currentGesture: '대기중',
                score: 1
            };
        }

        if (participant.isLocal) {
            return participantStates.find(s => s.identity === participant.identity);
        } else {
            const isRemoteCleared = remoteStates.get(participant.identity);
            return {
                isCleared: isRemoteCleared,
                currentGesture: isRemoteCleared ? '👍' : null,
                score: isRemoteCleared ? 1 : 0
            };
        }
    }, [participantStates, remoteStates]);

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <h2 className={styles.title}>스테이지 클리어!</h2>

                {!isLoaded && !captureComplete && (
                    <p className={styles.loadingText}>🔄 포즈 인식 준비 중...</p>
                )}

                <div className={styles.cameraGrid}>
                    {allParticipants.slice(0, 4).map((participant, index) => {
                        const displayState = getDisplayState(participant);
                        const targetPose = poseAssignments.get(participant.identity);

                        return (
                            <ParticipantCameraBox
                                key={participant.identity}
                                participant={participant}
                                index={index}
                                displayState={displayState}
                                targetPose={targetPose}
                                handleVideoRef={handleVideoRef}
                                nickname={nickname}
                                participantInfosRef={participantInfosRef} // prop for remote track lookup if needed
                            />
                        );
                    })}
                </div>

                <div className={styles.statusArea}>
                    {!captureComplete && (
                        <div className={styles.statusContainer}>
                            <p className={styles.statusText}>📸 포즈를 완성하는 순간 자동으로 촬영됩니다!</p>
                            <p className={styles.subStatusText}>
                                {allParticipants.filter(p => {
                                    if (p.isDummy) return false;
                                    if (p.isLocal) return participantStates.find(s => s.identity === p.identity)?.isCleared;
                                    return remoteStates.get(p.identity);
                                }).length} / {realParticipantCount} 완료
                            </p>
                        </div>
                    )}
                    {captureComplete && (
                        <p className={styles.statusText}>✅ 촬영 완료!</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// [FIX] 분리된 비디오 컴포넌트 - 불필요한 리렌더링 및 비디오 ref 재설정 방지
interface ParticipantCameraBoxProps {
    participant: ExtendedParticipant;
    index: number;
    displayState: any;
    targetPose: any;
    handleVideoRef: (el: HTMLVideoElement | null, identity: string, isLocal: boolean) => void;
    nickname: string;
    participantInfosRef: React.MutableRefObject<ParticipantInfo[]>;
}

function ParticipantCameraBox({
    participant,
    index,
    displayState,
    targetPose,
    handleVideoRef,
    nickname,
    participantInfosRef
}: ParticipantCameraBoxProps) {
    const isDummy = participant.isDummy;

    // [KEY] 비디오 ref 콜백을 stable하게 유지
    const onVideoRef = useCallback((el: HTMLVideoElement | null) => {
        handleVideoRef(el, participant.identity, participant.isLocal);
    }, [handleVideoRef, participant.identity, participant.isLocal]);

    // 리모트 트랙의 경우 여기서 display 여부 확인
    const shouldShowVideo = participant.isLocal || (
        !participant.isLocal &&
        participantInfosRef.current?.find(p => p.identity === participant.identity)?.videoTrack
    );

    return (
        <div
            className={`${styles.cameraBox} ${displayState?.isCleared ? styles.cleared : ''}`}
            style={{ borderColor: displayState?.isCleared ? '#4CAF50' : PLAYER_COLORS[0] }}
        >
            {targetPose && !isDummy && (
                <div className={styles.targetPose}>
                    <span className={styles.poseEmoji}>{targetPose.emoji}</span>
                    <span className={styles.poseName}>{targetPose.name}</span>
                </div>
            )}

            {
                isDummy && (
                    <div className={styles.targetPose}>
                        <span className={styles.poseEmoji}>💤</span>
                        <span className={styles.poseName}>대기 중</span>
                    </div>
                )
            }

            <video
                ref={onVideoRef}
                autoPlay
                muted={participant.isLocal}
                playsInline
                className={styles.video}
                style={{
                    display: shouldShowVideo ? 'block' : 'none'
                }}
            />

            {
                !isDummy && displayState?.currentGesture && !displayState.isCleared && (
                    <div className={styles.detectionStatus}>
                        감지: {displayState.currentGesture}
                    </div>
                )
            }

            {
                displayState?.isCleared && (
                    <div className={styles.clearedOverlay}>
                        <span className={styles.checkmark}>{isDummy ? '💤' : '✅'}</span>
                    </div>
                )
            }

            <span className={styles.playerLabel}>
                P{index + 1}: {participant.identity === nickname ? '나' : participant.identity}{isDummy ? ' (대기)' : ''}
            </span>
        </div >
    );
}
