# 🎮 EchoForest Frontend - STT 저주 시스템

> **SSAFY 14기 S14P11D105 프론트엔드**  
> React + Phaser3 게임 클라이언트 with 실시간 STT 저주 시스템

---

## 📑 목차

1. [시스템 개요](#-시스템-개요)
2. [STT 저주 시스템](#-stt-저주-시스템)
3. [프로젝트 구조](#-프로젝트-구조)
4. [핵심 컴포넌트](#-핵심-컴포넌트)
5. [WebSocket 통신](#-websocket-통신)
6. [설정 및 실행](#-설정-및-실행)

---

## 🎯 시스템 개요

### 기술 스택

| 분류 | 기술 | 용도 |
|------|------|------|
| **Framework** | React 18, TypeScript | UI 프레임워크 |
| **Game Engine** | Phaser 3 | 2D 플랫포머 게임 |
| **State** | Zustand | 전역 상태 관리 |
| **STT** | Web Speech API | 브라우저 음성 인식 |
| **Video** | LiveKit | 화상 채팅 |
| **Build** | Vite | 빌드 도구 |
| **WebSocket** | Native WebSocket | 실시간 통신 |

### 화면 구성

```
로그인 (LoginPage)
    ↓
로비 (LobbyPage)
    ↓
게임 대기실 (GamePage - 대기 모드)
    ↓
게임 플레이 (GamePage - 스테이지 플레이)
```

---

## 🔮 STT 저주 시스템

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                         STT 저주 시스템 흐름                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1️⃣ 음성 인식 (useSpeechRecognition)                                │
│     ├─ Web Speech API로 연속 듣기                                   │
│     ├─ 중간 결과 (interimTranscript): 긍정어 감지용                 │
│     └─ 최종 결과 (transcript): 배치 큐에 추가                       │
│                                                                     │
│  2️⃣ 상태 관리 (useSttStore)                                         │
│     ├─ 긍정어 로컬 매칭 ("뽀뽀", "사랑해", "좋아해")                 │
│     ├─ 5초마다 배치 전송 (speechQueue → SPEECH_BATCH)               │
│     └─ 저주 스택 상태 관리 (0~10)                                   │
│                                                                     │
│  3️⃣ WebSocket 통신                                                  │
│     ├─ [Client→Server] SPEECH_BATCH { texts: [...] }               │
│     ├─ [Server→Client] STACK_UPDATED { stack, delta }              │
│     ├─ [Server→Client] CURSE_TRIGGERED { cursedPlayerId }          │
│     └─ [Client→Server] CURSE_RELEASE { word: "사랑해" }             │
│                                                                     │
│  4️⃣ UI 렌더링                                                       │
│     ├─ CurseStackBar: 상단 스택 표시 (색상 변화)                    │
│     ├─ FloatingButton: 우하단 부스터 버튼                           │
│     └─ 경고 모달: 저주 발동/해제 알림                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 긍정어 부스터 사용법

1. **우하단 플로팅 버튼 길게 누르기** (마우스다운/터치 유지)
2. **긍정어 발화** ("뽀뽀", "사랑해", "좋아해" 중 하나)
3. **긍정어 감지 시 자동으로 CURSE_RELEASE 전송**
4. 버튼 놓으면 부스터 모드 종료

---

## 📁 프로젝트 구조

```
src/
├── hooks/
│   └── useSpeechRecognition.ts     # Web Speech API 래퍼 훅
│
├── store/
│   ├── useGameStore.ts             # 게임 상태 (플레이어, 방, 스테이지)
│   └── useSttStore.ts              # STT 상태 (스택, 부스터, 배치)
│
├── components/
│   └── stt/
│       ├── FloatingButton.tsx      # 플로팅 부스터 버튼
│       ├── FloatingButton.module.css
│       ├── CurseStackBar.tsx       # 저주 스택 바
│       └── CurseStackBar.module.css
│
├── socket/
│   ├── GameWebSocket.ts            # 게임 WebSocket 싱글톤
│   └── LiveKitService.ts           # 화상 채팅 서비스
│
├── pages/
│   ├── auth/LoginPage/             # 로그인 페이지
│   ├── lobby/LobbyPage/            # 로비 페이지
│   └── game/GamePage/              # 게임 페이지 (STT 통합)
│
├── phaser/
│   ├── PhaserGame.tsx              # Phaser 게임 컴포넌트
│   └── scenes/                     # 게임 씬들
│
└── App.tsx                         # 라우팅
```

---

## 🧩 핵심 컴포넌트

### 1. useSpeechRecognition

Web Speech API를 래핑한 커스텀 훅.

```typescript
const {
    transcript,          // 최종 음성 인식 결과
    interimTranscript,   // 중간 결과 (실시간)
    isListening,         // 듣는 중 여부
    isSupported,         // 브라우저 지원 여부
    error,               // 에러 메시지
    startListening,      // 시작
    stopListening,       // 중지
    resetTranscript,     // 초기화
} = useSpeechRecognition();
```

**특징**:
- 연속 듣기 모드 (`continuous: true`)
- 한국어 설정 (`lang: 'ko-KR'`)
- 자동 재시작 (끊김 방지)

### 2. useSttStore

STT 상태 관리 Zustand 스토어.

```typescript
const {
    curseState,          // { stack, cursedPlayer, ... }
    setBoosterMode,      // 부스터 모드 활성화
    boosterActive,       // 부스터 발동 여부
    processTranscript,   // 텍스트 처리
    onStackUpdated,      // 스택 업데이트 핸들러
    onCurseTriggered,    // 저주 발동 핸들러
    onCurseReleased,     // 저주 해제 핸들러
} = useSttStore();
```

**주요 로직**:
- **긍정어 매칭**: 프론트엔드에서 로컬 처리
- **배치 전송**: 5초마다 `speechQueue` → 서버
- **스택 관리**: 서버로부터 받은 값으로 업데이트

### 3. FloatingButton

우하단 플로팅 원형 버튼.

```tsx
<FloatingButton
    onPress={() => setBoosterMode(true)}
    onRelease={() => setTimeout(() => setBoosterMode(false), 500)}
    isActive={boosterActive}
/>
```

**시각 효과**:
- 기본: 보라색 그라디언트 `💬`
- 누르는 중: 빨강-핑크 + 펄스 링 `🎤`
- 발동: 초록색 + 파티클 `💖`

### 4. CurseStackBar

상단 저주 스택 표시.

```tsx
<CurseStackBar
    stack={curseState.stack}
    cursedPlayer={curseState.cursedPlayer}
    isListening={isListening}
/>
```

**색상 변화**:
- 0~4: 파랑 (`#667eea`)
- 5~7: 주황 (`#ffaa00`)
- 8~10: 빨강 (`#ff4444`)

---

## 🔌 WebSocket 통신

### STT 관련 메시지 타입

#### Client → Server

| Type | 필드 | 설명 |
|------|------|------|
| `SPEECH_BATCH` | `content: JSON(texts[])` | 발화 배치 전송 (5초마다) |
| `CURSE_RELEASE` | `content: word` | 저주 해제 요청 (긍정어) |

#### Server → Client

| Type | 필드 | 설명 |
|------|------|------|
| `STACK_UPDATED` | `stack, delta, reason` | 스택 업데이트 |
| `CURSE_TRIGGERED` | `cursedPlayerId, mapId` | 저주 발동 |
| `CURSE_RELEASED` | `releasedPlayerId, word` | 저주 해제됨 |

### GameWebSocket 싱글톤

```typescript
import { gameWebSocket } from './socket/GameWebSocket';

// 연결
gameWebSocket.setUser(nickname);
await gameWebSocket.connect();

// 메시지 전송
gameWebSocket.send({
    type: 'SPEECH_BATCH',
    roomId,
    content: JSON.stringify(texts),
});

// 메시지 수신
gameWebSocket.onMessage((msg) => {
    if (msg.type === 'STACK_UPDATED') {
        useSttStore.getState().onStackUpdated(msg.stack!, msg.delta!);
    }
});
```

---

## ⚙️ 설정 및 실행

### 환경 변수

`.env` 파일:

```bash
VITE_API_BASE_URL=https://i14d105.p.ssafy.io/api
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
# → http://localhost:5173

# 프로덕션 빌드
npm run build
```

### 브라우저 요구사항

- **Chrome / Edge (권장)**: Web Speech API 완전 지원
- **Safari**: 부분 지원 (iOS는 지원 안 됨)
- **Firefox**: 지원 안 함

### 마이크 권한

첫 실행 시 브라우저에서 마이크 권한을 요청합니다. **반드시 허용**해야 STT가 작동합니다.

---

## 🧪 테스트

### STT 기능 테스트

1. **음성 인식 확인**:
   - 게임 진입 후 아무 말이나 해보기
   - 콘솔에 `✅ 최종: [인식된 텍스트]` 로그 확인

2. **배치 전송 확인**:
   - 5초 동안 여러 문장 말하기
   - 콘솔에 `📤 배치 전송: N개 발화` 로그 확인

3. **긍정어 부스터 테스트**:
   - 플로팅 버튼 길게 누르기
   - "사랑해" 또는 "뽀뽀" 발화
   - 콘솔에 `💖 긍정어 감지: 사랑해` 로그 확인
   - `📤 CURSE_RELEASE 전송` 확인

---

## 🎨 UI 구성

### 게임 화면 (스테이지 플레이)

```
┌──────────────────────────────────────────────┐
│ 🔮 저주 스택: 3/10 [████░░░░░░]   🎤 듣는 중  │  ← CurseStackBar
├──────────────────────────────────────────────┤
│                                              │
│         [ Phaser 게임 영역 ]                  │
│                                              │
│                                       [💬]  │  ← FloatingButton
├──────────────────────────────────────────────┤
│         [ 카메라 영역 - 4분할 ]               │
└──────────────────────────────────────────────┘
```

---

## 👥 팀 정보

**SSAFY 14기 S14P11D105**

---

## 📜 라이선스

MIT License
