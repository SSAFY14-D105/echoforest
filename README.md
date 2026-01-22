# EchoForest Service

## 🛠️ Troubleshooting Log

### 1. LiveKit 화상 연결 실패 (WebSocket 404 Error)
**📅 발생 일자**: 2026-01-22
**🛑 증상**:
- 프론트엔드에서 화상 방 입장 시도 시, 브라우저 콘솔에 `WebSocket connection failed: wss://i14d105.p.ssafy.io/rtc` 에러 발생.
- HTTP Status Code: **404 Not Found**.

**🕵️ 원인 분석**:
1. **Frontend**: LiveKit SDK는 서버 URL(`wss://...`) 뒤에 자동으로 `/rtc`를 붙여 WebSocket 연결을 시도함.
2. **Backend**: LiveKit 서버는 Docker 컨테이너 내부 **7880 포트**에서 정상 구동 중.
3. **Infrastructure (Nginx)**: 외부 요청(443 Port)을 받는 Nginx 서버에 `/rtc` 경로를 LiveKit 서버(7880)로 전달(Proxy)하는 **설정이 누락**되어 있었음.

**✅ 해결 방법**:
서버의 Nginx 설정 파일 (`/etc/nginx/config` 등)에 아래 Location 블록을 추가하여 `/rtc` 요청을 LiveKit 컨테이너로 포워딩.

```nginx
# LiveKit Signaling (WebSockets)
location /rtc {
    proxy_pass http://localhost:7880;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

---

### 2. LiveKit 토큰 발급 및 API 검증
**📅 확인 일자**: 2026-01-22
**🔍 내용**:
- 백엔드 API (`/api/livekit/token`)가 정상적으로 동작하는지 확인 필요.
- 프론트엔드 `vite.config.ts`의 Proxy 설정을 제거했음에도 연결이 가능한지(CORS) 확인 필요.

**✅ 검증 결과**:
1. **API 테스트**: `Invoke-RestMethod`를 사용하여 백엔드에 직접 POST 요청 전송 -> **정상 토큰 발급 확인**.
2. **CORS**: 백엔드 `SecurityConfig`에 `http://localhost:5173` 허용 설정이 되어 있어, Vite Proxy 없이도 정상 통신 확인.



## 📂 프로젝트 구동 방법 (Frontend)

1. **설치**:
   ```bash
   npm install
   ```
2. **개발 서버 실행**:
   ```bash
   npm run dev
   ```
3. **LiveKit 테스트**:
   - `http://localhost:5173/` 접속
   - Room ID, Username 입력 후 "입장하기" 클릭
