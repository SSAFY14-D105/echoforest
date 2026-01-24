# EchoForest Frontend

React + TypeScript + Vite 기반 멀티플레이어 협동 퍼즐 플랫포머 게임 클라이언트

## 🌲 프로젝트 개요

**EchoForest**는 최대 4명이 함께하는 협동 플랫포머 게임입니다.
- **Phaser 3** 기반 2D 물리 엔진 (Matter.js)
- **WebSocket** 실시간 플레이어 상태 동기화 (20 TPS)
- **LiveKit WebRTC** 음성/화상 통신
- **Zustand** 클라이언트 상태 관리

---

## 📁 디렉토리 구조

```
echoforest-frontend/
├── public/                   # 정적 파일
│   └── assets/               # 게임 에셋 (sprites, maps, tilesets)
├── src/
│   ├── apis/                 # REST API 요청 정의
│   │   ├── authApi.ts        # 로그인/회원가입 API
│   │   └── livekitApi.ts     # LiveKit 토큰 발급 API
│   │
│   ├── socket/               # 실시간 통신
│   │   ├── GameWebSocket.ts  # 게임 서버 WebSocket (싱글톤)
│   │   └── LiveKitService.ts # LiveKit 연결 서비스
│   │
│   ├── store/                # Zustand 상태 관리
│   │   └── useGameStore.ts   # 플레이어/방/스테이지 상태
│   │
│   ├── components/           # 재사용 가능한 UI 컴포넌트
│   │   ├── LoginForm/        # 로그인 폼
│   │   ├── SignupForm/       # 회원가입 폼
│   │   ├── CameraArea/       # 4분할 카메라 영역 (LiveKit)
│   │   ├── JoinGameModal/    # 방 참가 모달
│   │   ├── SettingsModal/    # 설정 모달
│   │   ├── StageSelectScreen/ # 스테이지 선택 화면
│   │   └── ...
│   │
│   ├── pages/                # 라우팅되는 페이지 컴포넌트
│   │   ├── auth/LoginPage/   # 로그인/회원가입 페이지
│   │   ├── lobby/LobbyPage/  # 로비 (방 생성/참가)
│   │   ├── game/GamePage/    # 게임 화면 (대기실/스테이지)
│   │   └── livekit/          # LiveKit 테스트 페이지
│   │
│   ├── hooks/                # 커스텀 React 훅
│   │   └── useLiveKit.ts     # LiveKit 연결 훅
│   │
│   ├── styles/               # 전역 스타일
│   │   └── GlobalStyles.css  # CSS 변수, 공통 스타일
│   │
│   ├── phaser/               # Phaser 3 게임 엔진
│   │   ├── PhaserGame.tsx    # React-Phaser 브릿지
│   │   ├── entities/Player.ts # 플레이어 엔티티
│   │   ├── scenes/           # 게임 씬들
│   │   │   ├── BaseGameScene.ts  # 공통 게임 로직
│   │   │   ├── LobbyScene.ts     # 대기실 씬
│   │   │   ├── Stage1Scene.ts    # 스테이지 1
│   │   │   ├── Stage2Scene.ts    # 스테이지 2
│   │   │   └── ...
│   │   ├── gimmicks/         # 게임 기믹 (Spike, Spring, Key 등)
│   │   ├── config/           # 게임 설정 (저주 시스템 등)
│   │   └── utils/            # 유틸리티 (TiledParser, SceneHelper)
│   │
│   ├── App.tsx               # 라우팅 및 앱 구조
│   └── main.tsx              # 앱 진입점
│
├── index.html                # Vite HTML 템플릿
├── vite.config.ts            # Vite 설정
├── tsconfig.json             # TypeScript 설정
└── package.json              # 의존성 및 스크립트
```

---

## 🎮 핵심 아키텍처

### 1. 상태 관리 (Zustand)

`useGameStore` - 게임 전체 상태 관리:
- `nickname`, `roomId`, `isHost` - 유저/방 정보
- `players[]` - 플레이어 목록 (위치, 색상, 저주 등)
- `isGameStarted`, `currentStage`, `clearedStages` - 게임 진행 상태
- `isSoloMode` - 혼자하기 모드 여부

### 2. 실시간 통신 (WebSocket)

`GameWebSocket` (싱글톤):
- JWT 토큰 기반 인증
- 메시지 타입: `CREATE`, `JOIN`, `MOVE`, `UPDATE`, `READY`, `START_GAME` 등
- 서버에서 20 TPS로 `UPDATE` 메시지 수신 → 플레이어 위치 동기화

### 3. 게임 엔진 (Phaser 3)

`BaseGameScene` - 모든 게임 씬의 부모 클래스:
- Matter.js 물리 엔진 (중력, 충돌)
- Tiled 맵 파서 (TMJ 형식)
- 플레이어 생성 및 동기화
- 기믹 충돌 처리 (Spike, Spring, Bumper, Key, Lock, Goal)

### 4. 화상 통신 (LiveKit)

`LiveKitService`:
- 백엔드에서 토큰 발급 → LiveKit 서버 연결
- 로컬/리모트 비디오 트랙 관리
- 마이크/카메라 토글

---

## 🚀 시작하기

### 설치
```bash
npm install
```

### 개발 서버 실행
```bash
npm run dev
```

### 프로덕션 빌드
```bash
npm run build
```

---

## 🔗 환경 변수

`.env` 파일에 설정:

```env
VITE_API_BASE_URL=https://i14d105.p.ssafy.io/api
VITE_LIVEKIT_URL=wss://i14d105.p.ssafy.io:7880
```

---

## 📋 주요 흐름

```
1. 로그인 (LoginPage)
   └── authApi.login() → JWT 토큰 저장 → nickname 설정

2. 로비 (LobbyPage)
   ├── 방 만들기 → WebSocket.createRoom() → ROOM_CREATED 수신
   ├── 방 참가하기 → REST API로 방 확인 → WebSocket.joinRoom()
   └── 혼자하기 → startSoloGame() (WebSocket 없이 로컬 실행)

3. 대기실 (GamePage - LobbyScene)
   ├── Ready 상태 토글 → WebSocket.sendReady()
   └── 방장: 게임 시작 → WebSocket.sendStartGame() → GAME_START 수신

4. 게임 플레이 (GamePage - StageXScene)
   ├── 로컬 입력 → Player.move() → WebSocket.sendPlayerState()
   ├── 서버 UPDATE 수신 → syncPlayersFromServer() → 리모트 플레이어 위치 업데이트
   └── Goal 도달 → clearStage() → 스테이지 선택 화면
```

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| State | Zustand |
| Game Engine | Phaser 3 (Matter.js) |
| WebSocket | Native WebSocket |
| WebRTC | LiveKit |
| Map Editor | Tiled (TMJ export) |
| Styling | CSS Modules |

---

## 📝 개발 노트

### 플레이어 색상 할당
- 서버 순서(배열 인덱스) 기반으로 색상 고정
- 0번: 초록(방장), 1번: 파랑, 2번: 주황, 3번: 보라

### 저주 시스템 (STT 기반)
- 부정적인 단어 감지 시 저주 스택 누적
- 저주 효과: 캐릭터 크기 변화, 화면 흔들림 등
- 긍정적인 단어로 저주 해제 가능

### P2P 스테이지 동기화
- 방장이 MOVE 메시지에 현재 스테이지 정보 포함
- 비방장은 방장의 스테이지로 자동 동기화
