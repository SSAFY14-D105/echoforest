import React, { useEffect, useRef, useState } from 'react';
import useMultiMotionDetector from '../../hooks/useMultiMotionDetector';

const MotionTestPage = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isLoaded, detectPose, detectedPoses } = useMultiMotionDetector();
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        // 웹캠 시작
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
        }, 100); // 10fps

        return () => clearInterval(interval);
    }, [isLoaded, stream, detectPose]);

    const myPose = detectedPoses.get('local-user');

    return (
        <div style={{ padding: 20, color: 'white', background: '#222', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <h1>🎥 모션 인식 테스트</h1>
            <p>13가지 제스처를 테스트해보세요! (모델 로딩에 시간이 걸릴 수 있습니다)</p>

            <div style={{ position: 'relative', width: 640, maxWidth: '100%', border: '2px solid #555', borderRadius: 12, overflow: 'hidden' }}>
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
                        fontSize: 32,
                        fontWeight: 'bold',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                        animation: 'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                        {myPose.emoji} {myPose.label}
                        <div style={{ fontSize: 14, color: '#aaa', marginTop: 5, textAlign: 'center' }}>
                            신뢰도: {Math.round(myPose.score * 100)}%
                        </div>
                    </div>
                )}
            </div>

            <div style={{ marginTop: 20, padding: 15, background: '#333', borderRadius: 8 }}>
                <h3>📊 상태</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>🤖 모델 로드: <span style={{ color: isLoaded ? '#4f9' : '#f94' }}>{isLoaded ? '완료' : '로딩중...'}</span></div>
                    <div>📸 웹캠 연결: <span style={{ color: stream ? '#4f9' : '#f94' }}>{stream ? '연결됨' : '연결 대기중'}</span></div>
                </div>

                <div style={{ marginTop: 15 }}>
                    <h4>지원되는 제스처 목록:</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {['🙆‍♂️ 머리위하트', '💕 양볼콕', '🐱 고양이귀', '🫶 볼하트', '✊ 주먹', '❤️ 손하트', '💋 뽀뽀', '👆 L자', '👈 왼볼콕', '👌 OK', '👉 오른볼콕', '⚡ 탈모빔', '✌️ 브이'].map(g => (
                            <span key={g} style={{ background: '#444', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>{g}</span>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pop {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default MotionTestPage;
