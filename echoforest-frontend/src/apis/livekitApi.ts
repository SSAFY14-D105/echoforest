/**
 * LiveKit API 서비스
 * 백엔드에서 토큰을 발급받는 공통 함수
 */

// 환경 설정 (환경변수로 관리 추천)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://i14d105.p.ssafy.io/api';
export const LIVEKIT_SERVER_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://i14d105.p.ssafy.io:7880';

/**
 * 토큰 발급 요청 타입
 */
export interface LiveKitTokenRequest {
    roomName: string;   // 방 이름
    userId: string;     // 유저 고유 ID
    username: string;   // 닉네임
}

/**
 * 토큰 발급 응답 타입
 */
export interface LiveKitTokenResponse {
    token: string;
}

/**
 * LiveKit 토큰 발급 API 호출
 * 
 * @example
 * const { token } = await fetchLiveKitToken({
 *   roomName: 'room_1',
 *   userId: 'user_123',
 *   username: '철수'
 * });
 */
export async function fetchLiveKitToken(
    request: LiveKitTokenRequest
): Promise<LiveKitTokenResponse> {
    const response = await fetch(`${API_BASE_URL}/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`토큰 발급 실패: ${response.status}`);
    }

    return response.json();
}

/**
 * 고유 사용자 ID 생성
 */
export function generateUserId(prefix = 'user'): string {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
