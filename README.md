# 🌲 메아리의 숲 (Echo Forest)

> **"나쁜 말은 저주가 되어, 좋은 말은 길이 되어 돌아오는 곳. </br> 감정의 힘으로 움직이는 메아리의 숲에서
펼쳐지는 모험 이야기"**  

---

## 1. 프로젝트 개요

### 📖 프로젝트 소개
**메아리의 숲**은 **AI 감정 인식 기술 기반의 4인 협동 멀티플레이어 어드벤처 웹게임 서비스**입니다.  
플레이 중 사용자의 **말(부정어, 긍정어)**이 실제 게임 플레이에 영향을 주는 것이 핵심 특징입니다.

### 🎯 프로젝트 목표
협동 상황에서 '말'이 팀 플레이에 미치는 영향을 직접 체험할 수 있습니다.
- **부정적인 발언** 🤬 → **페널티(저주)** 발생
- **긍정적인 발언** 😍 → **구원(해제)** 발생

오프라인 만남이 줄어든 현대 사회에서, 물리적 거리를 넘어 정서적 유대감을 회복할 수 있는 공간을 지향합니다.  
단순한 오락을 넘어, 화상과 음성으로 함께 웃으며 단절된 관계를 잇는 **따뜻한 디지털 소셜 공간**입니다.



---

## 2. 서비스 기획 배경

### 💡 기획 배경
- **온라인 소통의 문제 의식**: 익명성에 기댄 비난은 쉽지만, 다정함과 공감은 어려운 현대의 온라인 환경.
- **작은 반항**: 자극적인 표현이 난무하는 세태 속에서, 언어적 책임감을 느끼고 긍정적 표현의 가치를 재발견하고자 합니다.
- **게임적 허용**: 강압적인 검열 대신, "사랑해", "좋아해" 같은 다정한 말이 위기를 극복하는 열쇠가 되도록 설계하여 자연스러운 긍정 소통을 유도합니다.

---

## 3. 시작하기

### 💻 실행 환경
- **브라우저**: Chrome (필수)
- **입력 장치**: 키보드, 마이크(필수), 웹캠(필수)
- **권장 사항**: 이어폰/헤드셋 착용 (하울링 방지)

### 🚀 실행 방법
1. 웹사이트 접속 후 **회원가입/로그인**
2. 로비에서 **4인 파티** 구성 (초대 또는 매칭)
3. **게임 시작** 버튼 클릭

---

## 4. 게임 가이드

### 🎮 조작법
| 동작 | 키 (Key) | 설명 |
| :--- | :---: | :--- |
| **이동** | `←`, `→` | 좌우 이동 |
| **점프** | `↑` | 점프 |
| **소통** | `마이크` | 실시간 음성 대화 |

> **협동 팁**: 혼자서는 통과할 수 없는 구간이 많습니다. "하나, 둘, 셋!" 구호에 맞춰 움직이세요!

### ☠️ 저주 시스템
플레이어들이 **부정적인 말**을 하면 '부정 스택'이 쌓입니다.
- **1단계 욕설**: +5 스택
- **2단계 비난**: +3 스택
- **3단계 부정**: +1 스택

**스택 5** 도달 시, 랜덤 1명에게 **저주**가 발동됩니다.

| 저주 종류 | 효과 |
| :--- | :--- |
| **거대화** | 크기 2배, 이동/점프력 절반 감소 |
| **반전** | 방향키 조작 반대 (상하좌우) |
| **시한폭탄** | 5초 내 해제 실패 시 **즉사** |

### ❤️ 저주 해제
저주에 걸린 사람은 스스로 해제할 수 없습니다. **동료들의 따뜻한 말**이 필요합니다!
- **해제 키워드**: "사랑해", "좋아해", "뽀뽀"

### 📸 엔딩 미션 & 추억
- 스테이지 클리어 시 **모션 인식 미션**이 진행됩니다. (랜덤 포즈 14종)
- 4명 모두 포즈를 성공하면 **기념 사진**이 촬영됩니다.
- 게임 종료 후 촬영된 사진들을 **이메일**로 받아볼 수 있습니다.

---

## 5. 기술 스택

### Frontend
- **Framework**: React, Vite
- **Language**: TypeScript
- **Game Engine**: Phaser 3
- **Webrtc**: LiveKit (Video/Audio)
- **State Management**: Zustand
- **Media**: MediaPipe (Motion Recognition)

### Backend
- **Framework**: Spring Boot 3.5.9
- **Language**: Java 21
- **Database**: MySQL, Redis (Cache/Session)
- **Security**: Spring Security, JWT
- **API Docs**: Swagger (SpringDoc)
- **Monitoring**: Actuator, Prometheus

