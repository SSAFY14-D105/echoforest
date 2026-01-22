# 🔗 EchoForest AI-Game Server API 명세서

> **버전**: v1.0  
> **작성일**: 2026-01-22  
> **목적**: AI 서버와 게임 서버 간 통신 인터페이스 정의

---

## 📐 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         프론트엔드 (브라우저)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🖐️ 모션 인식 (On-device)          🎤 음성 인식 (STT)                    │
│  MediaPipe Hands/Pose             Web Speech API                       │
│        │                                │                              │
│        │                    ┌───────────┴───────────┐                  │
│        │                    │                       │                  │
│        │               긍정어 감지              일반 발화               │
│        │               (로컬 매칭)             (욕설 분석)              │
│        │                    │                       │                  │
│        ▼                    ▼                       ▼                  │
│   WebSocket             WebSocket              REST API               │
│                                                                         │
└────────┼────────────────────┼───────────────────────┼──────────────────┘
         │                    │                       │
         ▼                    ▼                       ▼
┌─────────────────────────────────────┐    ┌─────────────────────────┐
│         🎮 게임 서버 (백엔드)         │    │     🤖 AI 서버           │
│  ─────────────────────────────────  │    │  ─────────────────────  │
│  • 게임 상태 관리                    │    │  • 욕설 분석 (UnSmile)   │
│  • 모션 이벤트 처리                  │    │  • 심각도 판정 (1,2,3)   │
│  • 부스터 처리                       │◀───│  • 게임서버에 패널티 전송 │
│  • 패널티 적용                       │    │                         │
│  • 플레이어 동기화 (WebSocket)       │    │                         │
└─────────────────────────────────────┘    └─────────────────────────┘
```

---

## 🚀 통신 흐름

### 1️⃣ 모션 인식 (Heart/Kiss)

```
프론트엔드 ──WebSocket──▶ 게임 서버
```

- AI 서버 미경유
- 프론트엔드에서 MediaPipe로 직접 판정
- 결과만 게임 서버로 전송

### 2️⃣ 긍정어 (부스터)

```
프론트엔드 ──WebSocket──▶ 게임 서버
```

- AI 서버 미경유  
- 프론트엔드에서 키워드 매칭 후 전송
- 버튼 + 키워드 조합 검증

### 3️⃣ 부정어 (욕설 감지) - **비동기 하이브리드**

```
프론트엔드 ─────REST─────▶ AI 서버
                             │
               ┌─────────────┼─────────────┐
               │ 동시 발송    │             │ 동시 발송
               ▼             │             ▼
          프론트엔드         │          게임 서버
          (UI 알림)          │        (패널티 적용)
                             │             │
                             │             ▼
                             │        WebSocket 브로드캐스트
                             │        (모든 플레이어에게)
```

**예상 레이턴시**: ~90ms

---

## 📡 API 상세 명세

---

## 🤖 AI 서버 API

> **Base URL**: `https://ai.echoforest.com` (또는 환경변수로 설정)  
> **Port**: 8000

---

### `GET /api/v1/health`

서버 상태 확인

#### Response

```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cuda"
}
```

---

### `POST /api/v1/analyze`

단일 텍스트 욕설 분석 (기존 API)

#### Request

```json
{
  "text": "분석할 텍스트"
}
```

#### Response

```json
{
  "text": "분석할 텍스트",
  "is_negative": true,
  "label": "악플/욕설",
  "confidence": 0.92,
  "severity": 1,
  "severity_label": "critical",
  "all_scores": {
    "clean": 0.05,
    "악플/욕설": 0.92,
    "남성혐오": 0.01,
    "여성혐오": 0.02,
    ...
  }
}
```

---

### `POST /api/v1/analyze/realtime` ⭐ **신규 API**

실시간 욕설 분석 + 게임 서버 연동

#### Request

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `text` | string | ✅ | 분석할 텍스트 |
| `userId` | string | ✅ | 사용자 고유 ID |
| `sessionId` | string | ✅ | 게임 세션 ID |
| `roomId` | string | ✅ | 게임 방 ID |

```json
{
  "text": "사용자가 말한 텍스트",
  "userId": "user_abc123",
  "sessionId": "session_xyz789",
  "roomId": "room_456"
}
```

#### Response (프론트엔드로 즉시 반환)

