/**
 * LiveKit 화상 채팅 오버레이 컴포넌트
 * 게임 화면 위에 화상 채팅을 표시합니다.
 * 
 * @deprecated 새로운 프로젝트에서는 LiveKitVideoGrid 컴포넌트를 사용하세요.
 * @see src/components/livekit/LiveKitVideoGrid.tsx
 */
import { LiveKitVideoGrid } from './livekit';

export interface LiveKitOverlayProps {
  roomId: string;
  username: string;
  userId?: string;
}

/**
 * 기존 호환성을 위한 래퍼 컴포넌트
 * 내부적으로 LiveKitVideoGrid를 사용합니다.
 */
export default function LiveKitOverlay({ roomId, username, userId }: LiveKitOverlayProps) {
  return (
    <LiveKitVideoGrid
      roomId={roomId}
      username={username}
      userId={userId}
      variant="sidebar"
      showControls={true}
      onConnected={() => console.log('🎥 화상 채팅 연결됨')}
      onError={(error) => console.error('❌ 화상 채팅 에러:', error)}
    />
  );
}
