/**
 * 모션 인식 테스트 페이지
 * MediaPipe 손 인식 및 손하트 감지 테스트용
 */

import { useEffect, useRef, useState } from 'react';
import { motionService, type PoseDetectionResult } from '../../services/motion';
import styles from './MotionTestPage.module.css';

export default function MotionTestPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [lastPose, setLastPose] = useState<PoseDetectionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // MediaPipe 초기화
    const handleInitialize = async () => {
        try {
            setError(null);
            await motionService.initialize();
            setIsInitialized(true);
            console.log('✅ MediaPipe initialized');
        } catch (err) {
            setError('MediaPipe 초기화 실패: ' + (err as Error).message);
        }
    };

    // 카메라 시작
    const handleStartCamera = async () => {
        if (!videoRef.current) return;

        try {
            setError(null);
            await motionService.startCamera(videoRef.current);
            console.log('✅ Camera started');
        } catch (err) {
            setError('카메라 접근 실패: ' + (err as Error).message);
        }
    };

    // 감지 시작
    const handleStartDetection = () => {
        motionService.startDetection((result) => {
            setLastPose(result);
            console.log('🎯 Pose detected:', result.type, result.confidence);
        });
        setIsRunning(true);
    };

    // 정리
    useEffect(() => {
        return () => {
            motionService.stop();
        };
    }, []);

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>🖐️ 모션 인식 테스트</h1>

            {/* 에러 표시 */}
            {error && <div className={styles.error}>{error}</div>}

            {/* 비디오 영역 */}
            <div className={styles.videoWrapper}>
                <video
                    ref={videoRef}
                    className={styles.video}
                    autoPlay
                    playsInline
                    muted
                />

                {/* 포즈 감지 오버레이 */}
                {lastPose && lastPose.type !== 'none' && (
                    <div className={styles.poseOverlay}>
                        <span className={styles.heartIcon}>💖</span>
                        <span className={styles.poseLabel}>
                            {lastPose.type === 'hand_heart' ? '손하트 감지!' : lastPose.type}
                        </span>
                        <span className={styles.confidence}>
                            신뢰도: {(lastPose.confidence * 100).toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>

            {/* 컨트롤 버튼 */}
            <div className={styles.controls}>
                <button
                    onClick={handleInitialize}
                    disabled={isInitialized}
                    className={styles.button}
                >
                    {isInitialized ? '✅ 초기화 완료' : '1️⃣ MediaPipe 초기화'}
                </button>

                <button
                    onClick={handleStartCamera}
                    disabled={!isInitialized}
                    className={styles.button}
                >
                    2️⃣ 카메라 시작
                </button>

                <button
                    onClick={handleStartDetection}
                    disabled={!isInitialized || isRunning}
                    className={styles.button}
                >
                    {isRunning ? '🔴 감지 중...' : '3️⃣ 감지 시작'}
                </button>
            </div>

            {/* 상태 표시 */}
            <div className={styles.status}>
                <p>📊 상태: {isRunning ? '🟢 감지 중' : '⚪ 대기'}</p>
                <p>🖐️ 마지막 포즈: {lastPose?.type || 'none'}</p>
                <p>📈 신뢰도: {lastPose ? (lastPose.confidence * 100).toFixed(0) + '%' : '-'}</p>
            </div>

            {/* 사용 가이드 */}
            <div className={styles.guide}>
                <h3>📖 손하트 만드는 법</h3>
                <p>엄지와 검지 끝을 붙여서 하트 모양을 만들어 보세요!</p>
                <p>👆 + 👍 → 💖</p>
            </div>
        </div>
    );
}
