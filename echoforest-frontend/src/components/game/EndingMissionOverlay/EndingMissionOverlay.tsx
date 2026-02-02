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
import { useMultiMotionDetector } from '../../../hooks/useMultiMotionDetector';
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
    /** 모션 인식 완료 콜백 */
    onMotionCleared?: () => void;
    /** 이미지 캡처 완료 콜백 */
    onCaptureComplete?: (captures: Blob[]) => void;
    /** 오버레이 닫기 콜백 */
    onClose?: () => void;
}

const PLAYER_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

export default function EndingMissionOverlay({
    participantInfos = [],
    nickname,
    roomId = 'default-room',
    onMotionCleared,
    onCaptureComplete,
    onClose
}: EndingMissionOverlayProps) {
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureComplete, setCaptureComplete] = useState(false);
    const captureStartedRef = useRef(false); // [FIX] 캡처 시작 여부 추적 (중복 방지)

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
    const poseAssignments = useMemo(() => {
        const realIdentities = allParticipants
            .filter(p => !p.isDummy)
            .slice(0, 4)
            .map(p => p.identity);
        return assignPosesToParticipants(realIdentities, roomId);
    }, [allParticipants, roomId]);

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

    // [FIX] 전체 클리어 여부 계산 - 더미는 항상 클리어로 간주
    const allCleared = useMemo(() => {
        const targets = allParticipants.slice(0, 4);
        if (targets.length === 0) return false;

        return targets.every(p => {
            // 더미는 항상 클리어로 간주 (테스트 편의성)
            if (p.isDummy) return true;

            if (p.isLocal) {
                return participantStates.find(s => s.identity === p.identity)?.isCleared;
            } else {
                return remoteStates.get(p.identity);
            }
        });
    }, [allParticipants, participantStates, remoteStates]);

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
        const interval = setInterval(() => {
            attempts++;
            const localEl = localVideoRefs.current.get(nickname);
            if (localEl) {
                const success = liveKitService.attachLocalVideo(localEl);
                if (success) {
                    console.log('[EndingMissionOverlay] Local video attached via polling');
                    clearInterval(interval);
                }
            }
            if (attempts >= maxAttempts) {
                clearInterval(interval);
            }
        }, 300);

        return () => clearInterval(interval);
    }, [nickname]);

    // 비디오 엘리먼트 Ref 콜백
    const handleVideoRef = useCallback((el: HTMLVideoElement | null, identity: string, isLocal: boolean) => {
        if (el) {
            videoRefs.current.set(identity, el);

            if (isLocal) {
                localVideoRefs.current.set(identity, el);
                try {
                    liveKitService.attachLocalVideo(el);
                } catch (e) {
                    console.error('Attach local video failed:', e);
                }
            } else {
                const info = (participantInfos || []).find(p => p.identity === identity);
                if (info && info.videoTrack) {
                    info.videoTrack.attach(el);
                }
            }
        } else {
            videoRefs.current.delete(identity);
            if (isLocal) {
                localVideoRefs.current.delete(identity);
            }
        }
    }, [participantInfos]);

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
                    // ignore - already attached
                }
            }
        });

        // [FIX] 타이밍 이슈 해결: 재시도 로직 추가
        const retryTimeout = setTimeout(() => {
            participantInfos.forEach(info => {
                if (info.identity === nickname) return;
                const videoEl = videoRefs.current.get(info.identity);
                if (videoEl && info.videoTrack) {
                    try {
                        info.videoTrack.attach(videoEl);
                    } catch (e) {
                        // Ignore
                    }
                }
            });
        }, 200);

        return () => clearTimeout(retryTimeout);
    }, [participantInfos, nickname]);

    // [FIX] handleMotionCleared를 useCallback으로 감싸기
    // [FIX] handleMotionCleared를 useCallback으로 감싸기
    const handleMotionCleared = useCallback(() => {
        onMotionCleared?.();
        // setCountdown(3); // 카운트다운 제거 요청으로 삭제
    }, [onMotionCleared]);

    // [FIX] handleCapture를 useCallback으로 감싸기 - 선언 순서 수정
    const handleCapture = useCallback(async () => {
        if (captureStartedRef.current) return; // [FIX] 중복 호출 2중 방지
        captureStartedRef.current = true;

        setIsCapturing(true);

        try {
            const currentParticipants = allParticipants;
            const videoElements: (HTMLVideoElement | null)[] = currentParticipants
                .map(p => videoRefs.current.get(p.identity) || null);

            const captures = await captureAllParticipants(videoElements);

            onCaptureComplete?.(captures);
            setCaptureComplete(true);
        } catch (error) {
            console.error('[EndingMissionOverlay] Capture failed:', error);
        } finally {
            setIsCapturing(false);
        }
    }, [allParticipants, onCaptureComplete]);

    // 모든 참가자 포즈 인식 완료 시 자동 진행
    // [FIX] 모션 인식 성공 직전에 캡처 실행
    useEffect(() => {
        if (captureComplete) return;

        if (allCleared) {
            handleCapture(); // 캡처 먼저!
            handleMotionCleared(); // 모션 클리어 처리

            // 카운트다운 없이 2초 후 종료
            setTimeout(() => {
                onClose?.();
            }, 2000);
        }
    }, [allCleared, captureComplete, handleMotionCleared, handleCapture, onClose]);

    // 참가자별 포즈 상태 조회 (UI 표시용)
    const getDisplayState = useCallback((participant: ExtendedParticipant) => {
        // 더미는 항상 클리어 상태
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
                <h2 className={styles.title}>🎉 스테이지 클리어!</h2>

                {/* 로딩 표시 */}
                {!isLoaded && !captureComplete && (
                    <p className={styles.loadingText}>🔄 포즈 인식 준비 중...</p>
                )}

                {/* 카메라 그리드 */}
                <div className={styles.cameraGrid}>
                    {allParticipants.slice(0, 4).map((participant, index) => {
                        const participantInfo = !participant.isLocal
                            ? (participantInfos || []).find(p => p.identity === participant.identity)
                            : null;

                        const displayState = getDisplayState(participant);
                        const targetPose = poseAssignments.get(participant.identity);
                        const isDummy = participant.isDummy;

                        return (
                            <div
                                key={participant.identity}
                                className={`${styles.cameraBox} ${displayState?.isCleared ? styles.cleared : ''}`}
                                style={{ borderColor: displayState?.isCleared ? '#4CAF50' : PLAYER_COLORS[index] }}
                            >
                                {/* 목표 포즈 표시 (더미에게는 표시 안함) */}
                                {targetPose && !isDummy && (
                                    <div className={styles.targetPose}>
                                        <span className={styles.poseEmoji}>{targetPose.emoji}</span>
                                        <span className={styles.poseName}>{targetPose.label}</span>
                                    </div>
                                )}

                                {/* 더미 라벨 */}
                                {isDummy && (
                                    <div className={styles.targetPose}>
                                        <span className={styles.poseEmoji}>💤</span>
                                        <span className={styles.poseName}>대기 중</span>
                                    </div>
                                )}

                                {/* 비디오 */}
                                <video
                                    ref={(el) => handleVideoRef(el, participant.identity, participant.isLocal)}
                                    autoPlay
                                    muted={participant.isLocal}
                                    playsInline
                                    className={styles.video}
                                    style={{
                                        display: (!participant.isLocal && !participantInfo?.videoTrack) ? 'none' : 'block'
                                    }}
                                />

                                {/* 현재 감지 상태 표시 */}
                                {!isDummy && displayState?.currentGesture && !displayState.isCleared && (
                                    <div className={styles.detectionStatus}>
                                        감지: {displayState.currentGesture}
                                    </div>
                                )}

                                {/* 인식 완료 오버레이 */}
                                {displayState?.isCleared && (
                                    <div className={styles.clearedOverlay}>
                                        <span className={styles.checkmark}>{isDummy ? '💤' : '✅'}</span>
                                    </div>
                                )}

                                {/* 플레이어 라벨 */}
                                <span className={styles.playerLabel}>
                                    P{index + 1}: {participant.identity === nickname ? '나' : participant.identity}{isDummy ? ' (대기)' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* 상태 표시 */}
                <div className={styles.statusArea}>
                    {!captureComplete && (
                        <div className={styles.statusContainer}>
                            <p className={styles.statusText}>📸 각자 표시된 포즈를 취해주세요!</p>
                            <p className={styles.subStatusText}>
                                {/* 실제 참가자 기준 완료 수 */}
                                {allParticipants.filter(p => {
                                    if (p.isDummy) return false; // 더미는 카운트에서 제외
                                    if (p.isLocal) return participantStates.find(s => s.identity === p.identity)?.isCleared;
                                    return remoteStates.get(p.identity);
                                }).length} / {realParticipantCount} 완료
                            </p>
                        </div>
                    )}
                    {isCapturing && (
                        <p className={styles.statusText}>📷 촬영 중...</p>
                    )}
                    {captureComplete && (
                        <p className={styles.statusText}>✅ 촬영 완료!</p>
                    )}
                </div>
            </div>
        </div>
    );
}
