import { useEffect, useState, useCallback } from 'react';

// 백엔드 API 주소 (환경변수로 관리 추천)
const API_URL = "http://localhost:9001/api/livekit/token";
const LIVEKIT_URL = "ws://localhost:7880";

export interface LiveKitConfig {
    apiUrl?: string;
    livekitUrl?: string;
}

export interface UseLiveKitResult {
    token: string | null;
    isLoading: boolean;
    error: string | null;
    livekitUrl: string;
    refetch: () => void;
}

/**
 * LiveKit 토큰 발급 및 연결 관리를 위한 공통 훅
 * 
 * @param roomId - 참가할 방 ID
 * @param username - 사용자 닉네임
 * @param config - 선택적 설정 (API URL, LiveKit URL)
 * 
 * @example
 * ```tsx
 * const { token, isLoading, error, livekitUrl } = useLiveKit('room_1', '철수');
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (!token) return null;
 * 
 * return <LiveKitRoom token={token} serverUrl={livekitUrl}>...</LiveKitRoom>;
 * ```
 */
export function useLiveKit(
    roomId: string,
    username: string,
    config?: LiveKitConfig
): UseLiveKitResult {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiUrl = config?.apiUrl || API_URL;
    const livekitUrl = config?.livekitUrl || LIVEKIT_URL;

    const fetchToken = useCallback(async () => {
        if (!roomId || !username) {
            setError('roomId와 username이 필요합니다.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 고유한 userId 생성 (세션 기반)
            const userId = `user_${username}_${Date.now()}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, userId, username }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: 토큰 발급 실패`);
            }

            const data = await response.json();

            if (!data.token) {
                throw new Error('토큰이 응답에 없습니다.');
            }

            setToken(data.token);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
            console.error('🔴 LiveKit 토큰 발급 실패:', errorMessage);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [roomId, username, apiUrl]);

    useEffect(() => {
        fetchToken();
    }, [fetchToken]);

    return {
        token,
        isLoading,
        error,
        livekitUrl,
        refetch: fetchToken,
    };
}

export default useLiveKit;
