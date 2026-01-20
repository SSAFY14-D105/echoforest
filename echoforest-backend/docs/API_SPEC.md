# EchoForest Backend API 명세서

> 📍 Swagger UI: `https://i14d105.p.ssafy.io/swagger-ui/index.html`

---

## 🔐 Auth API (`/api/auth`)

### 1. 회원가입
```
POST /api/auth/signup
```

**Request Body:**
```json
{
  "loginId": "ssafy123",       // 영문, 숫자 4~20자
  "password": "password123!",  // 8자 이상
  "nickname": "김싸피",
  "email": "ssafy@ssafy.com"
}
```

**Response (200 OK):**
```json
{
  "message": "회원가입 성공"
}
```

---

### 2. 로그인
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "loginId": "ssafy123",
  "password": "password123!"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "nickname": "김싸피"
}
```

---

### 3. 아이디 중복 확인
```
GET /api/auth/check-id?loginId={loginId}
```

**Response (200 OK):**
```json
{
  "isDuplicate": true   // true: 중복, false: 사용 가능
}
```

---

## 🎥 LiveKit API (`/api/livekit`)

### 토큰 발급
```
POST /api/livekit/token
```

**Request Body:**
```json
{
  "roomName": "room_1",      // 입장할 게임 방 번호
  "userId": "user_1234",     // 유저 고유 ID
  "username": "철수"          // 닉네임
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

> ⚠️ LiveKit 서버 URL: `wss://i14d105.p.ssafy.io:7880`

---

## 🖼️ Image API (`/api/images`)

### 이미지 업로드
```
POST /api/images
Content-Type: multipart/form-data
```

**Request:**
- `file`: 이미지 파일 (MultipartFile)

**Response (200 OK):**
```json
{
  "url": "/images/550e8400-e29b-41d4-a716-446655440000.png"
}
```

---

## 📊 요약

| API | Method | Endpoint | 설명 |
|-----|--------|----------|------|
| 회원가입 | POST | `/api/auth/signup` | 새 계정 생성 |
| 로그인 | POST | `/api/auth/login` | JWT 토큰 발급 |
| 아이디 확인 | GET | `/api/auth/check-id` | 중복 체크 |
| LiveKit 토큰 | POST | `/api/livekit/token` | 화상채팅 토큰 |
| 이미지 업로드 | POST | `/api/images` | 파일 업로드 |
