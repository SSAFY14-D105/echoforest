/**
 * 인증 관련 API 서비스
 * 백엔드 연동 시 BASE_URL과 실제 API 엔드포인트를 수정하세요.
 */

import { httpClient } from './httpClient';

/**
 * HTTP 상태 코드별 에러 메시지 반환
 */
function getErrorMessage(status: number): string {
    switch (status) {
        case 400:
            return '가입되지 않은 계정입니다.';
        case 401:
            return '인증되지 않았습니다. 올바른 인증 정보를 제공해주세요.';
        case 403:
            return '요청한 작업을 수행하기 위한 권한이 없습니다.';
        case 404:
            return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        case 405:
            return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        case 409:
            return '이미 다른 기기에서 접속 중입니다.';
        case 419:
            return '인증이 만료되었습니다. 다시 로그인해주세요.';
        case 429:
            return '요청 횟수가 제한을 초과했습니다. 잠시 후 다시 시도해주세요.';
        case 500:
            return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        case 504:
            return '외부 서비스와의 연결이 지연되었습니다. 잠시 후 다시 시도해주세요.';
        case 503:
            return '서비스 점검 중입니다. 잠시 후 다시 시도해주세요.';
        default:
            return '서버에 연결할 수 없습니다.';
    }
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface SignupRequest {
    username: string;
    password: string;
    nickname: string;
    email: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data?: {
        nickname: string;
        token?: string;
    };
}

export interface LoginResponse {
    token: string;
    nickname: string;  // 백엔드에서 반환하는 닉네임
}

export interface SignupResponse {
    message: string;
}

export interface CheckIdResponse {
    isDuplicate: boolean;
}

/**
 * 로그인 API
 */
export async function login(req: LoginRequest): Promise<LoginResponse> {
    const res = await httpClient('/user/login', {
        method: 'POST',
        body: JSON.stringify(req),
    });

    if (!res.ok) {

        // 에러 메시지 파싱 (GlobalExceptionHandler의 "message" 또는 "error" 필드)
        try {
            const errorData = await res.json();
            if (errorData.message) {
                throw new Error(errorData.message);
            }
            if (errorData.error) {
                throw new Error(errorData.error);
            }
        } catch (e) {
            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                throw e;
            }
        }

        // 상태 코드별 기본 메시지
        throw new Error(getErrorMessage(res.status));
    }

    return res.json();
}

/**
 * 회원가입 API
 */
export async function signup(req: SignupRequest): Promise<SignupResponse> {
    const res = await httpClient('/user/signup', {
        method: 'POST',
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        throw new Error(getErrorMessage(res.status));
    }

    return res.json();
}

/**
 * 아이디 중복 확인 API
 */
export async function checkLoginId(username: string): Promise<CheckIdResponse> {
    const res = await httpClient(`/user/check-id?username=${encodeURIComponent(username)}`, {
        method: 'GET',
    });

    if (!res.ok) {
        throw new Error(getErrorMessage(res.status));
    }

    return res.json();
}

/**
 * 닉네임 중복 확인 API
 */
export async function checkNickname(nickname: string): Promise<CheckIdResponse> {
    const res = await httpClient(`/user/check-nickname?nickname=${encodeURIComponent(nickname)}`, {
        method: 'GET',
    });

    if (!res.ok) {
        throw new Error(getErrorMessage(res.status));
    }

    return res.json();
}

/**
 * 닉네임 변경 API
 */
export async function updateNickname(userId: number, newNickname: string): Promise<void> {
    const res = await httpClient('/user/nickname', {
        method: 'PUT',
        body: JSON.stringify({ userId, newNickname }),
    });

    if (!res.ok) {
        try {
            const errorData = await res.json();
            if (errorData.message) {
                throw new Error(errorData.message);
            }
        } catch { }

        throw new Error(getErrorMessage(res.status));
    }
}

/**
 * 로그아웃 API
 */
export async function logout(): Promise<void> {
    const res = await httpClient('/user/logout', {
        method: 'POST',
    });

    if (!res.ok) {
        throw new Error('로그아웃에 실패했습니다.');
    }
}
