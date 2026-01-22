/**
 * LiveKit API 서비스
 * 백엔드에서 토큰을 발급받는 함수
 */

// 환경 설정
const API_BASE_URL = 'https://i14d105.p.ssafy.io/api';
export const LIVEKIT_SERVER_URL = 'wss://i14d105.p.ssafy.io/livekit';

/**
 * 토큰 발급 요청 타입
 */
export interface LiveKitTokenRequest {
    userId: string;
    username: string;
    roomId: string;
}

/**
 * 토큰 발급 응답 타입
 */
export interface LiveKitTokenResponse {
    token: string;
}

/**
 * LiveKit 토큰 발급 API 호출
 */
export async function fetchLiveKitToken(
    request: LiveKitTokenRequest
): Promise<LiveKitTokenResponse> {
    console.log('📡 API 호출:', `${API_BASE_URL}/livekit/token`, request);

    const response = await fetch(`${API_BASE_URL}/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    console.log('📡 API 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API 에러:', errorText);
        throw new Error(`토큰 발급 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ 토큰 발급 성공');
    return data;
}
