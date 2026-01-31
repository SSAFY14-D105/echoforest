import { useRef, useEffect } from 'react';
import { useMotionDetector } from '../hooks/useMotionDetector';

const MotionTestPage = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isLoaded, detectedGesture } = useMotionDetector(videoRef);

    useEffect(() => {
        const startWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 } // 적절한 해상도
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Webcam Error:", err);
            }
        };

        startWebcam();
    }, []);

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: 'white'
        }}>
            <h1>Motion Gesture Test</h1>

            <div style={{ position: 'relative', border: '2px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: '640px',
                        height: '480px',
                        transform: 'scaleX(-1)' // 거울 모드
                    }}
                />

                {/* Gesture Overlay */}
                {detectedGesture && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '5rem',
                        fontWeight: 'bold',
                        textShadow: '0 0 10px rgba(0,0,0,0.5)',
                        pointerEvents: 'none',
                        zIndex: 10,
                        animation: 'pop 0.2s ease-out'
                    }}>
                        {detectedGesture.emoji}
                        <div style={{ fontSize: '1.5rem', textAlign: 'center' }}>
                            {detectedGesture.label}
                        </div>
                    </div>
                )}

                {/* Status Indicator */}
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    padding: '5px 10px',
                    backgroundColor: isLoaded ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                }}>
                    {isLoaded ? "AI Ready" : "Loading Models..."}
                </div>
            </div>

            <div style={{ marginTop: '20px', padding: '10px', background: '#333', borderRadius: '4px' }}>
                <h3>Debug Log:</h3>
                <pre style={{ fontSize: '0.8rem' }}>
                    {detectedGesture ? JSON.stringify(detectedGesture, null, 2) : "No Gesture Detected"}
                </pre>
            </div>
        </div>
    );
};

export default MotionTestPage;
