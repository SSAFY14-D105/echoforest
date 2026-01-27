# 📂 `app/` - 핵심 소스 코드

AI 서버의 핵심 로직이 담긴 소스 파일입니다.

> 전체 개요는 [../README.md](../README.md)를 참조하세요.

---

## 📄 파일 목록

| 파일 | 역할 | 핵심 기능 |
|------|------|-----------|
| `main.py` | FastAPI 진입점 | Lifespan으로 모델 사전 로드 |
| `model.py` | AI 모델 래퍼 | 싱글톤 패턴, 추론 로직 |
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

## ⚙️ 주요 상수

### model.py
```python
MODEL_NAME = "smilegate-ai/kor_unsmile"
THRESHOLD = 0.1  # 10% - 우리 서비스 최적값

SEVERITY_THRESHOLDS = {
    1: 0.80,  # Critical → +5 스택
    2: 0.50,  # Severe → +3 스택
    3: 0.10,  # Mild → +1 스택
}
```

### schemas.py
```python
STACK_DELTA_MAP = {
    0: 0,   # clean
    1: 5,   # critical
    2: 3,   # severe
    3: 1,   # mild
}
```

---

## 🚀 실행

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
