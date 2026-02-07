"""
EchoForest AI Server
- Smilegate unSmile 모델 기반 부정어 분석 API
- 4인 협동 게임 저주 스택 시스템 지원
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

**4인 협동 게임 (피코파크 스타일)** 저주 스택 시스템을 위한 부정어 분석 서비스

---

### 🔮 저주 스택 시스템

| 심각도 | 라벨 | Confidence | 스택 증가량 |
|--------|------|------------|-------------|
| **1** | `critical` | 80% 이상 | **+5** 스택 |
| **2** | `severe` | 50~80% | **+3** 스택 |
| **3** | `mild` | 10~50% | **+1** 스택 |
| **0** | `clean` | 10% 미만 | 0 스택 |

---

### 📦 배치 처리 (핵심!)

게임 서버는 **5초마다** 플레이어 발화를 모아서 `/analyze/batch` API를 호출합니다.

**모든 부정어가 각각 스택에 누적됩니다!**

예시:
- "야 바보야" → +1
- "멍청이다" → +1  
- "씨발" → +5
- **total_stack_delta = 7**

---

### 📊 혐오 카테고리
여성/가족, 남성, 성소수자, 인종/국적, 연령, 지역, 종교, 기타 혐오, 악플/욕설

### ⚙️ Threshold
최적 threshold: **10.0%** (경미한 부정어 탐지 강화)
    """,
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "sentiment",
            "description": "텍스트 감정 분석 API (저주 스택 계산 포함)"
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
        "message": "🌲 EchoForest AI Server",
        "version": "2.0.0",
        "game_type": "4인 협동 게임 (피코파크 스타일)",
        "docs": "/docs",
        "health": "/api/v1/health",
        "stack_system": {
            "critical": "+5 스택",
            "severe": "+3 스택",
            "mild": "+1 스택",
            "max_stack": 10,
            "curse_trigger": "스택 10 도달 시 랜덤 1명 저주"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
