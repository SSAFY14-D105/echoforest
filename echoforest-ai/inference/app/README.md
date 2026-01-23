# 📂 `app/` - 핵심 소스 코드

AI 서버의 핵심 로직이 담긴 소스 파일들입니다.

> **4인 협동 게임 저주 스택 시스템 지원**

---

## 📄 파일 구조 및 역할

### 1. `main.py` - FastAPI 애플리케이션 진입점
**역할**: 서버 시작 및 라이프사이클 관리

```python
# 주요 기능
- FastAPI 앱 인스턴스 생성
- CORS 설정 (프론트엔드 연동)
- Lifespan 이벤트 (서버 시작 시 모델 로드)
- API 라우터 등록
```

**실행**:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### 2. `model.py` - AI 모델 래퍼 (핵심)
**역할**: UnSmile 모델 로드 및 추론

#### 주요 상수
```python
MODEL_NAME = "smilegate-ai/kor_unsmile"
THRESHOLD = 0.1  # 10% - 욕설 판정 기준값

SEVERITY_THRESHOLDS = {
    1: 0.80,  # Critical (80% 이상) → +5 스택
    2: 0.50,  # Severe (50~80%)     → +3 스택
    3: 0.1,   # Mild (10~50%)       → +1 스택
}
```

#### 핵심 클래스
- **`UnSmileModel`**: BERT 기반 모델 래퍼
  - `load()`: 모델을 메모리에 로드 (GPU 자동 감지)
  - `predict(text)`: 단일 텍스트 분석
  - `predict_batch(texts)`: 배치 처리

#### 싱글톤 패턴
```python
_model_instance = None  # 전역 인스턴스

def get_model() -> UnSmileModel:
    """서버 시작 시 한 번만 로드, 이후 재사용"""
    global _model_instance
    if _model_instance is None:
        _model_instance = UnSmileModel()
        _model_instance.load()
    return _model_instance
```

**성능 이점**: 매 요청마다 모델을 로드하지 않아 **응답 속도 100배 향상** (~5초 → ~50ms)

---

### 3. `routes.py` - API 라우팅 (스택 계산 포함)
**역할**: HTTP 엔드포인트 정의 + 저주 스택 증가량 계산

#### 엔드포인트 목록
| Method | Path | 기능 |
|--------|------|------|
| `GET` | `/api/v1/health` | 서버 상태 확인 |
| `POST` | `/api/v1/analyze` | 단일 텍스트 분석 + `stack_delta` 반환 |
| `POST` | `/api/v1/analyze/batch` | **배치 분석 + `total_stack_delta` 반환** |

#### 스택 증가량 계산 로직
```python
from .schemas import STACK_DELTA_MAP

# STACK_DELTA_MAP = {0: 0, 1: 5, 2: 3, 3: 1}

@router.post("/analyze/batch")
async def analyze_sentiment_batch(request: BatchSentimentRequest):
    total_stack_delta = 0
    
    for text in request.texts:
        result = model.predict(text)
        stack_delta = STACK_DELTA_MAP.get(result['severity'], 0)
        total_stack_delta += stack_delta  # 각 부정어 스택 누적!
    
    return BatchSentimentResponse(
        results=results,
        total_stack_delta=total_stack_delta  # 게임 서버에서 바로 사용
    )
```

---

### 4. `schemas.py` - 데이터 스키마 (스택 증가량 포함)
**역할**: API 요청/응답 DTO (Data Transfer Object)

#### 스택 증가량 상수
```python
STACK_DELTA_MAP = {
    0: 0,   # clean: 스택 증가 없음
    1: 5,   # critical (80%+): +5 스택
    2: 3,   # severe (50~80%): +3 스택
    3: 1,   # mild (10~50%): +1 스택
}
```

#### 주요 스키마
```python
class SentimentResponse(BaseModel):
    text: str
    is_negative: bool        # 욕설 여부
    label: str               # 카테고리 (악플/욕설, clean 등)
    confidence: float        # 신뢰도 (0~1)
    severity: int            # 심각도 (0, 1, 2, 3)
    severity_label: str      # 심각도 라벨 (clean, critical, severe, mild)
    stack_delta: int         # 🔮 이 발화의 스택 증가량
    all_scores: Dict[str, float]

class BatchSentimentResponse(BaseModel):
    results: List[SentimentResponse]
    total_count: int         # 총 분석된 텍스트 수
    negative_count: int      # 부정어 수
    total_stack_delta: int   # 🔮 이 배치의 총 스택 증가량
```

**Pydantic 검증**: 자동으로 타입 체크 및 유효성 검사

---

## 🔗 파일 간 의존성 관계

```
main.py
  │
  ├─> routes.py (API 엔드포인트)
  │     └─> schemas.py (요청/응답 스키마, STACK_DELTA_MAP)
  │     └─> model.py (AI 추론)
  │
  └─> model.py (Lifespan에서 모델 로드)
```

---

## ⚙️ 주요 설정값

### model.py - 심각도 판정
| 상수 | 값 | 의미 |
|------|-----|------|
| `THRESHOLD` | **0.1** | 욕설 판정 기준 (10%) |
| `SEVERITY_THRESHOLDS[1]` | 0.80 | Critical 기준 (80%) |
| `SEVERITY_THRESHOLDS[2]` | 0.50 | Severe 기준 (50%) |
| `SEVERITY_THRESHOLDS[3]` | 0.10 | Mild 기준 (10%) |

### schemas.py - 스택 증가량
| 심각도 | 스택 증가량 | 설명 |
|--------|-------------|------|
| 0 (clean) | 0 | 정상 발화 |
| 1 (critical) | **+5** | 심각한 욕설 (씨발, 개새끼 등) |
| 2 (severe) | **+3** | 중간 욕설 (짜증나, 열받네 등) |
| 3 (mild) | **+1** | 경미한 부정어 (바보, 멍청이 등) |

> **중요**: 모든 threshold는 **0.1 (10%)**로 설정되어, "바보", "짜증나" 같은 경미한 욕설도 탐지됩니다.