```json
{
  "is_negative": true,
  "severity": 2,
  "severity_label": "severe",
  "label": "악플/욕설",
  "confidence": 0.75,
  "penalty_sent": true,
  "message": "욕설이 감지되었습니다. 경고가 적용됩니다."
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `is_negative` | boolean | 욕설 여부 |
| `severity` | integer | 심각도 (0=clean, 1=critical, 2=severe, 3=mild) |
| `severity_label` | string | 심각도 라벨 |
| `label` | string | 감지된 카테고리 |
| `confidence` | float | 신뢰도 (0~1) |
| `penalty_sent` | boolean | 게임 서버에 패널티 전송 여부 |
| `message` | string | 사용자에게 표시할 메시지 |

#### 내부 동작

욕설이 감지되면 AI 서버가 **비동기로** 게임 서버에 패널티 요청 전송:

```python
# AI 서버 내부 로직 (pseudo-code)
if result['is_negative']:
    asyncio.create_task(
        send_penalty_to_game_server(userId, sessionId, roomId, severity)
    )
```

---

## 🎮 게임 서버 API

> **Base URL**: `https://api.echoforest.com`  
> **Protocol**: REST + WebSocket

---

### `POST /api/game/penalty` ⭐ **AI 서버가 호출**

AI 서버에서 욕설 감지 시 패널티 적용 요청

#### Request Headers

```
Content-Type: application/json
X-AI-Server-Token: {AI_SERVER_SECRET_KEY}  // 서버 간 인증
```

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `userId` | string | ✅ | 패널티 대상 사용자 ID |
| `sessionId` | string | ✅ | 게임 세션 ID |
| `roomId` | string | ✅ | 게임 방 ID |
| `severity` | integer | ✅ | 심각도 (1=critical, 2=severe, 3=mild) |
| `severityLabel` | string | ✅ | 심각도 라벨 |
| `detectedCategory` | string | ✅ | 감지된 욕설 카테고리 |
| `confidence` | float | ✅ | 신뢰도 |
| `timestamp` | string | ✅ | 감지 시각 (ISO 8601) |

```json
{
  "userId": "user_abc123",
  "sessionId": "session_xyz789",
  "roomId": "room_456",
  "severity": 2,
  "severityLabel": "severe",
  "detectedCategory": "악플/욕설",
  "confidence": 0.75,
  "timestamp": "2026-01-22T12:50:30+09:00"
}
```

#### Response

```json
{
  "success": true,
  "penaltyApplied": "speed_reduction",
  "penaltyDuration": 5,
  "warningCount": 2,
  "maxWarnings": 3,
  "message": "경고 2회. 1회 더 위반 시 퇴장됩니다."
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | boolean | 패널티 적용 성공 여부 |
| `penaltyApplied` | string | 적용된 패널티 종류 |
| `penaltyDuration` | integer | 패널티 지속 시간 (초) |
| `warningCount` | integer | 현재 경고 횟수 |
| `maxWarnings` | integer | 최대 허용 경고 횟수 |
| `message` | string | 결과 메시지 |

#### 패널티 종류 (예시)

| severity | 패널티 | 설명 |
|----------|--------|------|
| 3 (mild) | `warning` | 경고만 표시 |
| 2 (severe) | `speed_reduction` | 5초간 이동속도 50% 감소 |
| 1 (critical) | `freeze` | 3초간 행동 불가 + 경고 |

---

### `POST /api/game/motion`

프론트엔드에서 모션 이벤트 전송

#### Request

```json
{
  "userId": "user_abc123",
  "sessionId": "session_xyz789",
  "roomId": "room_456",
  "motionType": "heart",  // "heart" | "kiss"
  "targetUserId": "user_def456",  // 대상 플레이어 (optional)
  "timestamp": "2026-01-22T12:50:30+09:00"
}
```

#### Response

```json
{
  "success": true,
  "effectApplied": "heal",
  "effectValue": 10,
  "message": "하트 모션으로 치유 효과 발동!"
}
```

---

### `POST /api/game/booster`

프론트엔드에서 부스터 사용 요청

#### Request

```json
{
  "userId": "user_abc123",
  "sessionId": "session_xyz789",
  "roomId": "room_456",
  "boosterType": "speed",
  "keyword": "화이팅",  // 사용자가 말한 긍정어
  "timestamp": "2026-01-22T12:50:30+09:00"
}
```

#### 긍정어 키워드 예시

| 키워드 | 부스터 효과 |
|--------|------------|
| 화이팅 | 속도 부스트 |
| 힘내 | 체력 회복 |
| 좋아 | 공격력 증가 |
| 최고야 | 방어력 증가 |

#### Response

```json
{
  "success": true,
  "boosterApplied": "speed",
  "boosterDuration": 3,
  "message": "속도 부스터 발동! (3초)"
}
```

---

## 🔐 인증 및 보안

### AI 서버 → 게임 서버 인증

```
X-AI-Server-Token: {AI_SERVER_SECRET_KEY}
```

- 환경 변수로 관리
- 서버 간 통신에만 사용
- 프론트엔드에 노출되지 않음

### 프론트엔드 → 서버 인증

- JWT 토큰 사용 (기존 인증 방식 유지)
- WebSocket 연결 시 토큰 검증

---

## ⚙️ 환경 변수

### AI 서버

```env
# 게임 서버 연동
GAME_SERVER_URL=https://api.echoforest.com
AI_SERVER_SECRET_KEY=your-secret-key-here

