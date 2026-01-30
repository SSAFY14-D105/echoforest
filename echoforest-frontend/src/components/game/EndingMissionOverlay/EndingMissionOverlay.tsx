/**
 * 엔딩 미션 오버레이 컴포넌트
 * 모든 플레이어가 골대에 도착했을 때 카메라 그리드를 표시
 */

import { useState, useEffect, useRef } from 'react';
import type { ParticipantInfo } from '../../../socket/LiveKitService';
import { liveKitService } from '../../../socket/LiveKitService';
import { captureAllParticipants } from '../../../utils/captureUtils';
import styles from './EndingMissionOverlay.module.css';

interface EndingMissionOverlayProps {
    /** 참가자 정보 (LiveKit) */
    participantInfos: ParticipantInfo[];
    /** 현재 유저 닉네임 */
    nickname: string;
    /** 모션 인식 완료 콜백 (플레이스홀더 - 추후 AI 통합) */
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
    onMotionCleared,
    onCaptureComplete,
    onClose
}: EndingMissionOverlayProps) {
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureComplete, setCaptureComplete] = useState(false);

    // 로컬 비디오 참조 (컴포넌트 내부에서 관리)
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    // 리모트 비디오 참조
    const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

    // 엔딩 미션 시작 시 720p로 해상도 변경 + 카메라 강제 켜기
    useEffect(() => {
        // 카메라 강제 켜기
        liveKitService.forceCameraOn();
        // 해상도 720p로 변경
        liveKitService.setVideoResolution('h720');

        return () => {
            // 정리 시 540p로 복원
            liveKitService.setVideoResolution('h540');
            // 카메라 상태 복원 (사용자가 꺼둔 경우 다시 끄기)
            liveKitService.restoreCameraState();
        };
    }, []);

    // 로컬 비디오를 LiveKitService에 등록 (CameraArea와 동일한 패턴)
    useEffect(() => {
        if (localVideoRef.current) {
            // 이전 CameraArea의 비디오 엘리먼트 대신 이 엘리먼트로 교체
            liveKitService.setLocalVideoElement(localVideoRef.current);
        }
    }, []);

    // 리모트 비디오 트랙 연결
    useEffect(() => {
        participantInfos.forEach(info => {
            if (info.identity === nickname) return;
            const videoEl = remoteVideoRefs.current[info.identity];
            if (videoEl && info.videoTrack) {
                info.videoTrack.attach(videoEl);
            }
        });
    }, [participantInfos, nickname]);

    // 모션 인식 플레이스홀더 (데모용 자동 타이머)
    useEffect(() => {
        // TODO: 실제 AI 모션 인식 로직으로 교체
        // 현재는 데모용으로 5초 후 자동 완료
        const timer = setTimeout(() => {
            handleMotionCleared();
        }, 5000);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            // 모든 비디오 엘리먼트 수집
            const videoElements: (HTMLVideoElement | null)[] = [
                localVideoRef.current,
                ...Object.values(remoteVideoRefs.current)
            ];

            //     console.log('[EndingMissionOverlay] Video elements collected:', videoElements.length);
            //     console.log('[EndingMissionOverlay] Video element details:', videoElements.map((el, i) => ({
        //         index: i,
            //         exists: !!el,
        //         videoWidth: el?.videoWidth,
        //         videoHeight: el?.videoHeight,
        //         readyState: el?.readyState
        //     })));

            const captures = await captureAllParticipants(videoElements);

            // console.log('[EndingMissionOverlay] Captures result:', captures.length, 'blobs');
            // captures.forEach((blob, i) => {
            //     console.log(`[EndingMissionOverlay] Blob ${i}: size=${blob.size}, type=${blob.type}`);
            // });

            onCaptureComplete?.(captures);
            setCaptureComplete(true);

            // 2초 후 오버레이 닫기
            setTimeout(() => {
                onClose?.();
            }, 2000);
        } catch (error) {
            console.error('[EndingMissionOverlay] Capture failed:', error);
        } finally {
            setIsCapturing(false);
        }
    };

    // 참가자 목록 (로컬 + 리모트)
    const allParticipants = [
        { identity: nickname, isLocal: true },
        ...participantInfos.filter(p => p.identity !== nickname).map(p => ({ ...p, isLocal: false }))
    ];

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <h2 className={styles.title}>🎉 스테이지 클리어!</h2>

                {/* 카메라 그리드 */}
                <div className={styles.cameraGrid}>
                    {allParticipants.slice(0, 4).map((participant, index) => {
                        const participantInfo = !participant.isLocal
                            ? participantInfos.find(p => p.identity === participant.identity)
                            : null;

                        return (
                            <div
                                key={participant.identity}
                                className={styles.cameraBox}
                                style={{ borderColor: PLAYER_COLORS[index] }}
                            >
                                {participant.isLocal ? (
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className={styles.video}
                                    />
                                ) : (
                                    <video
                                        ref={el => {
                                            if (el) remoteVideoRefs.current[participant.identity] = el;
                                        }}
                                        autoPlay
                                        playsInline
                                        className={styles.video}
                                        style={{
                                            display: participantInfo?.videoTrack ? 'block' : 'none'
                                        }}
                                    />
                                )}
                                <span className={styles.playerLabel}>
                                    P{index + 1}: {participant.isLocal ? '나' : participant.identity}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* 상태 표시 */}
                <div className={styles.statusArea}>
                    {countdown === null && !captureComplete && (
                        <p className={styles.statusText}>📸 포즈를 취해주세요!</p>
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
