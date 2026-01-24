# 🎮 EchoForest 게임 백엔드

> **SSAFY 14기 S14P11D105 - Spring Boot 게임 서버**  
> 4인 협동 플랫포머 게임의 실시간 WebSocket 통신, AI 감정 분석, 저주 시스템

---

## 📑 목차

1. [기술 스택](#-기술-스택)
2. [프로젝트 구조](#-프로젝트-구조)
3. [핵심 모듈 상세](#-핵심-모듈-상세)
4. [REST API](#-rest-api)
5. [WebSocket 통신](#-websocket-통신)
6. [STT 저주 시스템](#-stt-저주-시스템)
7. [게임 로직](#-게임-로직)
8. [설정 및 실행](#-설정-및-실행)

---

## 🛠 기술 스택

| 분류 | 기술 | 용도 |
|------|------|------|
| **Framework** | Spring Boot 3.x | 웹 서버 |
| **Language** | Java 21 | Virtual Threads |
| **WebSocket** | Spring WebSocket | 실시간 게임 통신 |
| **Database** | MySQL | 유저/이미지 저장 |
| **Cache** | Redis | 방 상태 관리 |
| **Auth** | JWT | 인증/인가 |
| **Video** | LiveKit | 화상 채팅 토큰 |
| **AI** | RestTemplate → FastAPI | 감정 분석 |
| **Docs** | Swagger (OpenAPI 3) | API 문서화 |

---

## 📁 프로젝트 구조

```
src/main/java/com/d105/
├── config/
│   ├── AiProperties.java        # AI 서버 설정
│   ├── JwtAuthenticationFilter.java
│   ├── LiveKitProperties.java   # LiveKit 설정
│   ├── RedisConfig.java
│   ├── SecurityConfig.java
│   ├── WebMvcConfig.java
│   └── WebSocketConfig.java     # WS 엔드포인트 설정
│
├── controller/
│   ├── UserController.java      # 회원 인증 API
│   ├── RoomController.java      # 방 관리 API
│   ├── AiController.java        # AI 이미지 생성
│   ├── LiveKitController.java   # 화상 토큰 발급
│   ├── ImageController.java     # 이미지 관리
│   └── HealthController.java    # 헬스 체크
│
├── dto/
│   ├── GameMessageDto.java      # WebSocket 메시지 DTO
│   ├── RoomInfoDto.java         # 방 정보 DTO
│   ├── user/                    # 로그인/회원가입 DTO
│   ├── token/                   # LiveKit 토큰 DTO
│   └── image/                   # 이미지 생성 DTO
│
├── entity/
│   ├── User.java                # 유저 엔티티
│   ├── Image.java               # 이미지 엔티티
│   ├── ImageParticipant.java
│   └── Map.java                 # 맵 엔티티
│
├── game/
│   ├── GameRoom.java            # 게임 룸 (저주 스택 관리)
│   ├── PlayerState.java         # 플레이어 상태
│   ├── TileCollisionManager.java
│   └── constant/
│       ├── CurseType.java       # 저주 타입 enum
│       └── RoomStatus.java      # 방 상태 enum
│
├── handler/
│   ├── GameWebSocketHandler.java    # WebSocket 핸들러
│   └── GlobalExceptionHandler.java
│
├── repository/
│   ├── GameRepository.java      # GameRoom 저장소
│   ├── UserRepository.java
│   ├── ImageRepository.java
│   └── MapRepository.java
│
├── service/
│   ├── GameService.java         # 게임 로직 (STT 처리)
│   ├── AiSentimentService.java  # AI 감정 분석
│   ├── AiGenerationService.java # AI 이미지 생성
│   ├── RedisRoomService.java    # 방 상태 관리
│   ├── UserService.java         # 유저 인증
│   ├── LiveKitService.java      # 화상 토큰
│   └── ImageService.java        # 이미지 CRUD
│
├── util/
│   ├── JwtUtil.java             # JWT 유틸리티
│   └── ByteArrayMultipartFile.java
│
└── EchoforestApplication.java   # 메인 클래스
```

---

## � 핵심 모듈 상세

### 1. Controllers

#### `UserController` (`/api/user`)
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| `POST` | `/signup` | 회원가입 |
| `POST` | `/login` | 로그인 (JWT 반환) |
| `GET` | `/check-id` | ID 중복 확인 |
| `GET` | `/check-nickname` | 닉네임 중복 확인 |
| `PUT` | `/nickname` | 닉네임 변경 |

#### `RoomController` (`/api/rooms`)
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| `GET` | `/{roomId}` | 방 정보 조회 |
| `GET` | `/my` | 내 방 조회 (재접속용) |
| `POST` | `/{roomId}/kick` | 강제 퇴장 (방장 전용) |

#### `LiveKitController` (`/api/livekit`)
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| `POST` | `/token` | 화상 채팅 토큰 발급 |

#### `AiController` (`/api/ai`)
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| `POST` | `/generate` | AI 이미지 생성 |

---

### 2. Services

#### `GameService`
게임 로직의 핵심. WebSocket 메시지 처리 담당.

| 메서드 | 설명 |
|--------|------|
| `handleCreate()` | 방 생성 (CREATE) |
| `handleJoin()` | 방 참가 (JOIN) |
| `handleMove()` | 이동 처리 (MOVE) |
| `handleReady()` | 레디 상태 변경 (READY) |
| `handleStartGame()` | 게임 시작 (START_GAME) |
| `handleNextStage()` | 다음 스테이지 (NEXT_STAGE) |
| `handleSpeechBatch()` | **발화 배치 분석 (SPEECH_BATCH)** |
| `handleCurseRelease()` | **저주 해제 (CURSE_RELEASE)** |
| `triggerCurse()` | 저주 발동 로직 |

#### `AiSentimentService`
AI 서버와 통신하여 감정 분석 수행.

```java
// POST /api/v1/analyze/batch 호출
int analyzeBatch(List<String> texts);
// 반환: total_stack_delta (스택 증가량)
```

| 심각도 | 라벨 | 스택 증가 |
|--------|------|----------|
| 1 | critical | +5 |
| 2 | severe | +3 |
| 3 | mild | +1 |

#### `RedisRoomService`
Redis 기반 방 상태 관리.

| 메서드 | 설명 |
|--------|------|
| `createRoom()` | 방 생성 (6자리 코드) |
| `joinRoom()` | 방 참가 |
| `leaveRoom()` | 방 나가기 |
| `setReady()` | 레디 상태 설정 |
| `startGame()` | 게임 시작 |
| `incrementKiss()` | 뽀뽀 카운트 증가 |
| `incrementCurse()` | 저주 카운트 증가 |

---

### 3. Game Logic

#### `GameRoom`
게임 룸 단위의 상태 관리.

| 필드 | 타입 | 설명 |
|------|------|------|
| `roomId` | String | 방 ID (6자리) |
| `players` | Map | 세션별 플레이어 상태 |
| `curseStack` | int | 저주 스택 (0~10) |
| `currentMapId` | int | 현재 맵 ID |
| `hostId` | String | 방장 ID |

| 메서드 | 설명 |
|--------|------|
| `addCurseStack(delta)` | 스택 증가, 10 도달 시 true 반환 |
| `resetCurseStack()` | 저주 발동 후 스택 초기화 |
| `getRandomPlayerUsername()` | 저주 대상 랜덤 선정 |
| `broadcast(message)` | 방 전체에 메시지 전송 |
| `kickPlayer(username)` | 강제 퇴장 |

#### `PlayerState`
플레이어 개별 상태.

| 필드 | 설명 |
|------|------|
| `x, y` | 위치 |
| `vx, vy` | 속도 |
| `anim` | 현재 애니메이션 |
| `lastInputTime` | 마지막 입력 시간 (AFK 감지) |

---

### 4. Entities

#### `User`
```java
@Entity
public class User {
    Long id;
    String username;     // 로그인 ID
    String password;
    String nickname;
    String email;
    Integer kissCount;   // 뽀뽀 횟수
    Integer curseCount;  // 저주 횟수
    BigDecimal mannerScore;  // 매너 점수 (기본 36.5)
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
```

---

## 📡 REST API

### Swagger 문서
```
http://localhost:9001/swagger-ui/index.html
```

### 주요 엔드포인트

| 태그 | 엔드포인트 | 설명 |
|------|----------|------|
| User | `POST /api/user/signup` | 회원가입 |
| User | `POST /api/user/login` | 로그인 |
| Room | `GET /api/rooms/{roomId}` | 방 정보 |
| Room | `POST /api/rooms/{roomId}/kick` | 강제 퇴장 |
| LiveKit | `POST /api/livekit/token` | 토큰 발급 |
| AI | `POST /api/ai/generate` | 이미지 생성 |

---

## � WebSocket 통신

### 엔드포인트
```
ws://localhost:9001/ws/game?roomId={roomId}&playerId={playerId}
```

### 메시지 타입

#### 클라이언트 → 서버

| Type | 설명 | 주요 필드 |
|------|------|----------|
| `CREATE` | 방 생성 | `username` |
| `JOIN` | 방 참가 | `username`, `roomId` |
| `MOVE` | 이동 | `x`, `y`, `vx`, `vy`, `anim` |
| `READY` | 레디 | `isReady` |
| `START_GAME` | 게임 시작 | |
| `NEXT_STAGE` | 다음 스테이지 | |
| `PING` | 핑 | |
| `SPEECH_BATCH` | 발화 배치 | `texts[]` |
| `CURSE_RELEASE` | 저주 해제 | `word` |

#### 서버 → 클라이언트

| Type | 설명 | 주요 필드 |
|------|------|----------|
| `ROOM_CREATED` | 방 생성됨 | `roomId` |
| `PLAYER_JOINED` | 플레이어 입장 | `username` |
| `PLAYER_LEFT` | 플레이어 퇴장 | `username` |
| `MOVE` | 이동 동기화 | `username`, `x`, `y` |
| `GAME_STARTED` | 게임 시작 | `stage` |
| `PONG` | 퐁 | |
| `STACK_UPDATED` | 스택 업데이트 | `stack`, `delta`, `reason` |
| `CURSE_TRIGGERED` | 저주 발동 | `cursedPlayerId`, `mapId` |
| `CURSE_RELEASED` | 저주 해제 | `releasedPlayerId`, `word` |

---

## 🔮 STT 저주 시스템

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                         STT 저주 시스템                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  클라이언트                                                          │
│     │                                                               │
│     ▼ SPEECH_BATCH { texts: [...] }                                 │
│                                                                     │
│  GameWebSocketHandler                                               │
│     │                                                               │
│     ▼ case "SPEECH_BATCH"                                           │
│                                                                     │
│  GameService.handleSpeechBatch()                                    │
│     │                                                               │
│     ├─ AiSentimentService.analyzeBatch(texts)                       │
│     │     │                                                         │
│     │     ▼ POST /api/v1/analyze/batch → AI 서버                    │
│     │     │                                                         │
│     │     ◄── { total_stack_delta: N }                              │
│     │                                                               │
│     ├─ room.addCurseStack(delta)                                    │
│     │                                                               │
│     ├─ broadcast(STACK_UPDATED { stack, delta })                    │
│     │                                                               │
│     └─ if (stack >= 10):                                            │
│           ├─ room.getRandomPlayerUsername() → 대상 선정             │
│           ├─ room.triggerCurseEvent() → 저주 적용                   │
│           ├─ room.resetCurseStack() → 스택 초기화                   │
│           └─ broadcast(CURSE_TRIGGERED { cursedPlayerId, mapId })   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 심각도별 스택

| 레벨 | 라벨 | 예시 단어 | 스택 |
|------|------|----------|------|
| 1 | critical | 씨발, 개새끼 | +5 |
| 2 | severe | 짜증나, 열받네 | +3 |
| 3 | mild | 바보, 멍청이 | +1 |

### 저주 해제

긍정어 ("뽀뽀", "사랑해", "좋아해") 감지 시:
```
CURSE_RELEASE { word: "사랑해" }
    ↓
GameService.handleCurseRelease()
    ↓
room.triggerCurseEvent(sessionId, true)  // 저주 해제
    ↓
broadcast(CURSE_RELEASED { releasedPlayerId, word })
```

---

## ⚙️ 설정 및 실행

### 환경 변수

```properties
# application.properties

# 서버
SERVER_PORT=9001

# 데이터베이스
DB_URL=jdbc:mysql://localhost:3307/echoforest
DB_USERNAME=root
DB_PASSWORD=root

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AI 서버
AI_MODEL_URL=http://localhost:8000
AI_MODEL_API_KEY=your-api-key

# LiveKit
LIVEKIT_URL=wss://your-livekit.server.com
LIVEKIT_KEY=your-key
LIVEKIT_SECRET=your-secret

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=604800000
```

### 빌드 및 실행

```bash
# 빌드
./gradlew build -x test

# 실행
./gradlew bootRun
```

### Docker (옵션)

```bash
# MySQL
docker run -d -p 3307:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=echoforest \
  mysql:8.0

# Redis
docker run -d -p 6379:6379 redis:alpine
```

---

## 🧪 테스트

### WebSocket 테스트 (wscat)

```bash
# 연결
wscat -c "ws://localhost:9001/ws/game?roomId=TEST01&playerId=user1"

# 방 생성
{"type":"CREATE","username":"user1"}

# 방 참가
{"type":"JOIN","username":"user2","roomId":"ABC123"}

# 발화 배치
{"type":"SPEECH_BATCH","roomId":"ABC123","texts":["바보야","멍청이"]}

# 저주 해제
{"type":"CURSE_RELEASE","roomId":"ABC123","word":"사랑해"}
```

### API 테스트

```bash
# 로그인
curl -X POST http://localhost:9001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'

# 방 정보
curl http://localhost:9001/api/rooms/ABC123

# LiveKit 토큰
curl -X POST http://localhost:9001/api/livekit/token \
  -H "Content-Type: application/json" \
  -d '{"roomId":"ABC123","userId":"user1","username":"닉네임"}'
```

---

## 👥 팀 정보

**SSAFY 14기 S14P11D105**
