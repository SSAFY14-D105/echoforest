#  뽀뽀뽀 (가제입니다.) - Client

픽셀 개구리가 되어 숲속을 탐험하는 웹 기반 멀티플레이어 플랫폼 게임입니다.
게임 화면과 화상 채팅(LiveKit 예정)이 결합된 하이브리드 레이아웃을 제공합니다.

## 🛠 Tech Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** CSS Modules (Standard CSS)
- **State Management:** Zustand
- **Game Engine:** Custom Canvas-based Physics Engine (No external game library)
- **Deployment:** (추후 결정)

## ✨ Features (현재 구현된 기능)

### 1. 인증 & 로비 (Lobby Flow)
- **로그인:** 아이디/비밀번호 입력 및 유효성 검사.
- **회원가입:** 아이디/비밀번호/닉네임 입력 및 회원가입 처리.
- **로비:**
  - **방 만들기 (Host):** 4자리 숫자 방 코드 자동 생성.
  - **방 참가 (Join):** 방 코드 입력 및 유효성 검사.
  - **설정 (Settings):** 닉네임 변경 및 마이크/캠 테스트 UI (UI 구현 완료).

### 2. 게임 엔진 (Game Core)
- **물리 엔진:** 중력, 가속도, 마찰력, 점프(가변 높이) 구현.
- **충돌 처리:** 바닥 및 플랫폼 충돌 감지.
- **플랫폼 기믹:**
  - `NORMAL`: 일반 발판.
  - `MOVING`: 좌우로 왕복 이동하는 발판 (플레이어 탑승 가능).
  - `VANISH`: 밟으면 흔들리다 떨어지는 발판 (구현 예정).
  - `GOAL`: 도착 지점.
  - 플랫폼 기믹은 사용할지는 미지수

### 3. UI 레이아웃
- **Split View:**
  - 상단: HTML5 Canvas 기반 게임 화면.
  - 하단: 4분할 캠 송출 화면 (현재 더미 데이터).

## 📂 Project Structure

```bash
src/
├── apis/            # API 서비스 (authApi.ts 등)
├── components/      # UI 컴포넌트 (버튼, 모달 등)
├── hooks/           # 커스텀 React Hooks
├── pages/           # 페이지 단위 컴포넌트
│   ├── LoginPage/   # 로그인/회원가입 화면
│   ├── lobby/       # 로비 (방생성/참가)
│   └── game/        # 인게임 (캔버스 + 캠 화면)
├── socket/          # WebSocket 통신 관련
├── store/           # Zustand 전역 상태 관리 (useGameStore.ts)
├── styles/          # 전역 스타일 (GlobalStyles.css)
├── utils/           # 유틸리티 함수 및 게임 엔진
│   └── game/        # [핵심] GameEngine 클래스
├── App.tsx          # 메인 라우터 (State 기반 화면 전환)
└── main.tsx         # 엔트리 포인트
```