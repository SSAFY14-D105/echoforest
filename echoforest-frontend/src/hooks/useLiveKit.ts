/**
 * LiveKit 연결을 위한 커스텀 Hook
 * 토큰 발급 및 연결 상태 관리
 */
import { useState, useEffect, useCallback } from 'react';
import {
    fetchLiveKitToken,
    generateUserId,
    LIVEKIT_SERVER_URL,
} from '../apis/livekitApi';

export interface UseLiveKitOptions {
    roomId: string;
    username: string;
    userId?: string;
    autoConnect?: boolean;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
}

export interface UseLiveKitResult {
    token: string | null;
    serverUrl: string;
    isLoading: boolean;
    error: Error | null;
    connect: () => Promise<void>;
    disconnect: () => void;
}

/**
 * LiveKit 연결 관리 훅
 * 
 * @example
 * const { token, serverUrl, isLoading, error } = useLiveKit({
 *   roomId: 'room_1',
 *   username: '철수',
 * });
 */
export function useLiveKit(options: UseLiveKitOptions): UseLiveKitResult {
    const { roomId, username, userId, autoConnect = true, onError } = options;

    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // 토큰 발급
    const connect = useCallback(async () => {
        console.log('🔵 LiveKit 연결 시도:', { roomId, username, userId });

        if (!roomId || !username) {
            console.log('⚠️ roomId 또는 username이 없습니다:', { roomId, username });
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const finalUserId = userId || generateUserId();
            console.log('📡 토큰 요청 중...', { roomId, userId: finalUserId, username });

            const response = await fetchLiveKitToken({
                roomId,
                userId: finalUserId,
                username,
            });
            console.log('✅ 토큰 발급 성공:', response.token.substring(0, 30) + '...');
            setToken(response.token);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('토큰 발급 실패');
            setError(error);
            console.error('❌ LiveKit 토큰 발급 실패 상세:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                originalError: err
            });
            onError?.(error);
        } finally {
            setIsLoading(false);
        }
    }, [roomId, username, userId, onError]);

    // 연결 해제
    const disconnect = useCallback(() => {
        setToken(null);
    }, []);

    // 자동 연결
    useEffect(() => {
        console.log('🟢 useLiveKit 마운트됨:', { autoConnect, roomId, username });
        if (autoConnect && roomId && username) {
            connect();
        }
    }, [autoConnect, roomId, username, connect]);

    return {
        token,
        serverUrl: LIVEKIT_SERVER_URL,
        isLoading,
        error,
        connect,
        disconnect,
    };
}

export default useLiveKit;
