# 📂 `app/` - 핵심 소스 코드

AI 서버의 핵심 로직이 담긴 소스 파일입니다.

> 전체 개요는 [../README.md](../README.md)를 참조하세요.

---

## 📄 파일 목록

| 파일 | 역할 | 핵심 기능 |
|------|------|-----------
| `main.py` | FastAPI 진입점 | Lifespan으로 모델 사전 로드 |
| `model.py` | AI 모델 래퍼 | **싱글톤 패턴, 추론 로직** |
| `routes.py` | API 엔드포인트 | `/analyze`, `/analyze/batch` |
| `schemas.py` | 데이터 스키마 | `STACK_DELTA_MAP`, DTO 정의 |

---

## 🔗 파일 간 의존성

```
main.py
  │
  ├─▶ routes.py (API 라우터 등록)
  │     └─▶ schemas.py (요청/응답 DTO)
  │     └─▶ model.py (AI 추론)
  │
  └─▶ model.py (Lifespan에서 모델 로드)
```

---

## 📁 main.py - 서버 진입점

### 주요 기능
- **Lifespan Event**: 서버 시작 시 모델 사전 로드
- **CORS 설정**: 크로스 도메인 요청 허용
- **라우터 등록**: `/api/v1` 접두사로 API 등록

### 핵심 코드
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 모델 로드"""
    get_model()  # 싱글톤 패턴으로 모델 1회 로드
    yield

app = FastAPI(
    title="EchoForest AI Server",
    lifespan=lifespan,
)
```

### 루트 엔드포인트 응답
```json
{
  "message": "🌲 EchoForest AI Server",
  "version": "2.0.0",
  "stack_system": {
    "critical": "+5 스택",
    "severe": "+3 스택",
    "mild": "+1 스택"
  }
}
```

---

## 📁 model.py - AI 모델 래퍼 (핵심)

### 주요 기능
- **Smilegate unSmile 모델** 래핑
- **싱글톤 패턴**: 400MB 모델을 한 번만 로드
- **GPU 자동 감지**: CUDA 사용 가능 시 GPU 활용

### 주요 상수
```python
MODEL_NAME = "smilegate-ai/kor_unsmile"
THRESHOLD = 0.1  # 10% - 우리 서비스 최적값

SEVERITY_THRESHOLDS = {
    1: 0.80,  # Critical → +5 스택
    2: 0.50,  # Severe → +3 스택
    3: 0.10,  # Mild → +1 스택
}
```

### UnSmileModel 클래스

| 메서드 | 역할 |
|--------|------|
| `load()` | 모델/토크나이저 로드, GPU 할당 |
| `predict(text)` | 단일 텍스트 분석, 심각도 계산 |
| `predict_batch(texts)` | 배치 분석 (내부적으로 predict 반복) |

### 추론 흐름
```
텍스트 입력
    ↓
토큰화 (AutoTokenizer)
    ↓
모델 추론 (torch.no_grad())
    ↓
Sigmoid → 각 카테고리별 확률
    ↓
혐오 카테고리 중 최대값 추출
    ↓
threshold(10%) 비교 → is_negative 결정
    ↓
심각도 계산 (80%/50%/10% 기준)
    ↓
결과 반환
```

### 싱글톤 패턴
```python
_model_instance = None

def get_model() -> UnSmileModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = UnSmileModel()
        _model_instance.load()
    return _model_instance
```

---

## 📁 routes.py - API 엔드포인트

### 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/v1/health` | 서버 상태 확인 |
| POST | `/api/v1/analyze` | 단일 텍스트 분석 |
| POST | `/api/v1/analyze/batch` | **배치 분석 (핵심!)** |

### 배치 분석 로직 (핵심)
```python
@router.post("/analyze/batch")
async def analyze_sentiment_batch(request: BatchSentimentRequest):
    model = get_model()
    total_stack_delta = 0
    
    for text in request.texts:
        result = model.predict(text)
        stack_delta = STACK_DELTA_MAP.get(result['severity'], 0)
        total_stack_delta += stack_delta
    
    return BatchSentimentResponse(
        results=results,
        total_stack_delta=total_stack_delta  # 게임 서버가 사용
    )
```

---

## 📁 schemas.py - 데이터 스키마

### 핵심 상수: STACK_DELTA_MAP
```python
STACK_DELTA_MAP = {
    0: 0,   # clean: 스택 증가 없음
    1: 5,   # critical (80%+): +5 스택
    2: 3,   # severe (50~80%): +3 스택
    3: 1,   # mild (10~50%): +1 스택
}
```

### DTO 클래스

| 클래스 | 용도 |
|--------|------|
| `SentimentRequest` | 단일 분석 요청 (`text: str`) |
| `SentimentResponse` | 분석 결과 (심각도, 스택 증가량 포함) |
| `BatchSentimentRequest` | 배치 분석 요청 (`texts: List[str]`) |
| `BatchSentimentResponse` | 배치 결과 + `total_stack_delta` |
| `HealthResponse` | 헬스 체크 응답 |

### SentimentResponse 필드
```python
class SentimentResponse(BaseModel):
    text: str
    is_negative: bool
    label: str           # 혐오 카테고리 (악플/욕설, 여성/가족 등)
    confidence: float    # 0.0 ~ 1.0
    severity: int        # 0=clean, 1=critical, 2=severe, 3=mild
    severity_label: str  # "clean", "critical", "severe", "mild"
    stack_delta: int     # 이 발화로 인한 스택 증가량
    all_scores: Optional[Dict[str, float]]  # 전체 카테고리 점수
```

---

## 🚀 실행

```bash
# 개발 모드 (핫 리로드)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 프로덕션 모드
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 🔗 관련 문서

- [../README.md](../README.md) - 전체 개요
- [../tests/README.md](../tests/README.md) - 테스트 도구
- [../docs/API_SPEC.md](../docs/API_SPEC.md) - API 명세서
