# 🎮 EchoForest 게임 서버

> **SSAFY 14기 S14P11D105 - Spring Boot 게임 백엔드**  
> 4인 협동 게임의 실시간 WebSocket 통신 및 상태 관리

---

## 📑 목차

1. [프로젝트 개요](#-프로젝트-개요)
2. [기술 스택](#-기술-스택)
3. [프로젝트 구조](#-프로젝트-구조)
4. [STT 저주 시스템](#-stt-저주-시스템)
5. [WebSocket 메시지 규격](#-websocket-메시지-규격)
6. [설정 및 실행](#-설정-및-실행)

---

## 🎯 프로젝트 개요

EchoForest 게임 서버는 4인 협동 플랫포머 게임의 백엔드입니다.  
실시간 WebSocket 통신으로 플레이어 동기화, 저주 시스템, AI 서버 연동을 담당합니다.

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Spring Boot 3.x |
| 통신 | WebSocket (TextWebSocketHandler) |
| 데이터 | Redis (방 상태 관리), MySQL (유저 데이터) |
| 가상 스레드 | Java 21 Virtual Threads |
| AI 연동 | RestTemplate → FastAPI AI 서버 |

---

## 📁 프로젝트 구조

```
echoforest-backend/src/main/java/com/d105/
├── config/
│   ├── AiProperties.java        # AI 서버 설정
│   └── WebSocketConfig.java     # WebSocket 설정
├── dto/
│   └── GameMessageDto.java      # WebSocket 메시지 DTO
├── game/
│   ├── GameRoom.java            # 게임 룸 (저주 스택 관리)
│   ├── PlayerState.java         # 플레이어 상태
│   └── TileCollisionManager.java
├── handler/
│   └── GameWebSocketHandler.java # WebSocket 핸들러
├── service/
│   ├── GameService.java         # 게임 로직 (STT 처리)
│   ├── AiSentimentService.java  # 🆕 AI 서버 호출
│   └── RedisRoomService.java
└── repository/
    └── GameRepository.java
```

---

## 🔮 STT 저주 시스템

### 개요

플레이어가 부정적 발언을 하면 **팀 공용 저주 스택**이 쌓이고,  
스택이 10에 도달하면 **랜덤 1명에게 저주**가 발동됩니다.

### 데이터 흐름

```
클라이언트 → SPEECH_BATCH { texts: [...] }
     ↓
GameService.handleSpeechBatch()
     ↓
AiSentimentService.analyzeBatch() ─→ AI 서버 POST /analyze/batch
     ↓                                    ↓
GameRoom.addCurseStack(delta)  ←── { total_stack_delta: N }
     ↓
← STACK_UPDATED { stack, delta }
     ↓
if (stack >= 10):
    GameRoom.triggerCurseEvent() + resetCurseStack()
     ↓
    ← CURSE_TRIGGERED { cursedPlayerId, mapId }
```

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `AiSentimentService.java` | AI 서버 `/analyze/batch` 호출, `total_stack_delta` 반환 |
| `GameRoom.java` | `curseStack` 관리, `addCurseStack()`, `resetCurseStack()` |
| `GameService.java` | `handleSpeechBatch()`, `handleCurseRelease()`, `triggerCurse()` |

### 심각도별 스택 증가량

| 심각도 | 라벨 | 스택 증가 |
|--------|------|----------|
| 1 | critical | +5 |
| 2 | severe | +3 |
| 3 | mild | +1 |

---

## 📡 WebSocket 메시지 규격

### 클라이언트 → 서버

| Type | 설명 | 필드 |
|------|------|------|
| `SPEECH_BATCH` | 발화 배치 분석 요청 | `texts: string[]` |
| `CURSE_RELEASE` | 저주 해제 요청 | `word: string` |

### 서버 → 클라이언트

| Type | 설명 | 필드 |
|------|------|------|
| `STACK_UPDATED` | 스택 변경 알림 | `stack`, `delta`, `reason` |
| `CURSE_TRIGGERED` | 저주 발동 알림 | `cursedPlayerId`, `mapId` |
| `CURSE_RELEASED` | 저주 해제 알림 | `releasedPlayerId`, `word` |

### 예시

**SPEECH_BATCH 요청:**
```json
{
  "type": "SPEECH_BATCH",
  "roomId": "ABC123",
  "texts": ["바보야", "멍청이", "씨발"]
}
```

**STACK_UPDATED 응답:**
```json
{
  "type": "STACK_UPDATED",
  "roomId": "ABC123",
  "stack": 7,
  "delta": 7,
  "reason": "negative_word"
}
```

**CURSE_TRIGGERED 응답:**
```json
{
  "type": "CURSE_TRIGGERED",
  "roomId": "ABC123",
  "cursedPlayerId": "UserB",
  "mapId": 1
}
```

---

## ⚙️ 설정 및 실행

### 환경 변수

```properties
# application.properties
AI_MODEL_URL=http://localhost:8000  # AI 서버 주소
DB_URL=jdbc:mysql://localhost:3307/echoforest
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 실행

```bash
# 빌드
./gradlew build -x test

# 실행
./gradlew bootRun
```

### AI 서버 연동 확인

AI 서버가 실행 중이어야 STT 분석이 동작합니다:
```bash
# AI 서버 (echoforest-ai/inference)
uvicorn app.main:app --port 8000
```

---

## 👥 팀 정보

**SSAFY 14기 S14P11D105**
