"""
EchoForest AI Server
- Smilegate unSmile 모델 기반 감정 분석 API
- 혐오 발언 탐지 (threshold: 17.4%)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .routes import router
from .model import get_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 모델 로드"""
    print("🚀 서버 시작 중...")
    print("📥 unSmile 모델 사전 로드 중...")
    get_model()  # 모델 미리 로드
    print("✅ 서버 준비 완료!")
    yield
    print("👋 서버 종료")


app = FastAPI(
    title="EchoForest AI Server",
    description="""
## 🎮 EchoForest 감정 분석 API

Smilegate unSmile 모델을 사용한 **혐오 발언 탐지 서비스**

---

### 🎚️ 심각도 단계 (Severity Level)

| severity | label | Confidence | 게임 패널티 |
|----------|-------|------------|-------------|
| **1** | `critical` | 80% 이상 | 🔴 최강 저주 |
| **2** | `severe` | 50~80% | 🟠 강한 저주 |
| **3** | `mild` | 17.4~50% | 🟡 약한 저주 |
| **0** | `clean` | 17.4% 미만 | ✅ 정상 |

---

### 📊 혐오 카테고리
여성/가족, 남성, 성소수자, 인종/국적, 연령, 지역, 종교, 기타 혐오, 악플/욕설

### ⚙️ Threshold
최적 threshold: **17.4%**
    """,
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "sentiment",
            "description": "텍스트 감정 분석 API"
        }
    ]
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(router, prefix="/api/v1", tags=["sentiment"])


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "EchoForest AI Server",
        "docs": "/docs",
        "health": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
