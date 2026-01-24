# 🔧 백엔드 아키텍처 문서 (Spring Boot 3 + Java 21)

> LLM 온보딩용: 백엔드 코드 구조 및 핵심 로직 이해

## 1. 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **패키지** | `com.d105` |
| **프레임워크** | Spring Boot 3.5.9 |
| **Java** | 21 |
| **빌드 도구** | Gradle |

---

## 2. 핵심 의존성

```gradle
spring-boot-starter-web         # REST API
spring-boot-starter-websocket   # 실시간 게임 통신
spring-boot-starter-data-jpa    # MySQL
spring-boot-starter-data-redis  # 실시간 상태 (방/플레이어)
spring-boot-starter-security    # JWT 인증
io.livekit:livekit-server:0.9.0 # 화상통화 토큰 발급
springdoc-openapi              # Swagger UI
```

---

## 3. 폴더 구조

```
com.d105/
├── config/              # 설정
│   ├── WebSocketConfig      # /ws/game 엔드포인트 등록
│   ├── SecurityConfig       # JWT 필터
│   ├── RedisConfig
│   └── LiveKitProperties
├── controller/          # REST API
│   ├── UserController       # 회원가입/로그인
│   ├── RoomController       # 방 조회/강퇴
│   ├── LiveKitController    # LiveKit 토큰 발급
│   └── AiController         # AI 이미지 생성
├── handler/             # WebSocket
│   └── GameWebSocketHandler # 게임 메시지 라우팅
├── service/             # 비즈니스 로직
│   ├── GameService          # 게임 로직 (방생성/참가/이동)
│   ├── RedisRoomService     # Redis 방 상태 관리
│   ├── UserService          # 회원 CRUD
│   └── LiveKitService       # LiveKit 토큰 생성
├── game/                # 게임 엔진
│   ├── GameRoom             # 게임 루프 (Tick Loop)
│   ├── PlayerState          # 플레이어 상태 (위치/저주/물리)
│   ├── TileCollisionManager # 충돌 처리
│   └── constant/
│       ├── CurseType        # 저주 종류 (ENUM)
│       └── RoomStatus       # 방 상태 (ENUM)
├── entity/              # JPA 엔티티
│   ├── User
│   ├── Map
│   └── Image
├── dto/                 # 데이터 전송 객체
│   ├── GameMessageDto       # WebSocket 메시지 규격
│   └── RoomInfoDto
└── repository/          # JPA Repository
```

---

## 4. 핵심 흐름

### 4.1 WebSocket 게임 통신

```
[클라이언트] --WebSocket--> ws://server:9001/ws/game
     │
     ▼
[GameWebSocketHandler] ──── type 분기 ────▶ [GameService]
     │
     ├── CREATE  → 방 생성 (6자리 코드)
     ├── JOIN    → 방 참가 (재접속 지원)
     ├── MOVE    → 위치 업데이트 (Client-Authoritative)
     ├── READY   → 준비 상태 토글
     ├── START_GAME → 게임 시작 (방장만)
     ├── NEXT_STAGE → 스테이지 진행
     └── PING    → 핑퐁
```

### 4.2 GameMessageDto 구조

```json
{
  "type": "MOVE",           // 메시지 타입
  "roomId": "ABC123",       // 방 코드
  "username": "player1",    // 플레이어 닉네임
  "x": 150.5,               // X 좌표
  "y": 200.0,               // Y 좌표
  "vx": 2.5,                // X 속도
  "vy": -1.2,               // Y 속도
  "anim": "walk_right",     // 애니메이션 상태
  "content": "시스템 메시지" // 에러/알림용
}
```

---

## 5. 게임 엔진 (GameRoom)

### 5.1 Tick Loop (60Hz)

```java
// 초당 60번 실행
private static final double TICK_DURATION = 1.0 / 60.0;

public void run() {
    while (running) {
        long startTime = System.nanoTime();
        
        checkAfkPlayers();         // AFK 감지
        checkDisconnectedPlayers(); // 장기 미접속 퇴장
        processInputs();           // 입력 큐 처리
        updatePhysics(TICK_DURATION); // 물리 연산
        
        // 20Hz로 상태 브로드캐스트
        if (broadcastTimer >= BROADCAST_INTERVAL) {
            broadcastState();
            broadcastTimer = 0;
        }
        
        // 프레임 레이트 유지
        sleep(적절한_시간);
    }
}
```

