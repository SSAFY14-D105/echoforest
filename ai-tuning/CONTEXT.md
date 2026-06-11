# 📝  Cursed Echoes (메아리의 숲)

실시간 물리 엔진과 AI 인식을 결합한 **4인 협동 멀티플레이어 게임**입니다. 플레이어 간의 분노(욕설)를 감지하고, 게임 클리어를 위해 강제로 애정 표현과 낯간지러운 행동을 요구하는 독특한 심리적 기믹을 핵심으로 합니다.

## 1. 프로젝트 핵심 컨셉 (Core Intent)

* **의도**: 실제 유저의 분노(욕설)를 AI로 감지하고, 이를 해소하기 위해 강제로 낯간지러운 말(STT)과 포즈(Motion)를 수행하게 하여 발생하는 **'강제 화해'**와 **'괴리감'**에서 오는 재미.
* **슬로건**: "욕할 거면 뽀뽀해, 아니면 다 죽든가."

## 2. 핵심 게임 기믹 (Core Mechanics)

* **🎤 뽀뽀 혹은 죽음 (STT)**: 특정 유저가 '이동 반전 독'에 걸리면, 동료 유저가 마이크로 **"사랑해"**, **"뽀뽀 쪽"** 등을 외쳐야 해제.
* **🪄 손하트 캐스팅 (Motion)**: 4인이 동시에 **손하트/볼하트** 포즈를 취해야 관문 통과 가능. (호그와트 레거시식 캐스팅 연출로 연산 시간 확보)
* **🧶 탄성 줄 물리 (Physics)**: 모든 플레이어는 물리적인 탄성 줄로 연결되어 있어 서로의 움직임이 실시간으로 영향을 미침.

## 3. 기술 스택 (Confirmed Tech Stack)

### 💻 Frontend

| 기술 | 용도 |
| --- | --- |
| **React + TS + Vite** | 전체 웹 애플리케이션 구조 및 빠른 개발 환경 |
| **Phaser 3 (Matter.js)** | 실시간 물리 연산 및 게임 렌더링 |
| **Zustand** | React UI - Phaser 엔진 간 전역 상태 관리 (Bridge) |
| **LiveKit Client SDK** | 초저지연 화상/음성 통신 및 데이터 채널 |
| **WebSocket (Raw)** | **Authoritative Tick Loop** 대응 고성능 통신 |
| **Tailwind + shadcn/ui** | 핑크빛 'Cringe' 컨셉의 UI 디자인 |

### ⚙️ Backend & Data

| 기술 | 용도 |
| --- | --- |
| **Java 21** | **가상 스레드(Virtual Threads)** 기반 고성능 동시성 처리 |
| **Spring Boot 3 (MVC)** | 단순하고 강력한 아키텍처 (WebFlux 대비 낮은 복잡도) |
| **Spring WebSocket (Raw)** | 서버 중심 판정(Authoritative Tick Loop) 구현 |
| **Spring Security + JWT** | LiveKit Access Token 발급 및 유저 인증 |
| **MySQL (AWS RDS)** | 유저 정보, 누적 뽀뽀 횟수, 랭킹 영구 저장 |
| **Redis** | 실시간 방 상태, 매칭 큐, 게임 세션 동기화 캐싱 |

### 🌐 Infra & AI

* **MediaPipe**: Web Worker + WebGPU 가속을 통한 모션 인식 최적화.
* **LiveKit Server (Docker)**: Go 엔진 기반 초저지연 미디어 중계.
* **coturn (TURN)**: 방화벽 환경 대응 WebRTC 릴레이 서버.
* **Nginx + TLS**: HTTPS 보안 통신 및 기기 권한(카메라/마이크) 확보.

## 4. 아키텍처 및 통신 전략

* **Authoritative Server**: 게임의 모든 물리 판정(버튼 밟기, 독 전이 등)은 클라이언트가 아닌 서버의 **Tick Loop**에서 수행됩니다.
* **Performance Optimization**: Java 21 가상 스레드를 활용하여 WebFlux 없이도 수백 개의 게임 세션을 안정적으로 처리합니다.
* **AI Optimization**: 브라우저 메인 스레드 부하를 방지하기 위해 AI 연산을 **Web Worker**로 분리하여 60FPS 게임 프레임을 보장합니다.

## 5. 데이터 엔티티 (Spring Data JPA)

* **Users**: 닉네임, 누적 사랑꾼 지수, 레벨.
* **Rooms/Matches**: 실시간 매칭 상태 및 스테이지 로그.
* **CringeStats**: 유저별 애정 표현 성공 및 욕설 페널티 기록.