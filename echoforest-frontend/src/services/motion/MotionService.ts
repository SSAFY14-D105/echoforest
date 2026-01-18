/**
 * 모션 인식 서비스
 * MediaPipe Hand Landmarker를 사용하여 실시간 손 인식을 수행합니다.
 */

import {
    FilesetResolver,
    HandLandmarker,
    type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { detectPose } from './PoseDetector';
import type { MotionServiceState, PoseDetectionResult, HandLandmark } from './types';

export class MotionService {
    private handLandmarker: HandLandmarker | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private isRunning = false;
    private animationFrameId: number | null = null;
    private onPoseDetected: ((result: PoseDetectionResult) => void) | null = null;

    /**
     * 서비스 초기화 - MediaPipe 모델 로딩
     */
    async initialize(): Promise<void> {
        console.log('[MotionService] Initializing...');

        try {
            // WASM 파일 로드
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
            );

            // Hand Landmarker 생성
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    delegate: 'GPU', // GPU 가속 사용
                },
                runningMode: 'VIDEO',
                numHands: 2, // 양손 감지
            });

            console.log('[MotionService] Hand Landmarker initialized successfully');
        } catch (error) {
            console.error('[MotionService] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * 카메라 스트림 시작
     */
    async startCamera(videoElement: HTMLVideoElement): Promise<void> {
        this.videoElement = videoElement;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                },
            });

            this.videoElement.srcObject = stream;
            await this.videoElement.play();

            console.log('[MotionService] Camera started');
        } catch (error) {
            console.error('[MotionService] Camera access failed:', error);
            throw error;
        }
    }

    /**
     * 모션 감지 루프 시작
     */
    startDetection(onPoseDetected: (result: PoseDetectionResult) => void): void {
        if (!this.handLandmarker || !this.videoElement) {
            console.error('[MotionService] Not initialized or no video element');
            return;
        }

        this.onPoseDetected = onPoseDetected;
        this.isRunning = true;
        this.detectFrame();
    }

    /**
     * 프레임별 손 감지 수행
     */
    private detectFrame(): void {
        if (!this.isRunning || !this.handLandmarker || !this.videoElement) {
            return;
        }

        const startTimeMs = performance.now();
        const results: HandLandmarkerResult = this.handLandmarker.detectForVideo(
            this.videoElement,
            startTimeMs
        );

        // 손이 감지되었으면 포즈 판정
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0] as HandLandmark[];
            const poseResult = detectPose(landmarks);

            if (poseResult.type !== 'none' && this.onPoseDetected) {
                this.onPoseDetected(poseResult);
            }
        }

        // 다음 프레임 예약
        this.animationFrameId = requestAnimationFrame(() => this.detectFrame());
    }

    /**
     * 모션 감지 중지
     */
    stop(): void {
        this.isRunning = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // 카메라 스트림 정리
        if (this.videoElement?.srcObject) {
            const tracks = (this.videoElement.srcObject as MediaStream).getTracks();
            tracks.forEach((track) => track.stop());
            this.videoElement.srcObject = null;
        }

        console.log('[MotionService] Stopped');
    }

    /**
     * 서비스 상태 반환
     */
    getState(): MotionServiceState {
        return {
            isInitialized: this.handLandmarker !== null,
            isRunning: this.isRunning,
            lastPose: null,
            error: null,
        };
    }
}

// 싱글톤 인스턴스
export const motionService = new MotionService();
