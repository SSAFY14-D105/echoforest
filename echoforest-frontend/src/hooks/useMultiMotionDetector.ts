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

    const detectPose = useCallback((video: HTMLVideoElement, userId: string) => {
        if (!gestureRecognizerRef.current || !faceLandmarkerRef.current || !poseManagerRef.current || !video || video.readyState < 2) return;

        try {
            const timestamp = Date.now();
            const results = gestureRecognizerRef.current.recognizeForVideo(video, timestamp);
            const faceResults = faceLandmarkerRef.current.detectForVideo(video, timestamp);

            if (results.landmarks && results.landmarks.length > 0) {
                // MediaPipe 결과를 PoseManager에 전달하기 위한 메타데이터 구성
                // 주요 랜드마크 0번째 손 기준 (싱글 제스처) 또는 양손
                // BaseGesture.ts에서 정의한 인터페이스에 맞춤

                const landmarks = results.landmarks[0] as any[]; // 첫 번째 손
                const allHands = results.landmarks; // 전체 손

                // 손바닥 크기 계산 (손목 0 ~ 중지뿌리 9)
                // 타입 변환 필요 (x, y, z)

                // 얼굴 랜드마크 추출
                const faceLandmarks = faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0
                    ? faceResults.faceLandmarks[0]
                    : undefined;

                // 얼굴 크기 계산 (이마-턱)
                let faceSize = undefined;
                if (faceLandmarks) {
                    // 10: 이마 상단, 152: 턱 끝
                    // distance 함수는 {x,y,z} 객체를 받음. MediaPipe 결과는 객체 배열임.
                    faceSize = distance(faceLandmarks[10], faceLandmarks[152]);
                }

                const metadata = {
                    palmSize: 0, // 내부 계산 또는 생략 가능
                    allHands: allHands,
                    aspectRatio: video.videoWidth / video.videoHeight,
                    faceLandmarks: faceLandmarks,
                    faceSize: faceSize
                };

                const pose = poseManagerRef.current.detect(landmarks, metadata);

                if (pose) {
                    setDetectedPoses(prev => {
                        const newMap = new Map(prev);
                        newMap.set(userId, pose);
                        return newMap;
                    });
                }
            }
        } catch (e) {
            console.error("Pose detection error:", e);
        }
    }, [isLoaded]);

    return { isLoaded, detectPose, detectedPoses };
}
