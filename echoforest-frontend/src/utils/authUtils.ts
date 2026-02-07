/**
 * JWT 토큰 만료 여부 확인
 * @param token JWT 토큰 문자열
 * @returns 만료되었으면 true, 유효하면 false
 */
export function isTokenExpired(token: string): boolean {
    if (!token) return true;
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return true;

        // Base64 URL Safe 처리 (옵션) 및 디코딩
        const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const decodedJson = atob(base64);
        const decoded = JSON.parse(decodedJson);

        const exp = decoded.exp;
        if (!exp) return true; // 만료 시간이 없으면 안전하게 만료된 것으로 간주

        // exp는 초 단위, Date.now()는 밀리초 단위
        return Date.now() >= exp * 1000;
    } catch (e) {
        return true; // 파싱 실패 시 만료된 것으로 처리
    }
}
