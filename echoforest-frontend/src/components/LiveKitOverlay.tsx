/**
 * LiveKit 화상 채팅 오버레이 컴포넌트
 * 게임 화면 위에 화상 채팅을 표시합니다.
 * 
 * @example
 * // 사이드바 형태로 사용
 * <LiveKitOverlay roomId="room_1" username="철수" />
 * 
 * // 전체 화면 형태로 사용
 * <LiveKitOverlay roomId="room_1" username="철수" variant="fullscreen" />
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
  userId?: string;
  variant?: 'sidebar' | 'overlay' | 'fullscreen';
  onConnected?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 재사용 가능한 LiveKit 화상 채팅 컴포넌트
 */
export default function LiveKitOverlay({
  roomId,
  username,
  userId,
  variant = 'sidebar',
  onConnected,
  onError,
}: LiveKitOverlayProps) {
  const { token, serverUrl, isLoading, error } = useLiveKit({
    roomId,
    username,
    userId,
  });

  // 에러 콜백
  if (error && onError) {
    onError(error);
  }

  // 레이아웃 스타일
  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 999,
      background: 'rgba(0, 0, 0, 0.8)',
    };

    switch (variant) {
      case 'sidebar':
        return { ...base, top: 0, right: 0, width: '300px', height: '100vh' };
      case 'overlay':
        return { ...base, top: '10px', right: '10px', width: '320px', height: 'auto', borderRadius: '12px' };
      case 'fullscreen':
        return { ...base, top: 0, left: 0, width: '100vw', height: '100vh' };
      default:
        return base;
    }
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div style={getStyle()}>
        <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
          🔄 화상 채팅 연결 중...
        </div>
      </div>
    );
  }

  // 에러 발생
  if (error) {
    return (
      <div style={getStyle()}>
        <div style={{ color: '#ff6b6b', padding: '20px', textAlign: 'center' }}>
          ❌ 연결 실패: {error.message}
        </div>
      </div>
    );
  }

  // 토큰 없음
  if (!token) return null;

  return (
    <div style={getStyle()}>
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        onConnected={onConnected}
        style={{ height: '100%', width: '100%' }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
