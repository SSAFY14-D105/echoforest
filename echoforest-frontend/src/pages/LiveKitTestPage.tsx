/**
 * LiveKit 연결 테스트 페이지
 * 직접 React에서 화상 채팅 연결을 확인할 수 있습니다.
 */
import { useState } from 'react';
import { LiveKitVideoGrid } from '../components/livekit';

export default function LiveKitTestPage() {
    // 테스트용 기본값 (사용자 요청 반영)
    const [roomId, setRoomId] = useState('room_1');
    const [username, setUsername] = useState('qetuo13579');
    const [userId, setUserId] = useState('qetuo13579');
    const [isJoined, setIsJoined] = useState(false);
    const [variant, setVariant] = useState<'grid' | 'sidebar' | 'overlay' | 'fullscreen'>('grid');

    const handleJoin = () => {
        if (roomId.trim() && username.trim()) {
            setIsJoined(true);
        }
    };

    const handleLeave = () => {
        setIsJoined(false);
    };

    // 입장 전 폼 화면
    if (!isJoined) {
        return (
            <div style={styles.container}>
                <div style={styles.formCard}>
                    <h1 style={styles.title}>🎥 LiveKit 테스트</h1>
                    <p style={styles.subtitle}>화상 채팅 연결을 테스트합니다</p>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>방 이름 (Room ID)</label>
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="예: game_room_1"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>사용자 이름</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="예: 홍길동"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>사용자 ID</label>
                        <input
                            type="text"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="예: user_123"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>레이아웃</label>
                        <select
                            value={variant}
                            onChange={(e) => setVariant(e.target.value as typeof variant)}
                            style={styles.select}
                        >
                            <option value="grid">Grid (4분할)</option>
                            <option value="sidebar">Sidebar (사이드바)</option>
                            <option value="overlay">Overlay (오버레이)</option>
                            <option value="fullscreen">Fullscreen (전체화면)</option>
                        </select>
                    </div>

                    <button onClick={handleJoin} style={styles.joinBtn}>
                        🚀 입장하기
                    </button>

                    <div style={styles.infoBox}>
                        <p><strong>서버 정보:</strong></p>
                        <p>API: https://i14d105.p.ssafy.io/api/livekit/token</p>
                        <p>LiveKit: wss://i14d105.p.ssafy.io</p>
                    </div>
                </div>
            </div>
        );
    }

    // 입장 후 화상 채팅 화면
    return (
        <div style={styles.videoContainer}>
            {/* 상단 정보 바 */}
            <div style={styles.topBar}>
                <span>🎥 Room: <strong>{roomId}</strong> | User: <strong>{username}</strong></span>
                <button onClick={handleLeave} style={styles.leaveBtn}>
                    ← 나가기
                </button>
            </div>

            {/* LiveKit 비디오 그리드 */}
            <div style={styles.videoArea}>
                <LiveKitVideoGrid
                    roomId={roomId}
                    username={username}
                    userId={userId}
                    variant={variant}
                    showControls={true}
                    onConnected={() => console.log('✅ 화상 연결 성공!')}
                    onDisconnected={() => console.log('📴 화상 연결 해제')}
                    onError={(error) => console.error('❌ 화상 에러:', error)}
                />
            </div>
        </div>
    );
}

// 인라인 스타일
const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        padding: '20px',
    },
    formCard: {
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    },
    title: {
        color: 'white',
        fontSize: '28px',
        margin: '0 0 8px 0',
        textAlign: 'center' as const,
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '14px',
        margin: '0 0 30px 0',
        textAlign: 'center' as const,
    },
    inputGroup: {
        marginBottom: '20px',
    },
    label: {
        display: 'block',
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '14px',
        marginBottom: '8px',
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        fontSize: '16px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.1)',
        color: 'white',
        outline: 'none',
        boxSizing: 'border-box' as const,
    },
    select: {
        width: '100%',
        padding: '12px 16px',
        fontSize: '16px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.1)',
        color: 'white',
        outline: 'none',
        cursor: 'pointer',
    },
    joinBtn: {
        width: '100%',
        padding: '14px',
        fontSize: '16px',
        fontWeight: 'bold',
        border: 'none',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #4CAF50, #45a049)',
        color: 'white',
        cursor: 'pointer',
        marginTop: '10px',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    infoBox: {
        marginTop: '30px',
        padding: '15px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '10px',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.5)',
    },
    videoContainer: {
        width: '100vw',
        height: '100vh',
        background: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column' as const,
    },
    topBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        background: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        fontSize: '14px',
    },
    leaveBtn: {
        padding: '8px 16px',
        fontSize: '14px',
        border: 'none',
        borderRadius: '8px',
        background: '#ff4757',
        color: 'white',
        cursor: 'pointer',
    },
    videoArea: {
        flex: 1,
        position: 'relative' as const,
    },
};
