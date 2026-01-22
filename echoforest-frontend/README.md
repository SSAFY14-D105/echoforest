# 뽀뽀뽀 (가제) - Frontend

픽셀 개구리가 되어 숲속을 탐험하는 웹 기반 멀티플레이어 플랫폼 게임입니다.
게임 화면과 화상 채팅(LiveKit)이 결합된 하이브리드 레이아웃을 제공합니다.

## 🛠 Tech Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** CSS Modules (Standard CSS)
- **State Management:** Zustand
- **Game Engine:** Phaser 3 + Matter.js
- **Video Chat:** LiveKit (연동 예정)
- **Communication:** WebSocket

---

## 📅 개발 진행 상황 (2026-01-18 업데이트)

### ✅ 완료된 기능

#### 1. 인증 시스템
- **로그인/회원가입 API 연동**
  - `POST /api/auth/signup` - 회원가입
  - `POST /api/auth/login` - 로그인
  - `POST /api/auth/check-id/:loginId` - ID 중복 체크
- **입력 검증**
  - ID: 영문+숫자, 4-20자
  - 비밀번호: 최소 8자
  - 이메일: 유효성 검사
- **실시간 ID 중복 체크** (500ms debounce)
- **HTTP 에러 처리** (400, 401, 403, 404, 500 등)
- **JWT 토큰 저장** (localStorage)

#### 2. 로비 시스템
- **방 만들기 (Host)**
  - 6자리 랜덤 방 코드 생성
  - 자동 HOST 권한 부여
- **방 참가하기 (Join)**
  - 6자리 코드 입력 및 검증
  - 방 존재 여부 확인 (백엔드 연동 대기)
- **설정 (Settings)**
  - 닉네임 변경
  - 마이크 볼륨 조절 (UI)
  - 카메라 미리보기 (UI)

#### 3. 게임 엔진 (Phaser 3 + Matter.js)
- **물리 엔진**
  - 중력, 점프, 가속/감속
  - 회전 고정 (피코파크 스타일) - 머리 밟기 가능
  - 확장 가능한 물리 파라미터 구조
