import React, { useEffect, useRef, useState } from 'react';
import useMultiMotionDetector from '@/hooks/useMultiMotionDetector';
import PoseManager from '../utils/PoseManager';

const MotionTestPage = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isLoaded, detectPose, detectedPoses, poseManager } = useMultiMotionDetector();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [selectedGesture, setSelectedGesture] = useState<any>(null);
    const [thresholds, setThresholds] = useState<any>({});
    const [refreshKey, setRefreshKey] = useState(0); // 강제 리렌더링용

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => {
                setStream(s);
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                }
            })
            .catch(err => console.error("Webcam error:", err));
    }, []);

    useEffect(() => {
        if (!isLoaded || !stream) return;

        const interval = setInterval(() => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
                detectPose(videoRef.current, 'local-user');
            }
        }, 100);

        return () => clearInterval(interval);
    }, [isLoaded, stream, detectPose]);

    const myPose = detectedPoses.get('local-user');

    // 제스처 선택 시 thresholds 로드
    const handleSelectGesture = (gestureName: string) => {
        if (!poseManager) return;
        const gesture = poseManager.getGestures().find((g: any) => g.constructor.name === gestureName);
        if (gesture) {
            setSelectedGesture(gesture);
            setThresholds({ ...gesture.thresholds }); // 복사
            console.log("Selected:", gestureName, gesture.thresholds);
        }
    };

    // Threshold 값 변경 핸들러
    const handleThresholdChange = (key: string, value: string) => {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) return;

        setThresholds((prev: any) => {
            const newT = { ...prev, [key]: numVal };
            // 실제 객체에 반영
            if (selectedGesture) {
                selectedGesture.thresholds = newT;
            }
            return newT;
        });
    };

    return (
        <div style={{ padding: 20, color: 'white', background: '#222', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <h1 style={{ marginBottom: 10 }}>🎥 모션 튜닝 샌드박스</h1>

            <div style={{ display: 'flex', gap: 20 }}>
                {/* 왼쪽: 카메라 및 결과 */}
                <div style={{ flex: 2 }}>
                    <div style={{ position: 'relative', width: '100%', border: '2px solid #555', borderRadius: 12, overflow: 'hidden' }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }}
                        />

                        {myPose && myPose.detected && (
                            <div style={{
                                position: 'absolute',
                                top: 20, right: 20,
                                background: 'rgba(0,0,0,0.8)',
                                color: '#4f9',
                                padding: '10px 20px',
                                borderRadius: 30,
                                fontSize: 32, fontWeight: 'bold'
                            }}>
                                {myPose.emoji} {myPose.label}
                                <div style={{ fontSize: 14, color: '#aaa', marginTop: 5, textAlign: 'center' }}>
                                    {Math.round(myPose.score * 100)}%
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 오른쪽: 튜닝 패널 */}
                <div style={{ flex: 1, background: '#333', padding: 20, borderRadius: 12 }}>
                    <h2>🎛️ 튜너</h2>
                    {poseManager ? (
                        <div>
                            <select
                                onChange={(e) => handleSelectGesture(e.target.value)}
                                style={{ width: '100%', padding: 10, marginBottom: 20, fontSize: 16 }}
                            >
                                <option value="">제스처 선택...</option>
                                {poseManager.getGestures().map((g: any) => (
                                    <option key={g.constructor.name} value={g.constructor.name}>
                                        {g.label || g.constructor.name}
                                    </option>
                                ))}
                            </select>

                            {selectedGesture ? (
                                <div>
                                    <h3 style={{ borderBottom: '1px solid #555', paddingBottom: 10 }}>
                                        {selectedGesture.constructor.name} 설정
                                    </h3>
                                    {Object.keys(thresholds).length > 0 ? (
                                        Object.entries(thresholds).map(([key, val]: [string, any]) => (
                                            <div key={key} style={{ marginBottom: 15 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                    <label>{key}</label>
                                                    <span style={{ color: '#4f9' }}>{val}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0" max="2" step="0.01"
                                                    value={val}
                                                    onChange={(e) => handleThresholdChange(key, e.target.value)}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ color: '#aaa' }}>조절 가능한 설정(thresholds)이 없습니다.</p>
                                    )}
                                    <div style={{ marginTop: 20, padding: 10, background: '#444', fontSize: 12, borderRadius: 4 }}>
                                        💡 슬라이더를 움직이면 즉시 반영됩니다.<br />
                                        손하트가 잘 안되면 <b>tipDistance</b>를 늘려보세요!
                                    </div>
                                </div>
                            ) : (
                                <p>위 목록에서 튜닝할 제스처를 선택하세요.</p>
                            )}
                        </div>
                    ) : (
                        <p>모델 로딩중...</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MotionTestPage;
