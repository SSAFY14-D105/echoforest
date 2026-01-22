/**
 * LiveKit 4분할 비디오 그리드 컴포넌트
 * 다른 곳에서 재사용 가능한 화상 채팅 컴포넌트입니다.
 */
import { useMemo } from 'react';
import {
    LiveKitRoom,
    VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import useLiveKit from '../../hooks/useLiveKit';
import './LiveKitVideoGrid.css';

/**
 * LiveKitVideoGrid Props
 */
export interface LiveKitVideoGridProps {
    roomId: string;               // 방 ID
    username: string;             // 사용자 이름
    userId?: string;              // 선택적 사용자 ID
    variant?: 'sidebar' | 'overlay' | 'fullscreen' | 'grid'; // 레이아웃 스타일
    showControls?: boolean;       // 컨트롤 바 표시 여부
    autoConnect?: boolean;        // 자동 연결 여부
    onConnected?: () => void;     // 연결 성공 콜백
    onDisconnected?: () => void;  // 연결 해제 콜백
    onError?: (error: Error) => void; // 에러 콜백
    className?: string;           // 추가 CSS 클래스
    style?: React.CSSProperties;  // 인라인 스타일
}

/**
 * 재사용 가능한 LiveKit 비디오 그리드 컴포넌트
 * 
 * @example
 * ```tsx
 * // 사이드바 형태로 사용
 * <LiveKitVideoGrid
 *   roomId="game_room_1"
 *   username="플레이어1"
 *   variant="sidebar"
 * />
 * 
 * // 전체 화면 형태로 사용
 * <LiveKitVideoGrid
 *   roomId="game_room_1"
 *   username="플레이어1"
 *   variant="fullscreen"
 *   showControls={true}
 * />
 * 
 * // 오버레이 형태로 게임 위에 띄우기
 * <LiveKitVideoGrid
 *   roomId={gameRoomId}
 *   username={playerName}
 *   variant="overlay"
 *   onConnected={() => console.log('화상 연결됨!')}
 * />
 * ```
 */
export default function LiveKitVideoGrid({
    roomId,
    username,
    userId,
    variant = 'grid',
    autoConnect = true,
    onConnected,
    onDisconnected,
    onError,
    className = '',
    style,
}: LiveKitVideoGridProps) {
    const { token, serverUrl, isLoading, error } = useLiveKit({
        roomId,
        username,
        userId,
        autoConnect,
        onConnected,
        onDisconnected,
        onError,
    });

    // 레이아웃 스타일 계산
    const containerStyle = useMemo((): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            ...style,
        };

        switch (variant) {
            case 'sidebar':
                return {
                    ...baseStyle,
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '300px',
                    height: '100vh',
                    zIndex: 999,
                    background: 'rgba(0, 0, 0, 0.8)',
                };
            case 'overlay':
                return {
                    ...baseStyle,
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '320px',
                    height: 'auto',
                    maxHeight: '50vh',
                    zIndex: 999,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                };
            case 'fullscreen':
                return {
                    ...baseStyle,
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 1000,
                    background: '#1a1a2e',
                };
            case 'grid':
            default:
                return {
                    ...baseStyle,
                    width: '100%',
                    height: '100%',
                    background: '#1a1a2e',
                };
        }
    }, [variant, style]);

    // 로딩 상태
    if (isLoading) {
        return (
            <div style={containerStyle} className={`livekit-container livekit-${variant} ${className}`}>
                <div className="livekit-loading">
                    <div className="livekit-spinner"></div>
                    <p>화상 채팅 연결 중...</p>
                </div>
            </div>
        );
    }

    // 에러 상태
    if (error) {
        return (
            <div style={containerStyle} className={`livekit-container livekit-${variant} ${className}`}>
                <div className="livekit-error">
                    <p>❌ 연결 실패</p>
                    <small>{error.message}</small>
                </div>
            </div>
        );
    }

    // 토큰 없음
    if (!token) {
        return null;
    }

    return (
        <div style={containerStyle} className={`livekit-container livekit-${variant} ${className}`}>
            <LiveKitRoom
                video={true}
                audio={true}
                token={token}
                serverUrl={serverUrl}
                connect={true}
                data-lk-theme="default"
                style={{ height: '100%', width: '100%' }}
                onDisconnected={() => {
                    console.log('📴 LiveKit 연결 해제됨');
                    onDisconnected?.();
                }}
                onConnected={() => {
                    console.log('✅ LiveKit 연결됨');
                    onConnected?.();
                }}
            >
                <VideoConference />
            </LiveKitRoom>
        </div>
    );
}
