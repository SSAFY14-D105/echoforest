/**
 * LiveKit 화상 채팅 컴포넌트
 * 간단하게 화상 채팅을 표시합니다.
 */
import {
  LiveKitRoom,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import useLiveKit from '../hooks/useLiveKit';

export interface LiveKitOverlayProps {
  roomId: string;
  username: string;
  userId: string;
  onConnected?: () => void;
  onError?: (error: Error) => void;
}

export default function LiveKitOverlay({
  userId,
  username,
  roomId,
  onConnected,
  onError,
}: LiveKitOverlayProps) {
  const { token, serverUrl, isLoading, error } = useLiveKit({
    userId,
    username,
    roomId,
  });

  if (error && onError) {
    onError(error);
  }

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.message}>🔄 연결 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>❌ {error.message}</div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div style={styles.container}>
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        onConnected={onConnected}
        style={{ height: '100%', width: '100%' }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    background: '#1a1a2e',
  },
  message: {
    color: 'white',
    padding: '20px',
    textAlign: 'center',
  },
  error: {
    color: '#ff6b6b',
    padding: '20px',
    textAlign: 'center',
  },
};
