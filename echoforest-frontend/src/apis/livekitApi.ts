/**
 * LiveKit 관련 API 서비스
 * 백엔드에서 토큰을 발급받아 LiveKit 서버에 연결합니다.
 */

// 환경별 설정
// 개발 환경: Vite 프록시를 사용하기 위해 상대 경로 사용
// 프로덕션 환경: 절대 URL 사용
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? '' : 'https://i14d105.p.ssafy.io');
export const LIVEKIT_SERVER_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://i14d105.p.ssafy.io:7880';

/**
 * LiveKit 토큰 발급 요청 타입
 */
export interface LiveKitTokenRequest {
    roomName: string;      // 방 이름 (roomId)
    userId: string;        // 사용자 고유 ID
    username: string;      // 표시될 사용자 이름
}

/**
 * LiveKit 토큰 발급 응답 타입
 */
export interface LiveKitTokenResponse {
    token: string;         // LiveKit 접속 토큰
}

/**
 * API 에러 클래스
 */
export class LiveKitApiError extends Error {
    statusCode?: number;
    originalError?: unknown;

    constructor(
        message: string,
        statusCode?: number,
        originalError?: unknown
    ) {
        super(message);
        this.name = 'LiveKitApiError';
        this.statusCode = statusCode;
        this.originalError = originalError;
    }
}

/**
 * LiveKit 토큰 발급 API
 * 
 * @param request - 토큰 발급 요청 데이터
 * @returns LiveKit 접속 토큰
 * @throws LiveKitApiError - API 요청 실패 시
 * 
 * @example
 * ```ts
 * const { token } = await fetchLiveKitToken({
 *   roomName: 'room_123',
 *   userId: 'user_456',
 *   username: '홍길동'
 * });
 * ```
 */
export async function fetchLiveKitToken(
    request: LiveKitTokenRequest
): Promise<LiveKitTokenResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/livekit/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new LiveKitApiError(
                `토큰 발급 실패: ${response.status} ${response.statusText}`,
                response.status,
                errorText
            );
        }

        const data = await response.json();

        if (!data.token) {
            throw new LiveKitApiError('응답에 토큰이 없습니다.');
        }

        return data as LiveKitTokenResponse;
    } catch (error) {
        if (error instanceof LiveKitApiError) {
            throw error;
        }
        throw new LiveKitApiError(
            '토큰 발급 중 네트워크 오류가 발생했습니다.',
            undefined,
            error
        );
    }
}

/**
 * 고유 사용자 ID 생성 유틸리티
 * 
 * @param prefix - ID 접두사 (기본값: 'user')
 * @returns 고유 사용자 ID
 */
export function generateUserId(prefix: string = 'user'): string {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
