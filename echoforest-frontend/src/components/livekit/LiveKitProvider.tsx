import { ReactNode } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { useLiveKit, LiveKitConfig } from '../../hooks/useLiveKit';
import styles from './LiveKitProvider.module.css';

interface LiveKitProviderProps {
    roomId: string;
    username: string;
    children: ReactNode;
    config?: LiveKitConfig;
    /** 로딩 중 표시할 커스텀 컴포넌트 */
    loadingComponent?: ReactNode;
    /** 에러 시 표시할 커스텀 컴포넌트 */
    errorComponent?: ReactNode;
}

/**
 * LiveKit 연결을 관리하는 Provider 컴포넌트
 * 
 * 토큰 발급, 로딩/에러 상태를 처리하고
 * 자식 컴포넌트에게 LiveKitRoom 컨텍스트를 제공합니다.
 * 
 * @example
 * ```tsx
 * <LiveKitProvider roomId="room_1" username="철수">
 *   <SidebarVideoLayout />  // 또는 <FourSplitLayout />
 * </LiveKitProvider>
 * ```
 */
export function LiveKitProvider({
    roomId,
    username,
    children,
    config,
    loadingComponent,
    errorComponent,
}: LiveKitProviderProps) {
    const { token, isLoading, error, livekitUrl, refetch } = useLiveKit(roomId, username, config);

    // 로딩 상태
    if (isLoading) {
        return loadingComponent || (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>화상 채팅 연결 중...</p>
            </div>
        );
    }

    // 에러 상태
    if (error) {
        return errorComponent || (
            <div className={styles.errorContainer}>
                <p className={styles.errorIcon}>⚠️</p>
                <p className={styles.errorMessage}>{error}</p>
                <button className={styles.retryButton} onClick={refetch}>
                    다시 시도
                </button>
            </div>
        );
    }

    // 토큰 없음
    if (!token) {
        return null;
    }

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={livekitUrl}
            data-lk-theme="default"
            className={styles.livekitRoom}
        >
            {children}
        </LiveKitRoom>
    );
}

export default LiveKitProvider;
