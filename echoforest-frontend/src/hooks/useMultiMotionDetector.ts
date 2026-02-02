/**
 * useMultiMotionDetector - 여러 비디오에 대한 포즈 감지 훅
 * 엔딩 미션에서 4명의 참가자 포즈를 동시에 감지
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import type { GestureResult, GestureMetadata } from '../components/motion/BaseGesture';
import type { PoseInfo } from '../utils/PoseManager';

// 제스처 클래스 imports
import BigHeartGesture from '../components/motion/BigHeartGesture';
import CatEarsGesture from '../components/motion/CatEarsGesture';
import CheekHeartGesture from '../components/motion/CheekHeartGesture';
import FistGesture from '../components/motion/FistGesture';
import HeartGesture from '../components/motion/HeartGesture';
import LGesture from '../components/motion/LGesture';
import OKGesture from '../components/motion/OKGesture';
import VSignGesture from '../components/motion/VSignGesture';
import KissGesture from '../components/motion/KissGesture';
import BothCheekPokeGesture from '../components/motion/BothCheekPokeGesture';
import FlowerPoseGesture from '../components/motion/FlowerPoseGesture';
import TalmoBeamGesture from '../components/motion/TalmoBeamGesture';

// 제스처 클래스 매핑
const GESTURE_CLASS_MAP: Record<string, new () => any> = {
    'VSignGesture': VSignGesture,
    'FistGesture': FistGesture,
    'OKGesture': OKGesture,
    'LGesture': LGesture,
    'HeartGesture': HeartGesture,
    'BigHeartGesture': BigHeartGesture,
    'CatEarsGesture': CatEarsGesture,
    'CheekHeartGesture': CheekHeartGesture,
    'KissGesture': KissGesture,
    'BothCheekPokeGesture': BothCheekPokeGesture,
    'FlowerPoseGesture': FlowerPoseGesture,
    'TalmoBeamGesture': TalmoBeamGesture,
};

export interface ParticipantPoseState {
    identity: string;
    targetPose: PoseInfo;
    isCleared: boolean;
    currentGesture: string | null;
    score: number;
}

export interface MultiMotionDetectorResult {
    isLoaded: boolean;
    participantStates: ParticipantPoseState[];
    allCleared: boolean;
}

interface UseMultiMotionDetectorProps {
    videoRefs: React.RefObject<Map<string, HTMLVideoElement | null>>;
    poseAssignments: Map<string, PoseInfo>;
    enabled?: boolean;
}

export function useMultiMotionDetector({
    videoRefs,
    poseAssignments,
    enabled = true
}: UseMultiMotionDetectorProps): MultiMotionDetectorResult {
    const [isLoaded, setIsLoaded] = useState(false);
    const [participantStates, setParticipantStates] = useState<ParticipantPoseState[]>([]);

    const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
    const faceLandmarkerRef = useRef<any>(null);
    const isLooping = useRef(false);
    const currentVideoIndex = useRef(0);

    // 각 참가자별 제스처 인스턴스 캐시
    const gestureInstancesRef = useRef<Map<string, any>>(new Map());

    // 초기 상태 설정
    useEffect(() => {
        const initialStates: ParticipantPoseState[] = [];
        poseAssignments.forEach((pose, identity) => {
            initialStates.push({
                identity,
                targetPose: pose,
                isCleared: false,
                currentGesture: null,
                score: 0
            });

            // 제스처 인스턴스 생성
            const GestureClass = GESTURE_CLASS_MAP[pose.gestureClass];
            if (GestureClass) {
                gestureInstancesRef.current.set(identity, new GestureClass());
            }
        });
        setParticipantStates(initialStates);
    }, [poseAssignments]);

    // MediaPipe 모델 로딩
    useEffect(() => {
        if (!enabled) return;

        const loadModels = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });

                const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
                faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                    outputFaceBlendshapes: true
                });

                setIsLoaded(true);
                console.log('[MultiMotionDetector] Models loaded');
            } catch (error) {
                console.error('[MultiMotionDetector] Failed to load models:', error);
            }
        };

        loadModels();

        return () => {
            isLooping.current = false;
            // MediaPipe 모델 리소스 해제 (메모리 누수 방지)
            if (gestureRecognizerRef.current) {
                gestureRecognizerRef.current.close();
                gestureRecognizerRef.current = null;
            }
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close();
                faceLandmarkerRef.current = null;
            }
        };
    }, [enabled]);

    // 감지 루프
    const detect = useCallback(async () => {
        if (!isLooping.current) return;
        if (!gestureRecognizerRef.current || !faceLandmarkerRef.current) {
            requestAnimationFrame(detect);
            return;
        }

        const videoMap = videoRefs.current;
        if (!videoMap || videoMap.size === 0) {
            requestAnimationFrame(detect);
            return;
        }

        const identities = Array.from(videoMap.keys());
        if (identities.length === 0) {
            requestAnimationFrame(detect);
            return;
        }

        // Round-robin으로 한 번에 하나씩 분석 (성능 최적화)
        const identity = identities[currentVideoIndex.current % identities.length];
        currentVideoIndex.current = (currentVideoIndex.current + 1) % identities.length;

        const video = videoMap.get(identity);
        if (!video || video.readyState !== 4) {
            requestAnimationFrame(detect);
            return;
        }

        try {
            const nowInMs = Date.now();

            // Hand Detection
            const handResult = gestureRecognizerRef.current.recognizeForVideo(video, nowInMs);

            // Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, nowInMs);

            // Metadata
            const aspectRatio = video.videoWidth / video.videoHeight || 1.0;
            const metadata: GestureMetadata = {
                palmSize: 0.1,
                aspectRatio,
                allHands: handResult.landmarks,
                faceLandmarks: faceResult.faceLandmarks?.[0],
                faceSize: 0.1
            };

            const gestureInstance = gestureInstancesRef.current.get(identity);
            // [FIX] 손 OR 얼굴이 감지되면 제스처 체크 (KissGesture 등 얼굴 기반 제스처 지원)
            const hasHands = handResult.landmarks.length > 0;
            const hasFace = faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0;

            if (gestureInstance && (hasHands || hasFace)) {
                // 손 랜드마크가 없으면 빈 배열 전달 (제스처 클래스에서 처리)
                const handLandmarks = hasHands ? handResult.landmarks[0] : [];
                const result: GestureResult = gestureInstance.check(handLandmarks, metadata);

                // [DEBUG] 인식 상태 로그 (개발 중 확인용)
                if (result.detected) {
                    console.log(`[MultiMotionDetector] ${identity}: ${result.label} (score: ${result.score.toFixed(2)})`);
                }

                setParticipantStates(prev => {
                    const updated = [...prev];
                    const idx = updated.findIndex(s => s.identity === identity);
                    if (idx !== -1) {
                        // 이미 클리어된 경우 상태 유지
                        if (!updated[idx].isCleared) {
                            updated[idx] = {
                                ...updated[idx],
                                currentGesture: result.detected ? result.label || null : null,
                                score: result.score,
                                // [FIX] 임계값 0.7 → 0.5로 낮춤 (인식률 향상)
                                isCleared: result.detected && result.score > 0.5
                            };
                        }
                    }
                    return updated;
                });
            }
        } catch (e) {
            console.error('[MultiMotionDetector] Detection error:', e);
        }

        // [FIX] 감지 주기 100ms → 50ms로 빠르게 (약 20fps)
        setTimeout(() => requestAnimationFrame(detect), 50);
    }, [videoRefs]);

    // 감지 루프 시작/중지
    useEffect(() => {
        if (isLoaded && enabled) {
            isLooping.current = true;
            detect();
        }
        return () => {
            isLooping.current = false;
        };
    }, [isLoaded, enabled, detect]);

    // 모든 참가자 클리어 여부
    const allCleared = participantStates.length > 0 &&
        participantStates.every(s => s.isCleared);

    return {
        isLoaded,
        participantStates,
        allCleared
    };
}