- **멀티플레이어 시스템**
  - 4명 플레이어 지원
  - 플레이어별 색상 테마
    - P1: 녹색 (#4CAF50)
    - P2: 파란색 (#2196F3)
    - P3: 주황색 (#FF9800)
    - P4: 보라색 (#9C27B0)
- **횡스크롤 카메라**
  - 3000px 맵 너비
  - 4명 플레이어 동시 추적
  - 플레이어는 카메라 밖으로 이동 불가

#### 4. 인게임 UI
- **카메라 컨트롤** (Discord 스타일)
  - 본인: 마이크/카메라 on/off 버튼
  - 타인: 스피커 (볼륨 조절)
  - 세로 볼륨 슬라이더 (클릭 방식)
- **4분할 화상 영역**
  - 플레이어별 색상 테두리
  - 카메라 off 시 검은 화면

#### 5. 반응형 UI
- **로그인/로비/인게임 모두 반응형 처리**
  - box-sizing으로 오버플로우 해결
  - 미디어 쿼리 적용
  - 창 크기 변경 시 자동 조정

#### 6. WebSocket 기본 구조
- **GameWebSocket 클래스 구현**
  - JOIN/MOVE/LEAVE 메시지 타입
  - 연결/해제 관리
  - 엔드포인트: `ws://localhost:9001/ws/game`

---

## 📂 Project Structure

```bash
src/
├── apis/
│   └── authApi.ts           # 인증 API (signup, login, checkId)
├── components/              # 공통 컴포넌트
├── game/
│   ├── scenes/
│   │   └── MainScene.ts     # [NEW] Phaser 게임 로직
│   ├── websocket/
│   │   └── GameWebSocket.ts # [NEW] WebSocket 통신
│   └── PhaserGame.tsx       # [NEW] Phaser 설정
├── pages/
│   ├── LoginPage/           # 로그인/회원가입
│   ├── lobby/
│   │   ├── LobbyPage.tsx    # 로비 (Host/Join/Settings)
│   │   └── LobbyPage.module.css
│   └── game/
│       ├── GamePage.tsx     # 인게임 (Phaser + 카메라 UI)
│       └── GamePage.module.css
├── store/
│   └── useGameStore.ts      # Zustand 전역 상태
├── App.tsx                  # 라우팅
└── main.tsx
```
# 2026-01-18 로그인-로비-게임 페이지 구현
---

## 🚀 실행 방법

### 1. 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 접속
```
http://localhost:5173
```

---

## 🔗 백엔드 연동 현황

### ✅ 연동 가능 (테스트 필요)
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/check-id/:loginId`

### ⏳ 대기 중
- `GET /api/rooms/:roomId` - 방 존재 여부 확인
- `WebSocket ws://localhost:9001/ws/game` - 게임 통신
- `POST /api/livekit/token` - LiveKit 토큰 발급

---

## 📝 다음 작업 예정

- [ ] 백엔드 WebSocket 서버 연동 테스트
- [ ] Tiled 맵 에디터 JSON 로드
- [ ] LiveKit 화상 채팅 연동
- [ ] 플레이어 애니메이션 (스프라이트)

---

## 🐛 알려진 이슈

1. **방 참가 시 방 존재 여부 확인**
   - 현재: 모든 코드를 "방 없음"으로 처리
   - 해결: 백엔드 API `GET /api/rooms/:roomId` 연동 필요

2. **WebSocket 연결 테스트**
   - 백엔드 WebSocket 서버 준비 대기 중

3. **LiveKit 카메라 테스트**
   - LiveKit 토큰 API 연동 후 테스트 가능

---

## 💡 개발 참고사항

### Phaser 게임 엔진
- **물리 파라미터 수정**: `src/game/scenes/MainScene.ts`의 `PHYSICS` 객체
- **맵 크기 변경**: `worldWidth` 변수 (기본 3000px)
- **플레이어 이미지 교체**: `createPlayer()` 메서드의 Graphics를 이미지 로드로 교체

### 반응형 처리
- **전체 화면 사용**: Phaser가 카메라 영역 제외한 전체 화면 사용
- **창 크기 변경**: 자동 리사이즈 (`Phaser.Scale.RESIZE`)

### WebSocket 통신
- **메시지 타입**: JOIN, MOVE, LEAVE
- **좌표 보간**: Tweens 사용 권장 (부드러운 이동)

---

## 🆕 feature/fe/Websocket 브랜치 작업 내용 (2026-01-19 ~ 01-20)

### 1. WebSocket 백엔드 연동
- **GameWebSocket.ts 리팩토링**
  - 백엔드 `GameMessageDto`와 동일한 메시지 형식 적용
  - JWT 토큰 인증 지원 (`?token=xxx` 쿼리 파라미터)
  - 메시지 타입: `CREATE`, `JOIN`, `MOVE`, `PING`, `PONG`, `ERROR`, `ROOM_CREATED`, `LEAVE`
  - 콜백 패턴: `onMessage()`, `onConnect()`, `onError()`, `onClose()`
  - 편의 메서드: `createRoom()`, `joinRoom()`, `move()`, `disconnect()`

### 2. 방 생성/참가 WebSocket 연동
- **방 만들기 (CREATE)**
  - 프론트 → 백엔드: `CREATE` 메시지 전송
  - 백엔드 → 프론트: `ROOM_CREATED` 응답에서 방 코드 수신
  - 백엔드가 생성한 영문+숫자 6자리 코드 사용
- **방 참가하기 (JOIN)**
  - 영문+숫자 6자리 코드 입력 지원 (숫자만 → 영문+숫자)
  - 자동 대문자 변환
  - 에러 처리: "Room not found" → "해당하는 방을 찾을 수 없습니다."
  - 에러 처리: "Room is full" → "방이 가득 찼습니다."

### 3. 로그인 닉네임 처리
- **authApi.ts**
  - `LoginResponse`에 `nickname` 필드 추가
  - 로그인 실패 시 에러 메시지 개선 (500 에러 → "아이디/비밀번호 확인")
- **LoginPage.tsx**
  - 로그인 성공 시 `res.nickname` 사용 (기존: loginId)
  - localStorage에 nickname 저장

### 4. 로비 닉네임 설정 개선
- **LobbyPage.tsx**
  - 닉네임 변경 시 localStorage에도 저장
  - 빈 닉네임으로는 저장 불가

---

## 🎥 LiveKit 화상 채팅 모듈 사용법

### 📁 파일 구조

```
src/
├── apis/
│   └── livekitApi.ts       # 토큰 발급 API
├── hooks/
│   └── useLiveKit.ts       # 연결 관리 훅
├── components/
│   └── LiveKitOverlay.tsx  # 화상 채팅 컴포넌트
└── pages/
    └── LiveKitTestPage.tsx # 테스트 페이지
```

---

### 🔧 1. API 직접 사용하기

토큰만 발급받고 싶을 때 사용합니다.

```tsx
import { fetchLiveKitToken, LIVEKIT_SERVER_URL } from '../apis/livekitApi';

// 토큰 발급
const { token } = await fetchLiveKitToken({
  roomId: 'room_1',       // 방 ID
  userId: 'user_123',     // 사용자 ID
  username: '홍길동',     // 표시될 이름
});

console.log('토큰:', token);
console.log('서버 URL:', LIVEKIT_SERVER_URL);
```

---

### 🪝 2. Hook 사용하기

토큰 발급 + 상태 관리를 자동으로 처리합니다.

```tsx
import useLiveKit from '../hooks/useLiveKit';

function MyComponent() {
  const { token, serverUrl, isLoading, error, connect } = useLiveKit({
    roomId: 'room_1',
    userId: 'user_123',
    username: '홍길동',
    autoConnect: true,  // 자동 연결 (기본값: true)
  });

  if (isLoading) return <div>연결 중...</div>;
  if (error) return <div>에러: {error.message}</div>;
  if (!token) return null;

  return (
    <div>
      <p>토큰 발급 완료!</p>
      {/* LiveKitRoom 컴포넌트와 함께 사용 */}
    </div>
=======
## 📸 CaptureConsentModal 컴포넌트

게임 종료 후 카메라 화면 캡처 및 이미지 합성에 대한 사용자 동의를 받는 모달 컴포넌트입니다.

### 파일 위치
```
src/components/CaptureConsentModal/
├── CaptureConsentModal.tsx       # 메인 컴포넌트
├── CaptureConsentModal.module.css # 스타일 (프리미엄 다크 디자인)
└── index.ts                       # export
```

### 사용법 예시 (기본)

```tsx
import { useState } from 'react';
import CaptureConsentModal from '../components/CaptureConsentModal';

function YourPage() {
  const [showConsentModal, setShowConsentModal] = useState(false);

  return (
    <CaptureConsentModal
      isOpen={showConsentModal}
      onAgree={() => {
        setShowConsentModal(false);
        // 동의 로직 진행
      }}
      onDecline={() => {
        setShowConsentModal(false);
        // 거부 로직 진행
      }}
    />
  );
}
```

---

### 🎬 3. 컴포넌트 사용하기 (권장)

가장 간단한 방법입니다. 모든 것이 자동으로 처리됩니다.

```tsx
import LiveKitOverlay from '../components/LiveKitOverlay';

function GamePage() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* 게임 화면 */}
      <div>게임 컨텐츠...</div>

      {/* 화상 채팅 (오버레이) */}
      <LiveKitOverlay
        roomId="room_1"
        userId="user_123"
        username="홍길동"
        onConnected={() => console.log('연결됨!')}
        onError={(err) => console.error('에러:', err)}
      />
    </div>
  );
}
```

#### Props

| Prop | 타입 | 필수 | 설명 |
|------|------|------|------|
| `roomId` | string | ✅ | 방 ID |
| `userId` | string | ✅ | 사용자 ID |
| `username` | string | ✅ | 표시될 이름 |
| `onConnected` | () => void | ❌ | 연결 성공 콜백 |
| `onError` | (error) => void | ❌ | 에러 콜백 |

---

### 🧪 4. 테스트 방법

1. `npm run dev` 실행
2. `App.tsx`에서 `LiveKitTestPage` 렌더링
3. http://localhost:5173 접속
4. 카메라 권한 허용
5. 내 얼굴이 화면에 표시되면 성공!

---

### ⚙️ 환경 설정

현재 하드코딩된 설정값 (`src/apis/livekitApi.ts`):

```typescript
const API_BASE_URL = 'https://i14d105.p.ssafy.io/api';
const LIVEKIT_SERVER_URL = 'wss://i14d105.p.ssafy.io/livekit';
```

프로덕션 배포 시 환경변수로 변경 가능:
```env
VITE_API_BASE_URL=https://your-api.com/api
VITE_LIVEKIT_URL=wss://your-livekit.com
```

---

### 🔌 백엔드 API 명세

#### 토큰 발급 `POST /api/livekit/token`

**Request:**
```json
{
  "roomId": "room_1",
  "userId": "user_123",
  "username": "홍길동"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
=======
### Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | 모달 표시 여부 |
| `onAgree` | `() => void` | 동의 버튼 클릭 시 호출 |
| `onDecline` | `() => void` | 거부 버튼 클릭 시 호출 |

### ⏳ 백엔드 연동 가이드
추후 백엔드에서 캡처/합성 트리거가 구현될 때, 해당 신호를 수신하는 위치에서 이 모달을 띄우고 결과(`onAgree`/`onDecline`)를 서버로 전송하면 됩니다.


