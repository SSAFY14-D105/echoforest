import { API_BASE_URL } from '../config';
import { useGameStore } from '../store/useGameStore';

/**
 * Fetch Wrapper with Interceptor
 * 1. 요청 시 자동으로 Authorization 헤더 추가
 * 2. 응답 시 401, 419 에러 발생하면 자동 로그아웃 처리
 */
export async function httpClient(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    // 1. 헤더 설정 (토큰 자동 추가)
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Content-Type 기본값 설정 (없으면 JSON)
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);

        // 2. 인터셉터: 인증 에러 감지 (401 Unauthorized, 419 Authentication Timeout)
        if (response.status === 401 || response.status === 419) {

            // Zustand Store를 통해 로그아웃 액션 호출 (localStorage 정리 포함)
            useGameStore.getState().logout();

            // (선택) 로그인 페이지로 리다이렉트가 필요하지만, 
            // 상태 변경(nickname=null)에 의해 App.tsx가 자동으로 LoginPage를 렌더링하도록 유도
        }

        return response;
    } catch (error) {
        console.error('[httpClient] Network Error:', error);
        throw error;
    }
}
