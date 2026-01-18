/**
 * 모션 카메라 컴포넌트
 * 카메라 스트림 + 제스처 감지를 담당합니다.
 * 
 * 사용법:
 * <MotionCamera onGestureDetected={(gesture) => console.log(gesture)} />
 */

import { useEffect, useRef, useState } from 'react';
import styles from './MotionCamera.module.css';

// MediaPipe CDN에서 동적 로드
let handLandmarker: any = null;
let faceLandmarker: any = null;

interface Gesture {
    type: 'fist' | 'ok_sign' | 'L' | 'V' | 'E' | 'kiss' | 'none';
    confidence: number;
}

interface MotionCameraProps {
    onGestureDetected?: (gesture: Gesture) => void;
    showOverlay?: boolean;
}

export default function MotionCamera({
    onGestureDetected,
    showOverlay = true
}: MotionCameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [currentGesture, setCurrentGesture] = useState<Gesture | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 유틸리티 함수들
    const distance = (p1: any, p2: any) => {
        return Math.sqrt(
            (p1.x - p2.x) ** 2 +
            (p1.y - p2.y) ** 2 +
            ((p1.z || 0) - (p2.z || 0)) ** 2
        );
    };

    const isFingerClosed = (landmarks: any[], tipIdx: number, mcpIdx: number) => {
        const wrist = landmarks[0];
        return distance(landmarks[tipIdx], wrist) < distance(landmarks[mcpIdx], wrist) * 1.1;
    };

    const isFingerExtended = (landmarks: any[], tipIdx: number, pipIdx: number) => {
        const wrist = landmarks[0];
        return distance(landmarks[tipIdx], wrist) > distance(landmarks[pipIdx], wrist) * 1.05;
    };

    // 제스처 감지 함수들
    const detectFist = (landmarks: any[]) => {
        const closed = [
            isFingerClosed(landmarks, 4, 2),
            isFingerClosed(landmarks, 8, 5),
            isFingerClosed(landmarks, 12, 9),
            isFingerClosed(landmarks, 16, 13),
            isFingerClosed(landmarks, 20, 17),
        ];
        const count = closed.filter(Boolean).length;
        if (count >= 5) return 0.95;
        if (count >= 4) return 0.8;
        return 0;
    };

    const detectOK = (landmarks: any[]) => {
        const palmSize = distance(landmarks[0], landmarks[9]);
        const tipDist = distance(landmarks[4], landmarks[8]) / palmSize;
        if (tipDist < 0.18) return 0.95;
        if (tipDist < 0.28) return 0.75;
        return 0;
    };

    const detectV = (landmarks: any[]) => {
        const thumbClosed = isFingerClosed(landmarks, 4, 2);
        const indexExt = isFingerExtended(landmarks, 8, 7);
        const middleExt = isFingerExtended(landmarks, 12, 11);
        const ringClosed = isFingerClosed(landmarks, 16, 13);
        const pinkyClosed = isFingerClosed(landmarks, 20, 17);

        if (thumbClosed && indexExt && middleExt && ringClosed && pinkyClosed) {
            return 0.9;
        }
        return 0;
    };

    const detectGesture = (handLandmarks: any[], faceLandmarks: any[]): Gesture => {
        if (handLandmarks && handLandmarks.length > 0) {
            const hand = handLandmarks[0];

            const fist = detectFist(hand);
            if (fist >= 0.75) return { type: 'fist', confidence: fist };

            const ok = detectOK(hand);
            if (ok >= 0.7) return { type: 'ok_sign', confidence: ok };

            const v = detectV(hand);
            if (v >= 0.75) return { type: 'V', confidence: v };
        }

        return { type: 'none', confidence: 0 };
    };

    // 초기화
    useEffect(() => {
        const init = async () => {
            try {
                // MediaPipe 동적 로드
                const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest' as any);
                const { FilesetResolver, HandLandmarker } = vision;

                const filesetResolver = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );

                handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numHands: 2
                });

                setIsInitialized(true);
                console.log('[MotionCamera] MediaPipe initialized');
            } catch (err) {
                setError('MediaPipe 로드 실패');
                console.error(err);
            }
        };

        init();

        return () => {
            // 정리
            if (videoRef.current?.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, []);

    // 카메라 시작
    useEffect(() => {
        if (!isInitialized || !videoRef.current) return;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, facingMode: 'user' }
                });
                videoRef.current!.srcObject = stream;
                await videoRef.current!.play();
                setIsRunning(true);
                console.log('[MotionCamera] Camera started');
            } catch (err) {
                setError('카메라 접근 실패');
            }
        };

        startCamera();
    }, [isInitialized]);

    // 감지 루프
    useEffect(() => {
        if (!isRunning || !handLandmarker || !videoRef.current) return;

        let animationId: number;
        let lastGestureTime = 0;

        const detectFrame = () => {
            const now = performance.now();
            const results = handLandmarker.detectForVideo(videoRef.current, now);

            const gesture = detectGesture(results?.landmarks, []);

            if (gesture.type !== 'none' && now - lastGestureTime > 500) {
                setCurrentGesture(gesture);
                onGestureDetected?.(gesture);
                lastGestureTime = now;

                // 1초 후 오버레이 숨기기
                setTimeout(() => setCurrentGesture(null), 1000);
            }

            animationId = requestAnimationFrame(detectFrame);
        };

        detectFrame();

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
        };
    }, [isRunning, onGestureDetected]);

    const getGestureEmoji = (type: string) => {
        const emojis: Record<string, string> = {
            fist: '✊',
            ok_sign: '👌',
            V: '✌️',
            L: '👆',
            E: '🤟',
            kiss: '💋',
        };
        return emojis[type] || '';
    };

    return (
        <div className={styles.container}>
            <video
                ref={videoRef}
                className={styles.video}
                autoPlay
                playsInline
                muted
            />

            {/* 상태 표시 */}
            {!isInitialized && <div className={styles.status}>로딩중...</div>}
            {error && <div className={styles.error}>{error}</div>}

            {/* 제스처 오버레이 */}
            {showOverlay && currentGesture && currentGesture.type !== 'none' && (
                <div className={styles.gestureOverlay}>
                    <span className={styles.emoji}>{getGestureEmoji(currentGesture.type)}</span>
                </div>
            )}
        </div>
    );
}
