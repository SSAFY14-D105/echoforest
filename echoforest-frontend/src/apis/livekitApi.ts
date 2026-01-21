/**
 * LiveKit 토큰 API
 * 백엔드에서 LiveKit 접속 토큰을 발급받습니다.
 */

const BASE_URL = 'http://localhost:9001/api';

export interface TokenRequest {
    roomName: string;
    userId: string;
    username: string;
}

export interface TokenResponse {
    token: string;
}

/**
 * LiveKit 토큰 발급 API
 */
export async function getLiveKitToken(req: TokenRequest): Promise<TokenResponse> {
    const token = localStorage.getItem('token');

    const res = await fetch(`${BASE_URL}/livekit/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error('LiveKit 토큰 발급 실패:', errorText);
        throw new Error('LiveKit 토큰 발급에 실패했습니다.');
    }

    return res.json();
}
