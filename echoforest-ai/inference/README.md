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

## 🚀 서버 실행

### 실행 명령어

```bash
conda activate echoforest-ai
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

| 옵션 | 설명 |
|------|------|
| `app.main:app` | `app/main.py`의 `app` 객체 |
| `--reload` | 코드 변경 시 자동 재시작 (개발용) |
| `--host 0.0.0.0` | 외부 IP 접속 허용 |
| `--port 8000` | 8000번 포트 사용 |

**API 문서**: http://localhost:8000/docs

---

## ⚙️ 서버 시작 흐름

```
uvicorn 실행
    │
    ▼
┌───────────────────────────────────────────────────┐
│  1️⃣ main.py 로드                                  │
│  app = FastAPI(...) 객체 생성                     │
└───────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────┐
│  2️⃣ lifespan 이벤트 실행                          │
│  ─────────────────────────────────────────────────│
│  print("� 서버 시작 중...")                       │
│  get_model()  ← 모델 미리 로드 (5~10초)            │
│  print("✅ 서버 준비 완료!")                       │
│  yield  ← 서버 대기 상태                           │
└───────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────┐
│  3️⃣ 라우터 등록                                   │
│  ─────────────────────────────────────────────────│
│  GET  /                                           │
│  GET  /api/v1/health                              │
│  POST /api/v1/analyze                             │
│  POST /api/v1/analyze/batch                       │
└───────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────┐
│  4️⃣ 클라이언트 요청 대기                          │
│  Uvicorn running on http://0.0.0.0:8000           │
└───────────────────────────────────────────────────┘
```

---

## 📡 요청 처리 흐름

```
클라이언트 → Uvicorn → FastAPI → routes.py → model.py
    │
    ▼
POST /api/v1/analyze { "text": "씨발" }
    │
    ▼
┌───────────────────────────────────────────────────┐
│  routes.py: analyze_sentiment()                   │
│  ─────────────────────────────────────────────────│
│  1. Pydantic으로 요청 검증                         │
│  2. model = get_model()  ← 싱글톤 모델             │
│  3. result = model.predict(text)                  │
│  4. return SentimentResponse(...)                 │
└───────────────────────────────────────────────────┘
    │
    ▼
{ "is_negative": true, "severity": 1, ... }
```

---

## 📊 모델 추론 흐름

```
텍스트 입력: "씨발 뭐야"
    │
    ▼
┌───────────────────────────────────────────────────┐
│  1️⃣ 토큰화                                        │
│  "씨발 뭐야" → [101, 1234, 5678, 9012, 102]       │
└───────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────┐
│  2️⃣ BERT 모델 추론                                │
│  → 10개 카테고리별 확률값 출력                     │
└───────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────┐
│  3️⃣ 판정 (Threshold = 17.4%)                     │
│  max_hate_score >= 0.174 → is_negative           │
└───────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────┐
│  4️⃣ 심각도 계산                                   │
│  80%+ → critical, 50~80% → severe                │
│  17.4~50% → mild, <17.4% → clean                 │
└───────────────────────────────────────────────────┘
```

---

## 🔑 핵심 코드

### 모델 로드 (lifespan)

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 서버 시작 중...")
    get_model()  # 모델 사전 로드
    print("✅ 서버 준비 완료!")
    yield
    print("👋 서버 종료")
```

### 싱글톤 패턴

```python
_model_instance = None

def get_model() -> UnSmileModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = UnSmileModel()
        _model_instance.load()  # 5~10초 소요
    return _model_instance  # 이후 즉시 반환
```

**왜 싱글톤?**
- 모델 로딩: 5~10초 (400MB)
- 싱글톤 없이 매 요청 로드 → 응답 5초+
- 싱글톤 사용 → 응답 ~50ms

### 토큰화

```python
inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
```

### 모델 추론

```python
with torch.no_grad():  # 추론 모드 (gradient 계산 안 함)
    outputs = self.model(**inputs)
    probs = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()
```

### 혐오 판정

```python
is_negative = max_hate_score >= 0.174  # threshold 17.4%
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

---

## 📝 파일별 역할

| 파일 | 역할 |
|------|------|
| `main.py` | FastAPI 앱 생성, lifespan 이벤트, CORS 설정 |
| `model.py` | UnSmile 모델 래퍼, `predict()` 함수, 싱글톤 |
| `routes.py` | API 엔드포인트 정의 |
| `schemas.py` | Pydantic 요청/응답 스키마 |

---

## 🔧 핵심 컴포넌트 관계

```
main.py (진입점)
    │
    ├── FastAPI() 앱 생성
    │
    ├── lifespan() → get_model() 호출
    │
    ├── CORSMiddleware (프론트엔드 접근 허용)
    │
    └── router 등록 (routes.py)
            │
            ├── /health → health_check()
            │
            └── /analyze → analyze_sentiment()
                    │
                    └── model.predict() (model.py)
                            │
                            └── Hugging Face 모델 추론
```

---

## ⚠️ 참고 사항

| 항목 | 설명 |
|------|------|
| **GPU** | CUDA 지원 GPU 자동 사용 |
| **첫 실행** | Hugging Face에서 모델 다운로드 (~400MB) |
| **비동기** | FastAPI는 비동기 처리로 동시 요청 처리 가능 |
| **핫 리로드** | `--reload` 옵션으로 코드 수정 시 자동 재시작 |
