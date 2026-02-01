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
    participantInfos,
    nickname,
    roomId = 'default-room',
    onMotionCleared,
    onCaptureComplete,
    onClose
}: EndingMissionOverlayProps) {
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureComplete, setCaptureComplete] = useState(false);

    // 리모트 참가자의 클리어 상태 관리
    const [remoteStates, setRemoteStates] = useState<Map<string, boolean>>(new Map());

    // 클리어 메시지 전송 여부 추적 (중복 전송 방지)
    const clearedSentRef = useRef<Set<string>>(new Set());

    // 비디오 refs를 Map으로 관리
    const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map()); // 전체 (UI/캡처용)
    const localVideoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map()); // 감지용 (나 + 더미)

    // 참가자 목록 (로컬 + 리모트) - 항상 4명 채우기 (빈 자리는 더미/봇으로)
    const allParticipants = useMemo(() => {
        const real = [
            { identity: nickname, isLocal: true },
            ...participantInfos.filter(p => p.identity !== nickname).map(p => ({ ...p, isLocal: false }))
        ];

        // 4명 미만일 경우 더미(Waiting Player) 추가하여 4분할 유지
        if (real.length < 4) {
            const dummies = Array(4 - real.length).fill(null).map((_, i) => ({
                identity: `Waiting Player ${real.length + i + 1}`,
                isLocal: true, // 로컬 비디오 공유 (테스트용)
                isDummy: true
            }));
            return [...real, ...dummies];
        }
        return real.slice(0, 4);
    }, [participantInfos, nickname]);

    // roomId 기반으로 각 참가자에게 포즈 할당
    const poseAssignments = useMemo(() => {
        const identities = allParticipants.slice(0, 4).map(p => p.identity);
        return assignPosesToParticipants(identities, roomId);
    }, [allParticipants, roomId]);

    // 멀티 모션 감지 훅 (내 비디오만 감지하도록 localVideoRefs 전달)
    const { isLoaded, participantStates } = useMultiMotionDetector({
        videoRefs: localVideoRefs,
        poseAssignments,
        enabled: countdown === null && !captureComplete
    });

    // DataChannel 수신 (리모트 클리어 상태 업데이트)
    useEffect(() => {
        return liveKitService.onDataReceived((payload, participant) => {
            if (!participant) return;
            try {
                const message = new TextDecoder().decode(payload);
                if (message === 'POSE_CLEARED') {
                    console.log(`[EndingMissionOverlay] Remote cleared: ${participant.identity}`);
                    setRemoteStates(prev => new Map(prev).set(participant.identity, true));
                }
            } catch (e) {
                console.error('[EndingMissionOverlay] Data decode error:', e);
            }
        });
    }, []);

    // 내 포즈 클리어 시 브로드캐스트
    useEffect(() => {
        participantStates.forEach(state => {
            // 본인확인: 닉네임 일치 & 클리어됨 & 아직 전송 안함
            if (state.identity === nickname && state.isCleared && !clearedSentRef.current.has(nickname)) {
                console.log(`[EndingMissionOverlay] Local cleared! Broadcasting...`);
                liveKitService.sendData('POSE_CLEARED');
                clearedSentRef.current.add(nickname);
            }
        });
    }, [participantStates, nickname]);

    // 전체 클리어 여부 계산 (내 상태 + 리모트 상태)
    const allCleared = useMemo(() => {
        const targets = allParticipants.slice(0, 4);
        if (targets.length === 0) return false;

        return targets.every(p => {
            if (p.isLocal) {
                // 로컬(나/더미): 감지 결과 확인
                return participantStates.find(s => s.identity === p.identity)?.isCleared;
            } else {
                // 리모트: 수신된 상태 확인
                return remoteStates.get(p.identity);
            }
        });
    }, [allParticipants, participantStates, remoteStates]);

    // 엔딩 미션 시작 시 720p로 해상도 변경 + 카메라 강제 켜기
    useEffect(() => {
        liveKitService.forceCameraOn();
        liveKitService.setVideoResolution('h720');

        return () => {
            liveKitService.setVideoResolution('h540');
            liveKitService.restoreCameraState();
        };
    }, []);

    // 비디오 엘리먼트 Ref 콜백
    const handleVideoRef = useCallback((el: HTMLVideoElement | null, identity: string, isLocal: boolean) => {
        if (el) {
            videoRefs.current.set(identity, el);

            if (isLocal) {
                // 감지용 Map에도 추가
                localVideoRefs.current.set(identity, el);
                liveKitService.attachLocalVideo(el);
            } else {
                // 리모트 비디오 연결
                const info = participantInfos.find(p => p.identity === identity);
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

    // 리모트 비디오 트랙 재연결 (participantInfos 업데이트 시)
    useEffect(() => {
        participantInfos.forEach(info => {
            if (info.identity === nickname) return;
            const videoEl = videoRefs.current.get(info.identity);
            if (videoEl && info.videoTrack) {
                info.videoTrack.attach(videoEl);
            }
        });
    }, [participantInfos, nickname]);

    // 모든 참가자 포즈 인식 완료 시 자동 진행
    useEffect(() => {
        if (countdown !== null || captureComplete) return;

        if (allCleared) {
            console.log('[EndingMissionOverlay] All poses cleared!');
            handleMotionCleared();
        }
    }, [allCleared, countdown, captureComplete]);

    const handleMotionCleared = () => {
        onMotionCleared?.();
        startCountdown();
    };

    const startCountdown = () => {
        setCountdown(3);
    };

    useEffect(() => {
        if (countdown === null) return;

        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            handleCapture();
        }
    }, [countdown]);

    const handleCapture = async () => {
        setIsCapturing(true);

        try {
            const videoElements: (HTMLVideoElement | null)[] = allParticipants
                .map(p => videoRefs.current.get(p.identity) || null);

            const captures = await captureAllParticipants(videoElements);

            onCaptureComplete?.(captures);
            setCaptureComplete(true);

            setTimeout(() => {
                onClose?.();
            }, 2000);
        } catch (error) {
            console.error('[EndingMissionOverlay] Capture failed:', error);
        } finally {
            setIsCapturing(false);
        }
    };

    // 참가자별 포즈 상태 조회 (UI 표시용)
    const getDisplayState = (participant: any) => {
        if (participant.isLocal) {
            return participantStates.find(s => s.identity === participant.identity);
        } else {
            // 리모트 유저는 클리어 여부만 알 수 있음 (제스처 이름 등은 모름)
            const isRemoteCleared = remoteStates.get(participant.identity);
            return {
                isCleared: isRemoteCleared,
                currentGesture: isRemoteCleared ? '성공!' : null,
                score: isRemoteCleared ? 1 : 0
            };
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <h2 className={styles.title}>🎉 스테이지 클리어!</h2>

                {/* 로딩 표시 */}
                {!isLoaded && countdown === null && (
                    <p className={styles.loadingText}>🔄 포즈 인식 준비 중...</p>
                )}

                {/* 카메라 그리드 */}
                <div className={styles.cameraGrid}>
                    {allParticipants.slice(0, 4).map((participant, index) => {
                        const participantInfo = !participant.isLocal
                            ? participantInfos.find(p => p.identity === participant.identity)
                            : null;

                        const displayState = getDisplayState(participant);
                        const targetPose = poseAssignments.get(participant.identity);
                        const isDummy = (participant as any).isDummy;

                        return (
                            <div
                                key={participant.identity}
                                className={`${styles.cameraBox} ${displayState?.isCleared ? styles.cleared : ''}`}
                                style={{ borderColor: displayState?.isCleared ? '#4CAF50' : PLAYER_COLORS[index] }}
                            >
                                {/* 목표 포즈 표시 */}
                                {targetPose && (
                                    <div className={styles.targetPose}>
                                        <span className={styles.poseEmoji}>{targetPose.emoji}</span>
                                        <span className={styles.poseName}>{targetPose.name}</span>
                                    </div>
                                )}

                                {/* 비디오 */}
                                <video
                                    ref={(el) => handleVideoRef(el, participant.identity, participant.isLocal || false)}
                                    autoPlay
                                    muted={participant.isLocal} // 로컬(본인/더미)은 뮤트
                                    playsInline
                                    className={styles.video}
                                    style={{
                                        // 리모트이면서 비디오 트랙이 없으면 숨김
                                        display: (!participant.isLocal && !participantInfo?.videoTrack) ? 'none' : 'block'
                                    }}
                                />

                                {/* 현재 감지 상태 표시 (로컬만 상세 표시) */}
                                {displayState?.currentGesture && !displayState.isCleared && (
                                    <div className={styles.detectionStatus}>
                                        감지: {displayState.currentGesture}
                                    </div>
                                )}

                                {/* 인식 완료 오버레이 */}
                                {displayState?.isCleared && (
                                    <div className={styles.clearedOverlay}>
                                        <span className={styles.checkmark}>✅</span>
                                    </div>
                                )}

                                {/* 플레이어 라벨 */}
                                <span className={styles.playerLabel}>
                                    P{index + 1}: {participant.identity === nickname ? '나' : participant.identity}{isDummy ? ' (Test)' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* 상태 표시 */}
                <div className={styles.statusArea}>
                    {countdown === null && !captureComplete && (
                        <div className={styles.statusContainer}>
                            <p className={styles.statusText}>📸 각자 표시된 포즈를 취해주세요!</p>
                            <p className={styles.subStatusText}>
                                {/* 완료된 인원 수 계산 */}
                                {allParticipants.filter(p => {
                                    if (p.isLocal) return participantStates.find(s => s.identity === p.identity)?.isCleared;
                                    return remoteStates.get(p.identity);
                                }).length} / 4 완료
                            </p>
                        </div>
                    )}
                    {countdown !== null && countdown > 0 && (
                        <div className={styles.countdown}>{countdown}</div>
                    )}
                    {countdown === 0 && isCapturing && (
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
