# 🌲 EchoForest 모션 인식 샌드박스

이 프로젝트는 **EchoForest**의 제스처 인식 기능을 독립적으로 테스트하고 개발하기 위해 구성된 전용 샌드박스입니다.
기존 프론트엔드 코드에서 모션 인식에 불필요한 부분은 모두 제거되었으며, 오직 제스처 테스트를 위한 최소한의 환경만 제공합니다.

## 🚀 기능
- **13종 제스처 인식**: MediaPipe 기반의 손/얼굴 제스처 실시간 감지
- **TypeScript 기반**: 기존 JS 코드를 모두 TS로 변환하여 안정성 확보
- **통합 테스트 UI**: 웹캠을 통해 모든 제스처를 한눈에 테스트 가능

## 🛠️ 실행 방법

1. **설치**
   ```bash
   npm install
   ```

2. **실행**
   ```bash
   npm run dev
   ```
   브라우저가 열리면 바로 테스트 페이지가 뜹니다.

## 📂 주요 디렉토리 구조
```
src/
├── components/motion/    # 13가지 개별 제스처 로직 (TS)
├── hooks/                # MediaPipe 연동 훅 (useMultiMotionDetector)
├── utils/                # 제스처 관리자 (PoseManager) 및 유틸리티
└── pages/                # 테스트용 UI 페이지 (MotionTestPage)
```

## ✋ 지원되는 제스처 목록
- 🙆‍♂️ 머리위하트 (`BigHeart`)
- 💕 양볼콕 (`BothCheekPoke`)
- 🐱 고양이귀 (`CatEars`)
- 🫶 볼하트 (`CheekHeart`)
- ✊ 주먹 (`Fist`)
- ❤️ 손하트 (`Heart`)
- 💋 뽀뽀 (`Kiss`)
- 👆 L자 (`LGesture`)
- 👈 왼볼콕 (`LeftPoke`)
- 👌 OK (`OKGesture`)
- 👉 오른볼콕 (`RightPoke`)
- ⚡ 탈모빔 (`TalmoBeam`)
- ✌️ 브이 (`VSign`)
