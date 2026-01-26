/**
 * 환경 변수 및 공통 설정 관리
 * .env 파일에서 VITE_ 접두사가 붙은 환경 변수를 로드합니다.
 */

// API 기본 URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// LiveKit 서버 URL
export const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

// 환경 변수 누락 시 경고
if (!API_BASE_URL || !LIVEKIT_URL) {
    console.error('❌ 환경 변수가 설정되지 않았습니다! .env 파일을 확인해주세요.');
}

console.log('🔧 Frontend Config Loaded:', { API_BASE_URL, LIVEKIT_URL });
