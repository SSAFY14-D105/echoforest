# 🤖 EchoForest AI Inference Server

한국어 혐오 발언 탐지 API 서버 (Smilegate unSmile 모델 기반)

> **4인 협동 게임 (피코파크 스타일)** 저주 스택 시스템 지원

---

## 📚 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [핵심 개념 및 원리](#2-핵심-개념-및-원리)
3. [기술 스택 및 아키텍처](#3-기술-스택-및-아키텍처)
4. [저주 스택 시스템 상세](#4-저주-스택-시스템-상세)
5. [코드 상세 설명](#5-코드-상세-설명)
6. [성능 최적화 기법](#6-성능-최적화-기법)
7. [Threshold 최적화 과정](#7-threshold-최적화-과정)
8. [실행 및 테스트](#8-실행-및-테스트)
9. [성능 지표](#9-성능-지표)
10. [프로젝트 구조](#10-프로젝트-구조)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 목적
EchoForest는 4인 협동 플랫포머 게임입니다. 플레이어들이 음성 채팅 중 **부정적인 언어(욕설, 비하 표현 등)를 사용하면 "저주 스택"이 쌓이고**, 스택이 10에 도달하면 **랜덤 플레이어에게 저주가 발동**되어 게임이 어려워집니다.

이 AI 서버는 플레이어의 발화를 실시간으로 분석하여 **부정어를 탐지하고 심각도에 따라 스택 증가량을 계산**합니다.

### 1.2 핵심 기능
- **한국어 혐오 발언 탐지**: Smilegate unSmile 모델 기반
- **심각도별 스택 계산**: critical(+5), severe(+3), mild(+1)
- **배치 처리**: 5초마다 발화를 모아서 한 번에 분석
- **실시간 응답**: 싱글톤 패턴으로 50ms 이내 응답

---

## 2. 핵심 개념 및 원리

### 2.1 사용 모델: Smilegate unSmile

**Smilegate AI**에서 공개한 한국어 혐오 발언 탐지 모델입니다.

| 항목 | 내용 |
|------|------|
| **모델명** | `smilegate-ai/kor_unsmile` |
| **기반 아키텍처** | BERT (Bidirectional Encoder Representations from Transformers) |
| **학습 데이터** | 한국어 온라인 혐오 발언 데이터셋 |
| **탐지 카테고리** | 여성/가족, 남성, 성소수자, 인종/국적, 연령, 지역, 종교, 기타 혐오, 악플/욕설 |
| **출력** | 각 카테고리별 확률값 (0~1) |

### 2.2 Multi-Label Classification

unSmile 모델은 **다중 레이블 분류(Multi-Label Classification)** 모델입니다.

```
입력: "야 너 진짜 멍청이야"

출력 (각 카테고리별 확률):
{
    "여성/가족": 0.02,
    "남성": 0.01,
    "성소수자": 0.01,
    "인종/국적": 0.01,
    "연령": 0.03,
    "지역": 0.01,
    "종교": 0.01,
    "기타 혐오": 0.05,
    "악플/욕설": 0.35,  ← 가장 높은 확률
    "clean": 0.62
}
```

### 2.3 Threshold 기반 판정

모델의 확률값을 **이진 판정(부정/긍정)**으로 변환할 때 Threshold가 필요합니다.

```
Threshold = 0.10 (10%)

"악플/욕설": 0.35 → 0.35 >= 0.10 → 부정어 판정! ✅
"clean": 0.62 → (clean은 비혐오 카테고리로 무시)
```

**왜 10%인가?**
- Smilegate 공식 권장값: 17.4%
- 우리 서비스 최적값: **10%** (아래 7장에서 상세 설명)

### 2.4 Sigmoid vs Softmax

| Softmax | Sigmoid |
|---------|---------|
| 모든 클래스 확률의 합 = 1 | 각 클래스가 독립적 (0~1) |
| 상호 배타적 분류 | 다중 레이블 분류 |
| "이것 OR 저것" | "이것 AND 저것 가능" |

unSmile은 **Sigmoid**를 사용하여 하나의 문장에 여러 혐오 카테고리가 동시에 태그될 수 있습니다.

---

## 3. 기술 스택 및 아키텍처

### 3.1 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| **언어** | Python | 3.10+ |
| **웹 프레임워크** | FastAPI | 0.100+ |
| **AI 프레임워크** | PyTorch | 2.0+ |
| **모델 라이브러리** | Transformers (HuggingFace) | 4.30+ |
| **ASGI 서버** | Uvicorn | 0.23+ |
| **데이터 검증** | Pydantic | 2.0+ |

### 3.2 시스템 아키텍처

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Game Server │────▶│  AI Server   │
│  (React/TS)  │ WS  │  (Spring)    │ HTTP│  (FastAPI)   │
│              │     │              │     │              │
│ Web Speech   │     │ SPEECH_BATCH │     │ /analyze/    │
│ API로 음성   │     │ 메시지 수신  │     │ batch API    │
│ → 텍스트     │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ 5초마다 배치 전송   │ texts[] 전달       │ total_stack_delta 반환
       ▼                    ▼                    ▼
   ["바보야",          AI 서버 호출        {results: [...],
    "멍청이다",          POST               total_stack_delta: 7}
    "씨발"]         /analyze/batch
```

### 3.3 데이터 흐름 상세

1. **Frontend**: Web Speech API로 음성 → 텍스트 변환
2. **Frontend**: 5초마다 텍스트 배열을 WebSocket으로 전송
3. **Game Server**: `SPEECH_BATCH` 메시지 수신 → AI 서버 HTTP 호출
4. **AI Server**: 각 텍스트 분석 → 심각도별 스택 계산 → 총합 반환
5. **Game Server**: 팀 스택에 더하고 10 이상이면 저주 발동
6. **Frontend**: `STACK_UPDATED` 메시지로 UI 갱신

---

## 4. 저주 스택 시스템 상세

### 4.1 심각도-스택 매핑

| 심각도 | 라벨 | Confidence 범위 | 스택 증가량 | 예시 |
|--------|------|-----------------|-------------|------|
| **1** | `critical` | 80% 이상 | **+5** | 씨발, 개새끼 |
| **2** | `severe` | 50~80% | **+3** | 짜증나, 닥쳐 |
| **3** | `mild` | 10~50% | **+1** | 바보, 멍청이 |
| **0** | `clean` | 10% 미만 | **0** | 안녕하세요 |

### 4.2 배치 처리 예시

```json
// 요청
POST /api/v1/analyze/batch
{
  "texts": ["야 바보야", "너 멍청이다", "씨발"]
}

// 응답
{
  "results": [
    {"text": "야 바보야", "severity": 3, "stack_delta": 1},
    {"text": "너 멍청이다", "severity": 3, "stack_delta": 1},
    {"text": "씨발", "severity": 1, "stack_delta": 5}
  ],
  "total_count": 3,
  "negative_count": 3,
  "total_stack_delta": 7  // 1 + 1 + 5 = 7
}
```

### 4.3 저주 발동 조건

```
팀 스택 >= 10 → 랜덤 1명에게 저주 발동!
저주 발동 후 → 스택 초기화 (0)
저주 해제 조건 → "뽀뽀", "사랑해", "좋아해" 발화
```

---

## 5. 코드 상세 설명

### 5.1 main.py - 서버 진입점

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .model import get_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 모델 로드 (Lifespan Event)"""
    print("📥 unSmile 모델 사전 로드 중...")
    get_model()  # 싱글톤 패턴으로 모델 1회 로드
    print("✅ 서버 준비 완료!")
    yield  # 서버 실행 중
    print("👋 서버 종료")

app = FastAPI(
    title="EchoForest AI Server",
    lifespan=lifespan,  # Lifespan 등록
)
```

**핵심 포인트**:
- `asynccontextmanager`: 서버 시작/종료 시점의 로직을 정의
- `get_model()`: 서버 부팅 시 모델을 미리 로드하여 Cold Start 제거

### 5.2 model.py - AI 모델 래퍼 (핵심)

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

MODEL_NAME = "smilegate-ai/kor_unsmile"
THRESHOLD = 0.1  # 10% - 우리 서비스 최적값

# 싱글톤 인스턴스
_model_instance = None

class UnSmileModel:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
    
    def load(self):
        """모델 로드 (1회만 실행)"""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
        self.model.to(self.device)
        self.model.eval()  # 추론 모드
    
    def predict(self, text: str) -> dict:
        """단일 텍스트 분석"""
        # 1. 토큰화
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # 2. 추론 (기울기 계산 불필요)
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()
        
        # 3. 카테고리별 확률 매핑
        labels = ["여성/가족", "남성", "성소수자", "인종/국적", 
                  "연령", "지역", "종교", "기타 혐오", "악플/욕설", "clean"]
        all_scores = {labels[i]: float(probs[i]) for i in range(len(labels))}
        
        # 4. 혐오 카테고리 중 최대값으로 판정
        hate_scores = {k: v for k, v in all_scores.items() if k != "clean"}
        max_hate_score = max(hate_scores.values())
        is_negative = max_hate_score >= THRESHOLD
        
        # 5. 심각도 계산
        if not is_negative:
            severity = 0  # clean
        elif max_hate_score >= 0.80:
            severity = 1  # critical
        elif max_hate_score >= 0.50:
            severity = 2  # severe
        else:
            severity = 3  # mild
        
        return {
            "text": text,
            "is_negative": is_negative,
            "severity": severity,
            "confidence": max_hate_score,
            "all_scores": all_scores
        }

def get_model() -> UnSmileModel:
    """싱글톤 패턴 - 전역에서 동일 인스턴스 사용"""
    global _model_instance
    if _model_instance is None:
        _model_instance = UnSmileModel()
        _model_instance.load()
    return _model_instance
```

**핵심 포인트**:
- `torch.no_grad()`: 추론 시 기울기 계산 비활성화 → 메모리/속도 최적화
- `torch.sigmoid()`: Multi-Label 분류이므로 Softmax 대신 Sigmoid 사용
- 싱글톤 패턴: 400MB 모델을 한 번만 로드하여 재사용

### 5.3 routes.py - API 엔드포인트

```python
from fastapi import APIRouter
from .model import get_model
from .schemas import BatchSentimentRequest, BatchSentimentResponse, STACK_DELTA_MAP

router = APIRouter()

@router.post("/analyze/batch", response_model=BatchSentimentResponse)
async def analyze_sentiment_batch(request: BatchSentimentRequest):
    """배치 분석 - 게임 서버에서 호출"""
    model = get_model()
    results = []
    total_stack_delta = 0
    
    for text in request.texts:
        result = model.predict(text)
        
        # 심각도 → 스택 증가량 변환
        stack_delta = STACK_DELTA_MAP.get(result['severity'], 0)
        result['stack_delta'] = stack_delta
        total_stack_delta += stack_delta
        
        results.append(result)
    
    return BatchSentimentResponse(
        results=results,
        total_count=len(results),
        negative_count=sum(1 for r in results if r['is_negative']),
        total_stack_delta=total_stack_delta
    )
```

### 5.4 schemas.py - 데이터 스키마

```python
from pydantic import BaseModel
from typing import List, Dict

# 심각도 → 스택 증가량 매핑
STACK_DELTA_MAP = {
    0: 0,   # clean
    1: 5,   # critical (80%+)
    2: 3,   # severe (50~80%)
    3: 1,   # mild (10~50%)
}

class SentimentResponse(BaseModel):
    text: str
    is_negative: bool
    label: str
    confidence: float
    severity: int
    severity_label: str
    stack_delta: int
    all_scores: Dict[str, float]

class BatchSentimentResponse(BaseModel):
    results: List[SentimentResponse]
    total_count: int
    negative_count: int
    total_stack_delta: int  # 게임 서버가 사용하는 핵심 값
```

---

## 6. 성능 최적화 기법

### 6.1 싱글톤 패턴 (100배 속도 향상)

**문제**: BERT 모델(400MB)을 매 요청마다 로드 시 **5~10초** 소요

**해결**: 싱글톤 패턴으로 서버 시작 시 1회만 로드

```python
_model_instance = None

def get_model():
    global _model_instance
    if _model_instance is None:
        _model_instance = UnSmileModel()
        _model_instance.load()  # 최초 1회만 실행
    return _model_instance
```

**결과**: 요청당 응답 시간 **5초 → 50ms** (100배 향상)

### 6.2 FastAPI Lifespan (Cold Start 제거)

**문제**: 첫 요청 시 모델 로딩 대기 (Cold Start)

**해결**: 서버 부팅 시점에 미리 로드

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    get_model()  # 서버 시작 시 로드
    yield
```

**결과**: "서버 실행 = 서비스 준비 완료"

### 6.3 GPU 자동 감지

```python
self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
self.model.to(self.device)
```

| 환경 | 단건 추론 | 배치(32개) |
|------|-----------|------------|
| CPU | 50ms | 1,200ms |
| GPU | 5ms | 30ms |

---

## 7. Threshold 최적화 과정

### 7.1 문제 인식

Smilegate 공식 권장 Threshold: **17.4%**

하지만 우리 게임에서는 "야 바보야", "짜증나" 같은 **친구끼리의 가벼운 장난**도 저주 스택에 반영되어야 게임이 재미있습니다.

공식값(17.4%)에서는 이런 경미한 표현을 **놓치는 경우(False Negative)**가 많았습니다.

### 7.2 데이터 수집

실제 게임 플레이 환경을 시뮬레이션한 **71개 음성 샘플**을 수집:

| 카테고리 | 샘플 수 | 예시 |
|----------|---------|------|
| Clean (정상) | 38개 | "안녕하세요", "오른쪽으로 가세요" |
| Mild (경미) | 15개 | "바보야", "멍청이" |
| Strong (강함) | 12개 | "씨발", "개새끼" |
| Hate (혐오) | 6개 | "한남충", "급식충" |

### 7.3 자동 분석 파이프라인

`tests/threshold_analysis.py`를 개발하여 Threshold 0.05~0.30 범위를 자동 탐색:

```python
thresholds = [0.05, 0.08, 0.10, 0.12, 0.15, 0.174, 0.20, 0.25, 0.30]

for th in thresholds:
    # 각 threshold에서 TP, FP, TN, FN 계산
    # Precision, Recall, F1-Score 산출
```

### 7.4 분석 결과

| Threshold | Accuracy | Precision | Recall | F1 Score | 분석 |
|:---------:|:--------:|:---------:|:------:|:--------:|:-----|
| 0.05 | 52.1% | 49.3% | 100.0% | 0.660 | ❌ 과탐지 심각 |
| 0.08 | 85.9% | 78.0% | 97.0% | 0.865 | ⚠️ FP 9건 |
| **0.10** | **95.8%** | **94.1%** | **97.0%** | **0.955** | ✅ **최적값** |
| 0.174 | 93.0% | 96.7% | 87.9% | 0.921 | Smilegate 공식값 |

### 7.5 최적값 선정 근거

**Threshold 0.10 선택 이유**:
1. F1-Score 0.955로 전체 균형 최고
2. Recall 97%로 부정어 탐지율 높음 (FN 1건만)
3. FP(오제재) 2건으로 사용자 불만 최소화

**공식값(0.174) 대비 개선**:
- Recall: 87.9% → 97.0% (+9.1%p)
- FN(놓친 욕설): 4건 → 1건

---

## 8. 실행 및 테스트

### 8.1 환경 설정

```bash
# 1. 가상환경 생성/활성화
conda create -n echoforest-ai python=3.10
conda activate echoforest-ai

# 2. 의존성 설치
pip install -r requirements.txt
```

### 8.2 서버 실행

```bash
# 개발 모드 (핫 리로드)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 프로덕션 모드
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 8.3 API 테스트

```bash
# 서버 상태 확인
curl http://localhost:8000/api/v1/health

# 단일 분석
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "씨발"}'

# 배치 분석
curl -X POST http://localhost:8000/api/v1/analyze/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["바보야", "멍청이다", "씨발"]}'
```

### 8.4 자동 테스트

```bash
# API 테스트
python tests/test_api.py

# Threshold 분석
python tests/threshold_analysis.py
```

---

## 9. 성능 지표

### 9.1 분류 성능 (Threshold 0.1)

| 지표 | 값 | 설명 |
|------|-----|------|
| **F1 Score** | **0.955** | 정밀도와 재현율의 조화 평균 |
| **Accuracy** | 95.8% | 전체 정확도 |
| **Precision** | 94.1% | 욕설 판정 정밀도 (오제재율 6%) |
| **Recall** | 97.0% | 욕설 탐지율 (놓침률 3%) |

### 9.2 응답 속도

| 환경 | 단건 추론 | 배치(5개) |
|------|-----------|-----------|
| CPU (싱글톤) | ~50ms | ~200ms |
| GPU (싱글톤) | ~5ms | ~20ms |
| CPU (매번 로드) | ~5초 | ~10초 |

### 9.3 오분류 케이스

| 텍스트 | 실제 | 예측 | 원인 분석 |
|--------|------|------|-----------|
| "오른쪽으로 피하세요" | Clean | Negative | "피하다"가 혐오 맥락에서 자주 등장 |
| "이거 게임이 너무 어렵잖아" | Negative | Clean | 단순 불만은 학습 데이터 부족 |

---

## 10. 프로젝트 구조

```
inference/
├── app/                          # 핵심 소스 코드
│   ├── main.py                   # FastAPI 진입점 (Lifespan)
│   ├── model.py                  # AI 모델 래퍼 (싱글톤)
│   ├── routes.py                 # API 엔드포인트
│   ├── schemas.py                # DTO (STACK_DELTA_MAP)
│   └── README.md                 # 소스 코드 상세 설명
├── tests/                        # 테스트 및 분석 도구
│   ├── test_api.py               # 자동화 테스트
│   ├── threshold_analysis.py     # Threshold 최적화 도구
│   ├── performance_metrics.json  # 분석 결과 데이터
│   └── README.md                 # 테스트 도구 설명
├── docs/                         # API 명세서
│   ├── API_SPEC.md               # 상세 API 문서
│   └── README.md                 # 문서 개요
├── requirements.txt              # Python 의존성
└── README.md                     # 본 문서 (전체 개요)
```

---

## 📌 Quick Reference

### API 엔드포인트
| Method | Path | 용도 |
|--------|------|------|
| GET | `/api/v1/health` | 서버 상태 |
| POST | `/api/v1/analyze` | 단일 분석 |
| POST | `/api/v1/analyze/batch` | 배치 분석 ⭐ |

### 스택 증가량
| 심각도 | 스택 | 예시 |
|--------|------|------|
| critical | +5 | 씨발, 개새끼 |
| severe | +3 | 짜증나, 닥쳐 |
| mild | +1 | 바보, 멍청이 |
| clean | 0 | 안녕하세요 |

### 관련 문서
- [app/README.md](app/README.md): 소스 코드 상세
- [tests/README.md](tests/README.md): 테스트 도구
- [docs/API_SPEC.md](docs/API_SPEC.md): API 명세
