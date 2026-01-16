# EchoForest AI Inference Server

Smilegate unSmile 모델 기반 감정 분석 API 서버

## 기능
- 혐오 발언 탐지 (threshold: 17.4%)
- 혐오 카테고리 분류: 여성/가족, 남성, 성소수자, 인종/국적, 연령, 지역, 종교, 기타 혐오, 악플/욕설

## 설치

```bash
pip install -r requirements.txt
```

## 실행

```bash
# inference 디렉토리에서
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## API 문서
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 엔드포인트

### 헬스 체크
```
GET /api/v1/health
```

### 단일 텍스트 분석
```
POST /api/v1/analyze
Content-Type: application/json

{
    "text": "분석할 텍스트"
}
```

응답:
```json
{
    "text": "분석할 텍스트",
    "is_negative": false,
    "label": "clean",
    "confidence": 0.95,
    "all_scores": {...}
}
```

### 배치 분석
```
POST /api/v1/analyze/batch
Content-Type: application/json

{
    "texts": ["텍스트1", "텍스트2"]
}
```

## 디렉토리 구조
```
inference/
├── app/
│   ├── __init__.py
│   ├── main.py      # FastAPI 앱
│   ├── model.py     # unSmile 모델 래퍼
│   ├── routes.py    # API 라우트
│   └── schemas.py   # Pydantic 스키마
├── requirements.txt
└── README.md
```
