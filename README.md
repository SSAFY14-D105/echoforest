# 🌲 EchoForest AI Server (Inference)

> **SSAFY 14기 S14P11D105** - AI 기반 부정 발언 탐지 및 심각도 분석 서버

## 📌 개요

EchoForest 게임의 음성 채팅에서 **부정적 발언을 실시간으로 탐지**하고, **심각도를 3단계로 분류**하여 저주 스택을 계산하는 AI 서버입니다.

| 항목 | 내용 |
|------|------|
| **베이스 모델** | [smilegate-ai/kor_unsmile](https://huggingface.co/smilegate-ai/kor_unsmile) (Baseline) |
| **프레임워크** | FastAPI + PyTorch |
| **핵심 기능** | 1. 혐오/욕설 발언 실시간 탐지<br>2. 발언 강도(Probability) 기반 **3단계 심각도 분류**<br>3. 게임 내 **저주 스택(Curse Stack)** 계산 |
| **현재 상태** | **Baseline 모델 적용** (Fine-tuning 이전 버전) |

## 🚀 빠른 시작

```bash
# 1. 환경 설정
conda create -n echoforest-ai python=3.10 -y
conda activate echoforest-ai

# 2. 의존성 설치
cd echoforest-ai/inference
pip install -r requirements.txt

# 3. 서버 실행 (포트 8000)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 📡 핵심 API (Batch Analysis)

게임 서버에서 수집된 여러 명의 음성 텍스트를 한 번에 분석하여 스택 변화량을 반환합니다.

### Request (`POST /api/v1/analyze/batch`)
```json
{
  "texts": [
    "아 진짜 답답하네",  // Mild (약함) -> +1
    "야 이 트롤 새끼야", // Severe (강함) -> +3
    "사랑해 고마워"      // Clean (정상) -> +0
  ]
}
```

### Response
```json
{
  "total_stack_delta": 4,   // 총 스택 변화량 (1 + 3 + 0)
  "negative_count": 2,      // 부정 발언 감지 횟수
  "abused_details": [       // (옵션) 상세 분석 결과
    {"text": "아 진짜 답답하네", "label": "clean", "score": 0.35, "severity": "mild", "stack": 1},
    {"text": "야 이 트롤 새끼야", "label": "abuse", "score": 0.85, "severity": "severe", "stack": 3}
  ]
}
```

## ⚖️ 심각도 분류 로직 (Curse Logic)

AI 모델이 예측한 **부정 발언 확률(Probability)**에 따라 저주 스택을 차등 부여합니다.

| 단계 | 심각도 | 확률(Score) 기준 | 스택 | 설명 |
|:---:|:---:|:---:|:---:|:---|
| **1** | **Mild** | 30% ~ 50% | **+1** | 가벼운 짜증, 애매한 부정 표현 |
| **2** | **Severe** | 50% ~ 70% | **+3** | 명확한 비난, 공격적인 언어 |
| **3** | **Critical** | 70% 이상 | **+5** | 심한 욕설, 인신공격 (게임 내 치명적) |

## 📁 프로젝트 구조

```
S14P11D105-ai-server/
├── README.md                    ← 현재 문서 (Project Root)
└── echoforest-ai/
    ├── inference/               ← AI 추론 서버 (FastAPI)
    │   ├── app/                 # 소스 코드 (main.py, services/, models/...)
    │   ├── tests/               # 단위 테스트
    │   └── README.md            # 📖 [상세] 서버 아키텍처 및 구현 설명
    └── training/                # (예정) 모델 학습 및 Fine-tuning 스크립트
```

## 📖 상세 문서

| 문서 | 내용 |
|------|------|
| [**inference/README.md**](echoforest-ai/inference/README.md) | **[필독]** 서버 아키텍처, 3단계 심각도 로직 상세 구현 |
| [app/README.md](echoforest-ai/inference/app/README.md) | FastAPI 모듈별 설명 (Controller, Service) |
| [tests/README.md](echoforest-ai/inference/tests/README.md) | 테스트 실행 방법 및 시나리오 |
