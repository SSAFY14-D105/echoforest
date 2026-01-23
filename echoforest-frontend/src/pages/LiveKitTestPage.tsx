/**
 * LiveKit 테스트 페이지
 * 내 카메라를 띄워서 연결 테스트
 */
import { useState, useEffect } from 'react';
import {
    LiveKitRoom,
    VideoTrack,
    useLocalParticipant,
    useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { fetchLiveKitToken, LIVEKIT_SERVER_URL } from '../apis/livekitApi';

export default function LiveKitTestPage() {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 테스트용 기본값
    const roomId = 'room_1';
    const username = 'qetuo13579';
    const userId = 'qetuo13579';

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
            <div style={styles.container}>
                <div style={styles.message}>🔄 토큰 발급 중...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>
                    <h2>❌ 연결 실패</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} style={styles.button}>
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div style={styles.container}>
                <div style={styles.error}>토큰이 없습니다</div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>🎥 LiveKit 테스트</h1>
            <p style={styles.info}>Room: {roomId} | User: {username}</p>

            <LiveKitRoom
                token={token}
                serverUrl={LIVEKIT_SERVER_URL}
                video={true}
                audio={true}
                connect={true}
                style={styles.room}
                onConnected={() => console.log('✅ LiveKit 연결됨!')}
                onDisconnected={() => console.log('📴 LiveKit 연결 해제')}
            >
                <MyVideo />
            </LiveKitRoom>
        </div>
    );
}

function MyVideo() {
    const { localParticipant } = useLocalParticipant();
    const tracks = useTracks([Track.Source.Camera]);

    const myVideoTrack = tracks.find(
        (track) => track.participant.identity === localParticipant.identity
    );

    if (!myVideoTrack) {
        return <div style={styles.noVideo}>📷 카메라 로딩 중...</div>;
    }

    return (
        <div style={styles.videoWrapper}>
            <VideoTrack trackRef={myVideoTrack} style={styles.video} />
            <div style={styles.nameTag}>{localParticipant.identity}</div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: 'white',
        padding: '20px',
    },
    title: {
        fontSize: '32px',
        marginBottom: '10px',
    },
    info: {
        fontSize: '14px',
        opacity: 0.7,
        marginBottom: '30px',
    },
    message: {
        fontSize: '20px',
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(255, 0, 0, 0.1)',
        borderRadius: '12px',
    },
    button: {
        marginTop: '20px',
        padding: '12px 24px',
        fontSize: '16px',
        background: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
    },
    room: {
        width: '400px',
        height: '300px',
        borderRadius: '12px',
        overflow: 'hidden',
    },
    videoWrapper: {
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
    },
    video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    noVideo: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#333',
        fontSize: '18px',
    },
    nameTag: {
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        padding: '4px 12px',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '4px',
        fontSize: '14px',
    },
};
