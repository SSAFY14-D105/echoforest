/**
 * LiveKit 연결을 위한 커스텀 Hook
 * 토큰 발급 및 연결 상태 관리
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchLiveKitToken, LIVEKIT_SERVER_URL } from '../api/livekitApi';

export interface UseLiveKitOptions {
    roomId: string;
    username: string;
    userId: string;  // 필수
    autoConnect?: boolean;
}

export interface UseLiveKitResult {
    token: string | null;
    serverUrl: string;
    isLoading: boolean;
    error: Error | null;
    connect: () => Promise<void>;
}

/**
 * LiveKit 연결 관리 훅
 */
export function useLiveKit(options: UseLiveKitOptions): UseLiveKitResult {
    const { roomId, username, userId, autoConnect = true } = options;

    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const connect = useCallback(async () => {
        if (!roomId || !username || !userId) {
            console.log('⚠️ 필수값 누락:', { roomId, username, userId });
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetchLiveKitToken({ roomId, userId, username });
            setToken(response.token);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('토큰 발급 실패');
            setError(error);
            console.error('❌ 토큰 발급 실패:', error.message);
        } finally {
            setIsLoading(false);
        }
    }, [roomId, username, userId]);

    useEffect(() => {
        if (autoConnect && roomId && username && userId) {
            connect();
        }
    }, [autoConnect, roomId, username, userId, connect]);

    return {
        token,
        serverUrl: LIVEKIT_SERVER_URL,
        isLoading,
        error,
        connect,
    };
}

export default useLiveKit;
