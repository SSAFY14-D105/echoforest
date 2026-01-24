# 🎨 프론트엔드 아키텍처 문서 (React + Phaser 3 + TypeScript)

> LLM 온보딩용: 프론트엔드 코드 구조 및 핵심 로직 이해

## 1. 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프레임워크** | React 19 + Vite 7 |
| **게임 엔진** | Phaser 3.90 + Matter.js |
| **언어** | TypeScript 5.9 |
| **상태 관리** | Zustand 5 |
| **화상통화** | LiveKit |

---

## 2. 핵심 의존성

```json
"dependencies": {
  "react": "^19.2.0",
  "phaser": "^3.90.0",
  "zustand": "^5.0.10",
  "@livekit/components-react": "^2.9.19",
  "livekit-client": "^2.17.0"
}
```

---

## 3. 폴더 구조

```
src/
├── App.tsx                    # 라우팅 (Login → Lobby → Game)
├── main.tsx                   # 엔트리 포인트
├── features/                  # 기능별 모듈 (Feature-Sliced Design)
│   ├── auth/                  # 인증
│   │   ├── api/authApi.ts
│   │   ├── components/LoginForm.tsx, SignupForm.tsx
│   │   └── pages/LoginPage.tsx
│   ├── game/                  # 게임 (핵심)
│   │   ├── components/        # React UI
│   │   │   ├── CameraArea.tsx
│   │   │   └── StageSelectScreen.tsx
│   │   ├── pages/GamePage.tsx # 게임 메인 페이지
│   │   ├── store/useGameStore.ts # Zustand 상태
│   │   └── phaser/            # Phaser 게임 엔진
│   │       ├── PhaserGame.tsx # React-Phaser 브릿지
│   │       ├── config/curseConfig.ts # 저주 설정
│   │       ├── entities/Player.ts # 플레이어 클래스
│   │       ├── gimmicks/      # 기믹 (Bumper, Spike 등)
│   │       ├── scenes/        # 게임 씬
│   │       └── utils/         # 헬퍼 함수
│   ├── livekit/               # 화상통화
│   │   ├── api/livekitApi.ts
│   │   ├── hooks/useLiveKit.ts
│   │   └── components/TestVideo.tsx
│   └── lobby/                 # 로비
│       ├── components/JoinGameModal.tsx
│       └── pages/LobbyPage.tsx
├── shared/                    # 공통 컴포넌트
│   └── components/CaptureConsentModal/
└── socket/                    # 통신 레이어
    ├── GameWebSocket.ts       # 게임 WebSocket 싱글톤
    └── LiveKitService.ts      # LiveKit 서비스
```

---

## 4. 핵심 흐름

### 4.1 앱 라우팅 (App.tsx)

```
닉네임 없음 → LoginPage
   ↓
닉네임 있음, 방 없음 → LobbyPage
   ↓
방 있음 → GamePage
   ├── 게임 시작 전 → 대기실 (LobbyScene)
   ├── 게임 시작 후, 스테이지 미선택 → StageSelectScreen
   └── 스테이지 선택됨 → Stage1Scene/Stage2Scene...
```

### 4.2 상태 관리 (useGameStore)

```typescript
interface GameState {
  nickname: string;           // 로그인한 유저 닉네임
  roomId: string;             // 참가 중인 방 ID
  isHost: boolean;            // 방장 여부
  players: Player[];          // 방 내 플레이어 목록
  readyPlayers: string[];     // Ready 상태 플레이어
  isGameStarted: boolean;     // 게임 시작 여부
  isSoloMode: boolean;        // 솔로 모드 여부
  currentStage: string | null; // 현재 스테이지 ID
  clearedStages: string[];    // 클리어한 스테이지 목록
}
```

**주요 액션**:
- `setNickname()` - 로그인
- `joinGame()` - 방 입장
- `leaveGame()` - 방 퇴장
- `syncPlayersFromServer()` - 서버 상태 동기화
- `startGameFromServer()` - 게임 시작
- `selectStage()` / `clearStage()` - 스테이지 관리

---

## 5. WebSocket 통신 (GameWebSocket)

### 5.1 싱글톤 패턴

```typescript
const ws = GameWebSocket.getInstance();
ws.setUser(nickname);
await ws.connect();
```

### 5.2 메시지 타입

| Type | 방향 | 설명 |
|------|------|------|
| `CREATE` | C→S | 방 생성 |
| `JOIN` | C→S→C | 방 참가 |
| `MOVE` | C→S→C | 위치 전송 |
| `READY` | C→S→C | Ready 상태 |
| `START_GAME` | C→S→C | 게임 시작 |
| `UPDATE` | S→C | 전체 플레이어 상태 (20 TPS) |
| `STAGE_SELECT` | C→S→C | 스테이지 선택 |
| `STAGE_CLEAR` | C→S→C | 스테이지 클리어 |
| `LEAVE` | C→S→C | 방 퇴장 |
| `ROOM_CLOSED` | S→C | 방 폭파 (방장 퇴장) |

### 5.3 GameMessage 구조

