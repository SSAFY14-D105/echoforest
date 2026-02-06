# 🌲 EchoForest AI Server

> **SSAFY 14기 S14P11D105** - AI 기반 부정 발언 탐지 서버

## 📌 개요

EchoForest 게임의 음성 채팅에서 **부정적 발언을 실시간으로 탐지**하여 저주 스택을 계산하는 AI 서버입니다.

| 항목 | 내용 |
|------|------|
| **모델** | [smilegate-ai/kor_unsmile](https://huggingface.co/smilegate-ai/kor_unsmile) |
| **프레임워크** | FastAPI + PyTorch |
| **핵심 기능** | 혐오 발언 탐지, 심각도별 스택 계산 |
| **성능** | F1 0.955 / 응답속도 ~50ms |

## 🚀 빠른 시작

```bash
# 1. 환경 설정
conda create -n echoforest-ai python=3.10 -y
conda activate echoforest-ai

# 2. 의존성 설치
cd echoforest-ai/inference
pip install -r requirements.txt

# 3. 서버 실행
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 📡 핵심 API

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

## 📁 프로젝트 구조

```
S14P11D105/
├── README.md                    ← 현재 문서
└── echoforest-ai/
    ├── inference/               ← AI 추론 서버
    │   ├── app/                 # FastAPI 소스 코드
    │   ├── tests/               # 테스트 및 분석 도구
    │   ├── docs/                # API 명세서
    │   └── README.md            # 📖 상세 문서
    └── training/                ← 모델 학습 (예정)
```

## 📖 상세 문서

| 문서 | 내용 |
|------|------|
| [inference/README.md](echoforest-ai/inference/README.md) | 아키텍처, 모델 원리, 코드 상세 설명 |
| [app/README.md](echoforest-ai/inference/app/README.md) | 소스 코드 구조 |
| [tests/README.md](echoforest-ai/inference/tests/README.md) | 테스트 및 성능 분석 |
| [docs/API_SPEC.md](echoforest-ai/inference/docs/API_SPEC.md) | 전체 API 명세 |

## 👥 팀

**SSAFY 14기 S14P11D105**