### AI
- **Framework**: FastAPI, PyTorch
- **Model**: [smilegate-ai/kor_unsmile](https://huggingface.co/smilegate-ai/kor_unsmile)
- **Performance**: F1 Score 0.955, Response Time ~50ms
- **Features**: Real-time Hate Speech Detection, Severity-based Stack Calculation

### DevOps & Infra
- **CI/CD**: Jenkins, Mattermost
- **Server**: AWS EC2
- **Container**: Docker
- **Proxy**: Nginx

---

## 6. 시스템 아키텍처

### 🏗️ Architecture Overview
![System Architecture](./docs/system_architecture.png)

### 🔄 CI/CD Pipeline
![CICD Architecture](./docs/CICD_architecture.png)

### 🧩 Usecase Diagram
![Usecase Diagram](./docs/usecase_diagram.png)

---

## 7. 화면 구성 

| 메인 및 로비 | 내정보 | 대기실 |
| :---: | :---: | :---: |
| <img src="docs/lobby.png" width="280" /> | <img src="docs/mypage.png" width="280" /> | <img src="docs/waiting_room.png" width="280" /> |
| **인게임** | **통계** | |
| <img src="docs/ingame.gif" width="280" /> | <img src="docs/stat.png" width="280" /> | |

---

## 8. 주요 기능

| 기능 | 설명 | 프리뷰 |
| :--- | :--- | :---: |
| **음성 인식** | 실시간 음성 부정어/긍정어 분석 | ![저주스택](docs/저주스택.gif) |
| **저주 시스템** | 부정어 사용 시 거대화, 반전, 시한폭탄 등 랜덤 저주 발동 | ![거대화저주](docs/거대화저주.gif) ![반전저주](docs/반전저주.gif) ![시한폭탄저주](docs/시한폭탄저주.gif) |
| **스테이지 기믹** | 협동이 필요한 다양한 퍼즐과 기믹 수행 | ![1스테이지](docs/stage1.png) ![2스테이지](docs/stage2.png) |
| **모션 인식 엔딩 미션** | 스테이지 클리어 후 포즈 따라하기 미션 수행 | ![엔딩미션](docs/엔딩미션.gif) |
| **추억 저장 & 이메일** | 자동 촬영된 게임 스냅샷 저장 및 이메일 전송 | <img src="docs/gallery.png" width="200" /> <img src="docs/email.png" width="200" /> <img src="docs/send_image.png" width="200" /> |

---

## 9. API 명세

### Game Server (Spring Boot)
![Swagger](./docs/echoforest_swagger.png)

### AI Server (FastAPI)

```http
POST /api/v1/analyze/batch
Content-Type: application/json

{"texts": ["바보야", "씨발"]}
```

**응답:**
```json
{
  "total_stack_delta": 6,
  "negative_count": 2
}
```

---

## 10. 디렉토리 구조

```
📦 메아리의 숲
├── 📂 frontend/                    # React + Phaser Game Client
│   ├── 📂 src/
│   │   ├── 📂 api/                 # API 호출
│   │   ├── 📂 assets/              # 게임 에셋 (이미지, 사운드)
│   │   ├── 📂 components/          # React 컴포넌트
│   │   ├── 📂 hooks/               # Custom Hooks
│   │   ├── 📂 pages/               # 페이지 라우팅
│   │   ├── 📂 phaser/              # Phaser 게임 로직
│   │   │   ├── 📂 scenes/          # 게임 씬 (Main, Stage)
│   │   │   ├── 📂 entities/        # 플레이어(Player) 및 오브젝트
│   │   │   └── 📂 gimmicks/        # 상호작용 기믹 (Elevator, Trap)
│   │   ├── 📂 store/               # Zustand 상태 관리 (GameStore)
│   │   └── 📂 socket/              # WebSocket 및 LiveKit 핸들러
│   └── 📄 package.json
├── 📂 backend/                     # Spring Boot API Server
│   ├── 📂 src/main/java/com/d105/
│   │   ├── 📂 config/              # 설정 파일 (Security, Swagger)
│   │   ├── 📂 controller/          # API 컨트롤러
│   │   ├── 📂 game/                # 게임 비즈니스 로직
│   │   ├── 📂 service/             # 서비스 레이어
│   │   ├── 📂 entity/              # DB 엔티티 (JPA)
│   │   └── 📂 scheduler/           # 스케줄러 (매너 점수 등)
│   └── 📄 build.gradle
└── 📂 ai/                          # AI Inference Server
    ├── 📂 app/                     # FastAPI 애플리케이션
    │   └── 📄 main.py              # 메인 실행 파일
    ├── 📂 tests/                   # 성능 테스트 도구
    └── 📄 requirements.txt
```

---

## 11. AI 상세 문서

| 문서 | 내용 |
|------|------|
| [inference/README.md](echoforest-ai/inference/README.md) | 아키텍처, 모델 원리, 코드 상세 설명 |
| [app/README.md](echoforest-ai/inference/app/README.md) | 소스 코드 구조 |
| [tests/README.md](echoforest-ai/inference/tests/README.md) | 테스트 및 성능 분석 |
| [docs/API_SPEC.md](echoforest-ai/inference/docs/API_SPEC.md) | 전체 API 명세 |

---

## 12. 영상 포트폴리오

[![Video Label](https://img.youtube.com/vi/8m-AHCVeUrs/hqdefault.jpg)](https://youtu.be/8m-AHCVeUrs)
> *클릭하여 시연 영상을 확인하세요.*

---

## 13. 팀원 소개

| 이혜민 | 이태희 | 손다현 |
| :---: | :---: | :---: |
| ![이혜민](docs/이혜민.png) | ![이태희](docs/이태희.png) | ![손다현](docs/손다현.png) |

| 김건호 | 박준영 | 진현제 |
| :---: | :---: | :---: |
| ![김건호](docs/김건호.png) | ![박준영](docs/박준영.png) | ![진현제](docs/진현제.png) |

---

## 14. FAQ 및 주의사항

- **Q: 게임 실행이 안 돼요.**
  - A: 크롬 브라우저를 사용 중인지, 마이크/카메라 권한을 허용했는지 확인해 주세요.
- **Q: 혼자 할 수 있나요?**
  - A: 아니요, 본 게임은 4인 협동 전용입니다.
- **데이터 처리**: 게임 중 촬영된 사진은 서비스 제공(이메일 전송) 후 **일주일 뒤 자동 파기**됩니다.

---
**Created by Team EchoForest**