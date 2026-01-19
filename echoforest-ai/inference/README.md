# 🤖 EchoForest AI Inference Server

Smilegate **unSmile** 모델 기반의 한국어 혐오 발언 탐지 API 서버입니다.

> 📖 전체 시스템 개요는 [echoforest-ai/README.md](../README.md)를 참조하세요.

---

## 📁 프로젝트 구조

```
inference/
├── app/
│   ├── __init__.py
│   ├── main.py        # FastAPI 앱 진입점
│   ├── model.py       # UnSmile 모델 래퍼
│   ├── routes.py      # API 라우트 정의
│   └── schemas.py     # Pydantic 스키마
├── docs/
├── tests/
├── requirements.txt
└── README.md
```

---

## 🚀 실행 방법

```bash
# Conda 환경 활성화
conda activate echoforest-ai

# 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**API 문서**: http://localhost:8000/docs

---

## 📊 동작 흐름

```
텍스트 입력: "씨발 뭐야"
        │
        ▼
┌───────────────────────────────────────────────┐
│  1️⃣ 토큰화                                    │
│  "씨발 뭐야" → [101, 1234, 5678, 9012, 102]   │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│  2️⃣ BERT 모델 추론                            │
│  → 10개 카테고리별 확률값 출력                 │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│  3️⃣ 판정 (Threshold = 17.4%)                 │
│  max_hate_score >= 0.174 → is_negative       │
└───────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│  4️⃣ 심각도 계산                               │
│  80%+ → critical, 50~80% → severe            │
│  17.4~50% → mild, <17.4% → clean             │
└───────────────────────────────────────────────┘
```

---

## 🔑 핵심 코드

### 토큰화

```python
inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
```

### 모델 추론

```python
with torch.no_grad():
    outputs = self.model(**inputs)
    probs = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()
```

### 혐오 판정

```python
is_negative = max_hate_score >= 0.174  # threshold
```

### 심각도 계산

```python
if max_hate_score >= 0.80:
    severity = 1      # critical
elif max_hate_score >= 0.50:
    severity = 2      # severe
elif max_hate_score >= 0.174:
    severity = 3      # mild
else:
    severity = 0      # clean
```

### 싱글톤 패턴

```python
def get_model() -> UnSmileModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = UnSmileModel()
        _model_instance.load()
    return _model_instance
```

---

## 📝 파일별 역할

| 파일 | 역할 |
|------|------|
| `main.py` | FastAPI 앱 생성, CORS 설정, 모델 사전 로드 |
| `model.py` | UnSmile 모델 래퍼, `predict()` 함수 |
| `routes.py` | API 엔드포인트 정의 |
| `schemas.py` | Pydantic 요청/응답 스키마 |

---

## ⚠️ 참고 사항

- **GPU 권장**: CUDA 지원 GPU 자동 사용
- **첫 실행**: Hugging Face에서 모델 다운로드 (~400MB)
- **성능 개선**: 파인튜닝 권장
