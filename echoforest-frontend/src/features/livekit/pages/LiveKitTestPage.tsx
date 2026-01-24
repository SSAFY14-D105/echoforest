/**
 * LiveKit 테스트 페이지
 * 내 카메라를 띄워서 연결 테스트
 */
import { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { fetchLiveKitToken, LIVEKIT_SERVER_URL } from '../api/livekitApi';
import TestVideo from '../components/TestVideo';
import styles from './LiveKitTestPage.module.css';

export default function LiveKitTestPage() {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 테스트용 기본값
    const roomId = 'room_1';
    const username = 'testUser';
    const userId = 'testUser';

    useEffect(() => {
        async function getToken() {
            try {
                console.log('🚀 토큰 발급 시작...');
                const response = await fetchLiveKitToken({ roomId, userId, username });
                console.log('✅ 토큰 발급 성공!');
                setToken(response.token);
            } catch (err) {
                console.error('❌ 토큰 발급 실패:', err);
                setError(err instanceof Error ? err.message : '토큰 발급 실패');
            } finally {
                setIsLoading(false);
            }
        }
        getToken();
    }, []);

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.message}>🔄 토큰 발급 중...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>
                    <h2>❌ 연결 실패</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className={styles.button}>
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>토큰이 없습니다</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>🎥 LiveKit 테스트</h1>
            <p className={styles.info}>Room: {roomId} | User: {username}</p>

            <LiveKitRoom
                token={token}
                serverUrl={LIVEKIT_SERVER_URL}
                video={true}
                audio={true}
                connect={true}
                className={styles.room}
                onConnected={() => console.log('✅ LiveKit 연결됨!')}
                onDisconnected={() => console.log('📴 LiveKit 연결 해제')}
            >
                <TestVideo />
            </LiveKitRoom>
        </div>
    );
}
