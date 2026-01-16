/**
 * 인증 관련 API 서비스
 * 백엔드 연동 시 BASE_URL과 실제 API 엔드포인트를 수정하세요.
 */

const BASE_URL = 'http://localhost:8080/api'; // 백엔드 서버 주소

export interface LoginRequest {
    id: string;
    password: string;
}

export interface SignupRequest {
    id: string;
    password: string;
    nickname?: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data?: {
        userId: string;
        nickname: string;
        token?: string;
    };
}

/**
 * 로그인 API
 */
export async function login(req: LoginRequest): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });
    return res.json();
}

/**
 * 회원가입 API
 */
export async function signup(req: SignupRequest): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });
    return res.json();
}
