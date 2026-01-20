/**
 * LiveKit 연결을 위한 커스텀 Hook
 * 토큰 발급부터 연결 관리까지 처리합니다.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchLiveKitToken,
    generateUserId,
    LIVEKIT_SERVER_URL,
    type LiveKitTokenRequest,
} from '../apis/livekitApi';

/**
 * useLiveKit Hook 옵션
 */
export interface UseLiveKitOptions {
    roomName: string;           // 참여할 방 이름
    username: string;           // 표시될 사용자 이름
    userId?: string;            // 선택적 사용자 ID (없으면 자동 생성)
    autoConnect?: boolean;      // 자동 연결 여부 (기본값: true)
    onConnected?: () => void;   // 연결 성공 콜백
    onDisconnected?: () => void; // 연결 해제 콜백
    onError?: (error: Error) => void; // 에러 콜백
}

/**
 * useLiveKit Hook 반환값
 */
export interface UseLiveKitResult {
    token: string | null;       // 발급받은 토큰
    serverUrl: string;          // LiveKit 서버 URL
    isLoading: boolean;         // 토큰 발급 중
    isConnected: boolean;       // 연결 상태
    error: Error | null;        // 발생한 에러
    connect: () => Promise<void>;    // 연결 시작 함수
    disconnect: () => void;          // 연결 해제 함수
    refetchToken: () => Promise<void>; // 토큰 재발급 함수
}

/**
 * LiveKit 연결을 관리하는 커스텀 Hook
 * 
 * @param options - Hook 옵션
 * @returns LiveKit 연결 상태 및 제어 함수
 * 
 * @example
 * ```tsx
 * function VideoChat() {
 *   const { token, serverUrl, isLoading, error } = useLiveKit({
 *     roomName: 'game_room_1',
 *     username: '플레이어1',
 *     onConnected: () => console.log('연결됨!'),
 *     onError: (e) => console.error('에러:', e),
 *   });
 * 
 *   if (isLoading) return <div>연결 중...</div>;
 *   if (error) return <div>에러: {error.message}</div>;
 *   if (!token) return null;
 * 
 *   return (
 *     <LiveKitRoom token={token} serverUrl={serverUrl}>
 *       <VideoConference />
 *     </LiveKitRoom>
 *   );
 * }
 * ```
 */
export function useLiveKit(options: UseLiveKitOptions): UseLiveKitResult {
    const {
        roomName,
        username,
        userId: providedUserId,
        autoConnect = true,
        onConnected,
        onDisconnected,
        onError,
    } = options;

    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // 사용자 ID를 한 번만 생성하기 위해 ref 사용
    const userIdRef = useRef<string>(providedUserId || generateUserId());

    /**
     * 토큰 발급 함수
     */
    const fetchToken = useCallback(async () => {
        if (!roomName || !username) {
            console.warn('useLiveKit: roomName과 username이 필요합니다.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const request: LiveKitTokenRequest = {
                roomName,
                userId: userIdRef.current,
                username,
            };

            const response = await fetchLiveKitToken(request);
            setToken(response.token);
            console.log('✅ LiveKit 토큰 발급 성공');
        } catch (err) {
            const error = err instanceof Error ? err : new Error('알 수 없는 에러');
            setError(error);
            console.error('❌ LiveKit 토큰 발급 실패:', error);
            onError?.(error);
        } finally {
            setIsLoading(false);
        }
    }, [roomName, username, onError]);

    /**
     * 연결 시작
     */
    const connect = useCallback(async () => {
        await fetchToken();
        setIsConnected(true);
        onConnected?.();
    }, [fetchToken, onConnected]);

    /**
     * 연결 해제
     */
    const disconnect = useCallback(() => {
        setToken(null);
        setIsConnected(false);
        onDisconnected?.();
    }, [onDisconnected]);

    /**
     * 토큰 재발급
     */
    const refetchToken = useCallback(async () => {
        await fetchToken();
    }, [fetchToken]);

    // 자동 연결
    useEffect(() => {
        if (autoConnect && roomName && username) {
            fetchToken();
        }
    }, [autoConnect, roomName, username, fetchToken]);

    return {
        token,
        serverUrl: LIVEKIT_SERVER_URL,
        isLoading,
        isConnected,
        error,
        connect,
        disconnect,
        refetchToken,
    };
}

export default useLiveKit;
