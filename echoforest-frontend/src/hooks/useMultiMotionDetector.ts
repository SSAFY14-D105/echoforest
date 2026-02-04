import { useRef, useState, useEffect, useCallback } from 'react';
import { FilesetResolver, GestureRecognizer, FaceLandmarker } from '@mediapipe/tasks-vision';
import PoseManager, { PoseInfo } from '../utils/PoseManager';
import { calculateDistances, distance } from '../utils/gesture-helpers';

/**
 * useMultiMotionDetector - 여러 비디오에 대한 포즈 감지 훅
 */
export default function useMultiMotionDetector() {
    const [isLoaded, setIsLoaded] = useState(false);
    const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const poseManagerRef = useRef<PoseManager | null>(null);

    // 포즈 감지 상태 저장 (userId -> pose)
    const [detectedPoses, setDetectedPoses] = useState<Map<string, PoseInfo>>(new Map());

    useEffect(() => {
        const load = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );

            gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });

            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numFaces: 1
            });

            poseManagerRef.current = new PoseManager();
            setIsLoaded(true);
        };

        load();
    }, []);

    // 디버그용: 각 유저별 모든 제스처 인식 결과 (점수 포함)
    const [debugInfo, setDebugInfo] = useState<Map<string, any[]>>(new Map());

    const detectPose = useCallback((video: HTMLVideoElement, userId: string) => {
        if (!gestureRecognizerRef.current || !faceLandmarkerRef.current || !poseManagerRef.current || !video || video.readyState < 2) return;

        try {
            const timestamp = Date.now();
            const results = gestureRecognizerRef.current.recognizeForVideo(video, timestamp);
            const faceResults = faceLandmarkerRef.current.detectForVideo(video, timestamp);

            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0] as any[]; // 첫 번째 손
                const allHands = results.landmarks; // 전체 손

                // 얼굴 랜드마크 추출
                const faceLandmarks = faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0
                    ? faceResults.faceLandmarks[0]
                    : undefined;

                // 얼굴 크기 계산 (이마-턱)
                let faceSize = undefined;
                if (faceLandmarks) {
                    faceSize = distance(faceLandmarks[10], faceLandmarks[152]);
                }

                const metadata = {
                    palmSize: 0,
                    allHands: allHands,
                    aspectRatio: video.videoWidth / video.videoHeight,
                    faceLandmarks: faceLandmarks,
                    faceSize: faceSize
                };

                const pose = poseManagerRef.current.detect(landmarks, metadata);

                // [DEBUG] 모든 제스처 결과 가져오기
                const details = poseManagerRef.current.detectWithDetails(landmarks, metadata);

                setDebugInfo(prev => {
                    const newMap = new Map(prev);
                    newMap.set(userId, details);
                    return newMap;
                });

                if (pose) {
                    setDetectedPoses(prev => {
                        const newMap = new Map(prev);
                        newMap.set(userId, pose);
                        return newMap;
                    });
                } else {
                    // 감지된 제스처가 없음 -> 해당 유저 삭제
                    setDetectedPoses(prev => {
                        const newMap = new Map(prev);
                        if (newMap.has(userId)) {
                            newMap.delete(userId);
                            return newMap;
                        }
                        return prev;
                    });
                }
            } else {
                // 손이 감지되지 않음 -> 해당 유저 삭제 및 디버그 정보 초기화
                setDetectedPoses(prev => {
                    const newMap = new Map(prev);
                    if (newMap.has(userId)) {
                        newMap.delete(userId);
                        return newMap;
                    }
                    return prev;
                });
                setDebugInfo(prev => {
                    const newMap = new Map(prev);
                    if (newMap.has(userId)) newMap.delete(userId);
                    return newMap;
                });
            }
        } catch (e) {
            console.error("Pose detection error:", e);
        }
    }, [isLoaded]);

    return { isLoaded, detectPose, detectedPoses, poseManager: poseManagerRef.current, debugInfo };
}
