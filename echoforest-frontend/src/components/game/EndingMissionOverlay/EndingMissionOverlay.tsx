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

    // 비디오 refs를 Map으로 관리
    const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

    // 참가자 목록 (로컬 + 리모트) - 4명이 부족하면 테스트용 더미로 채움
    const allParticipants = useMemo(() => {
        const real = [
            { identity: nickname, isLocal: true },
            ...participantInfos.filter(p => p.identity !== nickname).map(p => ({ ...p, isLocal: false }))
        ];

        // 4명 미만일 경우 더미(Bot) 추가 (테스트용, 로컬 비디오 공유)
        if (real.length < 4) {
            const dummies = Array(4 - real.length).fill(null).map((_, i) => ({
                identity: `Dev_Bot_${i + 1}`,
                isLocal: true, // 로컬 비디오 공유
                isDummy: true // 더미 표시용
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

    // 멀티 모션 감지 훅
    const { isLoaded, participantStates, allCleared } = useMultiMotionDetector({
        videoRefs,
        poseAssignments,
        enabled: countdown === null && !captureComplete
    });

    // 엔딩 미션 시작 시 720p로 해상도 변경 + 카메라 강제 켜기
    useEffect(() => {
        liveKitService.forceCameraOn();
        liveKitService.setVideoResolution('h720');

        return () => {
            liveKitService.setVideoResolution('h540');
            liveKitService.restoreCameraState();
        };
    }, []);

    // 비디오 엘리먼트 Ref 콜백 (생성 즉시 연결)
    const handleVideoRef = useCallback((el: HTMLVideoElement | null, identity: string, isLocal: boolean) => {
        if (el) {
            videoRefs.current.set(identity, el);

            if (isLocal) {
                // 로컬 비디오 (나 또는 더미) - LiveKitService의 attachLocalVideo 활용
                liveKitService.attachLocalVideo(el);
            } else {
                // 리모트 비디오
                const info = participantInfos.find(p => p.identity === identity);
                if (info && info.videoTrack) {
                    info.videoTrack.attach(el);
                }
            }
        } else {
            // 언마운트 시 정리
            videoRefs.current.delete(identity);

            // cleanup (선택적)
            if (isLocal) {
                // detach 로직이 필요하다면 liveKitService에 추가 필요하지만, 
                // 보통 엘리먼트가 사라지면 브라우저가 알아서 처리하거나 
                // liveKitService.detachLocalVideo(el) 호출 가능
            }
        }
    }, [participantInfos]);

    // 모든 참가자 포즈 인식 완료 시 자동 진행
    useEffect(() => {
        // 이미 카운트다운 중이거나 캡처 완료된 경우 무시
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
            // 현재 화면에 렌더링된 비디오 엘리먼트들 수집 (순서 보장 위해 allParticipants 순회)
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

    // 참가자별 포즈 상태 조회
    const getParticipantState = (identity: string) => {
        return participantStates.find(s => s.identity === identity);
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
                        const poseState = getParticipantState(participant.identity);
                        const targetPose = poseAssignments.get(participant.identity);

                        return (
                            <div
                                key={participant.identity}
                                className={`${styles.cameraBox} ${poseState?.isCleared ? styles.cleared : ''}`}
                                style={{ borderColor: poseState?.isCleared ? '#4CAF50' : PLAYER_COLORS[index] }}
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
                                        // 리모트이면서 비디오 트랙이 없으면 숨김 (더미가 아닌 경우만)
                                        display: (!participant.isLocal && !participantInfo?.videoTrack) ? 'none' : 'block'
                                    }}
                                />

                                {/* 현재 감지 상태 표시 */}
                                {poseState?.currentGesture && !poseState.isCleared && (
                                    <div className={styles.detectionStatus}>
                                        감지: {poseState.currentGesture}
                                    </div>
                                )}

                                {/* 인식 완료 오버레이 */}
                                {poseState?.isCleared && (
                                    <div className={styles.clearedOverlay}>
                                        <span className={styles.checkmark}>✅</span>
                                    </div>
                                )}

                                {/* 플레이어 라벨 */}
                                <span className={styles.playerLabel}>
                                    P{index + 1}: {participant.isLocal ? (participant.identity.startsWith('Dev_Bot') ? 'Bot (Test)' : '나') : participant.identity}
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
                                {participantStates.filter(s => s.isCleared).length} / {participantStates.length} 완료
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