# 모델 설정
MODEL_THRESHOLD=0.174
```

### 게임 서버

```env
# AI 서버 검증
AI_SERVER_SECRET_KEY=your-secret-key-here

# 패널티 설정
MAX_WARNINGS=3
PENALTY_MILD_DURATION=0
PENALTY_SEVERE_DURATION=5
PENALTY_CRITICAL_DURATION=3
```

---

## 📊 심각도 기준

| 레벨 | Label | 점수 범위 | 패널티 |
|------|-------|----------|--------|
| 0 | clean | < 17.4% | 없음 |
| 3 | mild | 17.4% ~ 50% | 경고 |
| 2 | severe | 50% ~ 80% | 속도 감소 (5초) |
| 1 | critical | 80%+ | 행동 불가 (3초) |

---

## 🔄 WebSocket 이벤트 (게임 서버 → 프론트엔드)

패널티가 적용되면 게임 서버가 해당 룸의 모든 플레이어에게 브로드캐스트

### `penalty_applied` 이벤트

```json
{
  "event": "penalty_applied",
  "data": {
    "targetUserId": "user_abc123",
    "penaltyType": "speed_reduction",
    "duration": 5,
    "reason": "욕설 감지",
    "warningCount": 2
  }
}
```

### `player_kicked` 이벤트 (3회 경고 시)

```json
{
  "event": "player_kicked",
  "data": {
    "targetUserId": "user_abc123",
    "reason": "반복적 욕설 사용 (3회 경고)"
  }
}
```

---

## 📝 에러 응답

### 공통 에러 형식

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SESSION",
    "message": "유효하지 않은 세션입니다."
  }
}
```

### 에러 코드

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `INVALID_TOKEN` | 401 | 인증 토큰 오류 |
| `INVALID_SESSION` | 400 | 유효하지 않은 세션 |
| `USER_NOT_FOUND` | 404 | 사용자 없음 |
| `ROOM_NOT_FOUND` | 404 | 게임방 없음 |
| `AI_SERVER_ERROR` | 503 | AI 서버 연결 실패 |
| `MODEL_NOT_LOADED` | 503 | AI 모델 로드 실패 |

---

## 🧪 테스트 예시

### cURL - 실시간 분석 API

```bash
curl -X POST https://ai.echoforest.com/api/v1/analyze/realtime \
  -H "Content-Type: application/json" \
  -d '{
    "text": "테스트 메시지",
    "userId": "test_user",
    "sessionId": "test_session",
    "roomId": "test_room"
  }'
```

### cURL - 패널티 API (AI 서버 → 게임 서버)

```bash
curl -X POST https://api.echoforest.com/api/game/penalty \
  -H "Content-Type: application/json" \
  -H "X-AI-Server-Token: your-secret-key" \
  -d '{
    "userId": "test_user",
    "sessionId": "test_session",
    "roomId": "test_room",
    "severity": 2,
    "severityLabel": "severe",
    "detectedCategory": "악플/욕설",
    "confidence": 0.75,
    "timestamp": "2026-01-22T12:50:30+09:00"
  }'
```

---

## ✅ 체크리스트

### 백엔드 팀 구현 필요

- [ ] `POST /api/game/penalty` - AI 서버에서 호출
- [ ] `POST /api/game/motion` - 프론트엔드에서 호출
- [ ] `POST /api/game/booster` - 프론트엔드에서 호출
- [ ] WebSocket 이벤트 브로드캐스트
- [ ] 경고 누적 및 퇴장 로직
- [ ] X-AI-Server-Token 검증

### AI 팀 구현 필요

- [ ] `POST /api/v1/analyze/realtime` 엔드포인트 추가
- [ ] 게임 서버 비동기 호출 로직
- [ ] 환경 변수 설정

### 프론트엔드 팀 구현 필요

- [ ] 실시간 분석 API 연동
- [ ] 모션/부스터 API 연동
- [ ] WebSocket 이벤트 수신 처리
- [ ] 패널티 UI 표시

---

> 💬 질문이나 수정 사항이 있으면 언제든 연락주세요!