### 5.2 PlayerState (플레이어 상태)

| 필드 | 타입 | 설명 |
|------|------|------|
| `x`, `y` | double | 위치 |
| `vx`, `vy` | double | 속도 |
| `width`, `height` | double | 크기 (저주 시 변경) |
| `hp` | int | 체력 (TIME_BOMB 저주용) |
| `isDead` | boolean | 사망 여부 |
| `isAfk` | boolean | 잠수 여부 |
| `activeCurses` | Map<CurseType, Long> | 현재 저주 목록 |
| `anim` | String | 현재 애니메이션 |

### 5.3 저주 시스템 (CurseType)

```java
public enum CurseType {
    BIG_AND_SLOW,    // 몸 커짐 + 속도↓
    TIME_BOMB,       // 시한부 (HP 감소)
    INVERT_CONTROL   // 좌우 반전
}
```

**저주 효과 적용**:
- `BIG_AND_SLOW`: 크기 80px, 속도 50%
- `TIME_BOMB`: 초당 10 데미지, HP 0 시 사망
- `INVERT_CONTROL`: 좌우 입력 반전

---

## 6. Redis 방 관리 (RedisRoomService)

### 6.1 키 구조

```
room:{roomId}              → Hash (hostId, status, currentStage)
room:{roomId}:players      → Set (플레이어 닉네임 목록)
room:{roomId}:ready        → Set (준비 완료 플레이어)
room:{roomId}:kiss         → Hash (닉네임 → 뽀뽀 횟수)
room:{roomId}:curse        → Hash (닉네임 → 저주 횟수)
user:{username}:room       → String (참가 중인 방 ID)
```

### 6.2 TTL (좀비 방 방지)

| 상태 | TTL |
|------|-----|
| 대기 방 | 2시간 |
| 게임 중 | 4시간 |
| 유저-방 매핑 | 2시간 |

### 6.3 방 상태 (RoomStatus)

```java
public enum RoomStatus {
    WAITING,   // 대기 중
    PLAYING,   // 게임 중
    ENDED      // 종료됨
}
```

---

## 7. REST API 엔드포인트

### 7.1 User API (`/api/user`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/signup` | 회원가입 |
| POST | `/login` | 로그인 (JWT 반환) |
| GET | `/check-id` | 아이디 중복 확인 |
| GET | `/check-nickname` | 닉네임 중복 확인 |
| PUT | `/nickname` | 닉네임 변경 |

### 7.2 Room API (`/api/rooms`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/{roomId}` | 방 정보 조회 |
| GET | `/my` | 내가 참가 중인 방 조회 |
| POST | `/{roomId}/kick` | 강제 퇴장 (방장) |

### 7.3 LiveKit API (`/api/livekit`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/token` | LiveKit 접속 토큰 발급 |

---

## 8. DB 스키마 (MySQL)

### users
```sql
id, username, password, nickname, email,
kiss_count, curse_count, manner_score,
created_at, updated_at
```

### maps
```sql
id, map_name, creator_id, tile_data (JSON),
thumbnail_url, is_official, created_at
```

### game_sessions
```sql
id, room_id, map_id, player_ids (JSON),
status, started_at, ended_at
```

### cringe_stats
```sql
id, user_id, session_id, stat_type, count_value, created_at
```

---

## 9. 인증 흐름

```
[로그인] → JWT 발급 → 헤더에 토큰 포함
     ↓
[WebSocket 연결] → JwtHandshakeInterceptor가 토큰 검증
     ↓
[게임 진행] → 세션에서 사용자 정보 추출
```

---

## 10. 주요 설정 파일

| 파일 | 설명 |
|------|------|
| `application.yml` | 환경 변수 (DB, Redis, LiveKit) |
| `Dockerfile` | 컨테이너 빌드 |
| `docker-compose.yml` | Redis, MySQL, 앱 구성 |
| `nginx.conf` | 리버스 프록시 설정 |

---

> 📅 마지막 업데이트: 2026-01-24
> 📁 분석 대상: `02_S14P11D105_backend/echoforest-backend/`
