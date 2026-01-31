import { useRef, useState, useEffect, useCallback } from 'react';
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import BaseGesture, { GestureResult, GestureMetadata } from '../components/motion/BaseGesture';

// Custom Gestures
import BigHeartGesture from '../components/motion/BigHeartGesture';
import CatEarsGesture from '../components/motion/CatEarsGesture';
import CheekHeartGesture from '../components/motion/CheekHeartGesture';
import TalmoBeamGesture from '../components/motion/TalmoBeamGesture';
import BothCheekPokeGesture from '../components/motion/BothCheekPokeGesture';
import FistGesture from '../components/motion/FistGesture';
import HeartGesture from '../components/motion/HeartGesture';
import KissGesture from '../components/motion/KissGesture';
import LGesture from '../components/motion/LGesture';
import OKGesture from '../components/motion/OKGesture';
import VSignGesture from '../components/motion/VSignGesture';

interface MotionDetectorHook {
    isLoaded: boolean;
    detectedGesture: GestureResult | null;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function useMotionDetector(videoRef: React.RefObject<HTMLVideoElement>): MotionDetectorHook {
    const [isLoaded, setIsLoaded] = useState(false);
    const [detectedGesture, setDetectedGesture] = useState<GestureResult | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
    const faceLandmarkerRef = useRef<any>(null); // FaceLandmarker
    const isLooping = useRef(false);

    // Custom Gestures Instance
    const customGestures = useRef<BaseGesture[]>([]);

    useEffect(() => {
        const loadModels = async () => {
            try {
                // 1. Load Vision WASM
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                // 2. Load Hand Gesture Recognizer (CDN)
                gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });

                // 3. Load Face Landmarker (Dynamic Import & CDN)
                // FaceLandmarker class needed explicitly
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

                // 4. Initialize Custom Gestures
                customGestures.current = [
                    new CatEarsGesture(),
                    new BigHeartGesture(),
                    new TalmoBeamGesture(),
                    new BothCheekPokeGesture(),
                    new CheekHeartGesture(),
                    new FistGesture(),
                    new HeartGesture(),
                    new KissGesture(),
                    new LGesture(),
                    new OKGesture(),
                    new VSignGesture()
                ];

                setIsLoaded(true);
                // console.log("Motion Detector Models Loaded");

            } catch (error) {
                console.error("Failed to load Motion Models:", error);
            }
        };

        loadModels();
    }, []);

    const detect = useCallback(async () => {
        if (!isLooping.current) return;
        if (!gestureRecognizerRef.current || !faceLandmarkerRef.current) {
            requestAnimationFrame(detect);
            return;
        }

        const video = videoRef.current;
        if (!video || video.readyState !== 4) {
            requestAnimationFrame(detect);
            return;
        }

        try {
            const nowInMs = Date.now();

            // A. Hand Detection
            const handResult = gestureRecognizerRef.current.recognizeForVideo(video, nowInMs);

            // B. Face Detection
            const faceResult = faceLandmarkerRef.current.detectForVideo(video, nowInMs);

            // C. Metadata Assemble
            const palmSize = 0.1; // Placeholder defaults
            const aspectRatio = video.videoWidth / video.videoHeight || 1.0;

            const metadata: GestureMetadata = {
                palmSize: palmSize,
                aspectRatio: aspectRatio,
                allHands: handResult.landmarks,
                faceLandmarks: faceResult.faceLandmarks?.[0],
                faceSize: 0.1
            };

            // D. Check Custom Gestures
            let bestGesture: GestureResult | null = null;
            let maxScore = 0;

            if (handResult.landmarks.length > 0) {
                for (const gesture of customGestures.current) {
                    const result = gesture.check(handResult.landmarks[0], metadata);

                    if (result.detected && result.score > maxScore) {
                        maxScore = result.score;
                        bestGesture = result;
                    }
                }
            }

            // E. State Update 
            setDetectedGesture(bestGesture);

        } catch (e) {
            console.error("Detection Error:", e);
        }

        requestAnimationFrame(detect);
    }, [videoRef]);

    useEffect(() => {
        if (isLoaded && videoRef.current) {
            isLooping.current = true;
            detect();
        }
        return () => {
            isLooping.current = false;
        };
    }, [isLoaded, detect, videoRef]);

    return { isLoaded, detectedGesture, canvasRef };
}