```typescript
interface GameMessage {
  type: MessageType;
  roomId?: string;
  username?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  anim?: string;      // 애니메이션 상태 + P2P 스테이지 태그
  content?: string;   // 시스템 메시지
  stage?: number;     // 스테이지 번호
}
```

---

## 6. Phaser 게임 엔진

### 6.1 씬 구조

```
BaseGameScene (추상 클래스)
├── LobbyScene     # 대기실
├── Stage1Scene    # 스테이지 1
├── Stage2Scene    # 스테이지 2
├── Stage3Scene    # 스테이지 3
├── Solo1Scene     # 솔로 모드 1
└── Solo2Scene     # 솔로 모드 2
```

### 6.2 BaseGameScene 핵심 메서드

| 메서드 | 설명 |
|--------|------|
| `preload()` | 리소스 로드 |
| `create()` | 씬 초기화 |
| `update()` | 60fps 게임 루프 |
| `setupPhysics()` | Matter.js 물리 설정 |
| `setupCamera()` | 카메라 설정 |
| `subscribeToStore()` | Zustand 상태 구독 |
| `parseTiledData()` | Tiled JSON 파싱 |
| `createGimmicks()` | 기믹 배치 (서브클래스 구현) |

### 6.3 Player 클래스

```typescript
class Player {
  // 기본 속성
  id: string;
  nickname: string;
  x, y: number;              // 위치
  vx, vy: number;            // 속도
  
  // 저주 시스템
  activeCurse: string | null;
  hp: number;
  
  // 메서드
  update(): void;            // 매 프레임 호출
  applyCurse(curseId): void; // 저주 적용
  removeCurse(): void;       // 저주 해제
  die(): void;               // 사망 처리
}
```

### 6.4 기믹 목록

| 기믹 | 파일 | 설명 |
|------|------|------|
| `Key` | Key.ts | 열쇠 (잠금 해제용) |
| `Lock` | Lock.ts | 잠긴 문 |
| `Spike` | Spike.ts | 가시 (즉사) |
| `Goal` | Goal.ts | 골인 지점 |
| `Spring` | Spring.ts | 점프대 |
| `Elevator` | Elevator.ts | 엘리베이터 |
| `MovableBlock` | MovableBlock.ts | 밀 수 있는 블록 |
| `Bumper` | Bumper.ts | 범퍼 (용수철) |
| `MovingBumper` | MovingBumper.ts | 이동하는 범퍼 |

---

## 7. 저주 시스템 (curseConfig.ts)

### 7.1 저주 종류

| ID | 이름 | 효과 |
|----|------|------|
| `giant` | 거대화 | 크기 2배, 속도 50% |
| `drain` | HP 저하 | 5초간 HP 감소 후 사망 |
| `reverse` | 반전 | 조작 반대 |

### 7.2 CurseEffect 인터페이스

```typescript
interface CurseEffect {
  id: string;
  name: string;
  description: string;
  sizeMultiplier: number;     // 크기 배율
  speedMultiplier: number;    // 속도 배율
  color?: number;             // 시각 효과 색상
  hasDrainEffect?: boolean;   // HP 감소 여부
  reverseControls?: boolean;  // 조작 반전 여부
  duration?: number;          // 지속 시간 (ms)
}
```

---

## 8. LiveKit 화상통화

### 8.1 useLiveKit Hook

```typescript
const { token, serverUrl, isLoading, error, connect } = useLiveKit({
  roomId: "ABC123",
  username: "player1",
  userId: "user_123",
  autoConnect: true
});
```

### 8.2 흐름

```
roomId + username + userId
   ↓
fetchLiveKitToken() → 백엔드 API 호출
   ↓
JWT 토큰 수신
   ↓
LiveKit SDK로 연결
```

---

## 9. 주요 페이지별 역할

### GamePage.tsx
- WebSocket 메시지 핸들러 설정
- Phaser 게임 렌더링
- 카메라 영역 표시
- Ready/게임 시작 버튼

### LobbyPage.tsx
- 방 생성/참가 UI
- WebSocket 연결 초기화

### LoginPage.tsx
- 로그인/회원가입 폼
- JWT 토큰 저장

---

## 10. 데이터 흐름 (멀티플레이)

```
[내 입력] → BaseGameScene.update()
    ↓
Player.update() → 위치 계산
    ↓
gameWebSocket.sendPlayerState() → 서버 전송
    ↓
[서버] 20 TPS로 UPDATE 브로드캐스트
    ↓
syncPlayersFromServer() → Zustand 상태 업데이트
    ↓
다른 플레이어 위치 보간 렌더링
```

---

## 11. P2P 스테이지 동기화

호스트가 스테이지 정보를 `anim` 필드에 숨겨서 전송:

```typescript
// 호스트 전송
anim = "walk_right|s:2"  // 스테이지 2

// 클라이언트 수신
if (msg.anim.includes('|s:')) {
  const hostStage = parseInt(parts[1], 10);
  startGameFromServer(hostStage);
}
```

---

> 📅 마지막 업데이트: 2026-01-24
> 📁 분석 대상: `01_S14P11D105_frontend/echoforest-frontend/`
