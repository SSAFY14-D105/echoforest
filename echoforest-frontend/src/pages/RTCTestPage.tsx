import { useState } from 'react';
import LiveKitOverlay from '../components/LiveKitOverlay';

/**
 * LiveKit RTC 테스트 페이지
 * App.tsx에서 이 페이지를 바로 렌더링하면 테스트 가능
 */
export default function RTCTestPage() {
    const [username] = useState(() => `Player_${Math.floor(Math.random() * 1000)}`);
    const [roomId] = useState('test_room_001');

    return (
        <div style={{
            position: 'relative',
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}>
            {/* 중앙 안내 */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                textAlign: 'center',
            }}>
                <h1>🎥 LiveKit RTC 테스트</h1>
                <p>Room: <strong>{roomId}</strong></p>
                <p>User: <strong>{username}</strong></p>
                <p style={{ opacity: 0.7, fontSize: '14px', marginTop: '20px' }}>
                    → 오른쪽 사이드바에 화상 채팅이 표시됩니다
                </p>
            </div>

            {/* LiveKit 화상 채팅 (오른쪽 사이드바) */}
            <LiveKitOverlay roomId={roomId} username={username} />
        </div>
    );
}
