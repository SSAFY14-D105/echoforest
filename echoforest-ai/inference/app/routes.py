"""
API 라우트 정의
"""

from fastapi import APIRouter, HTTPException
from .schemas import (
    SentimentRequest, 
    SentimentResponse,
    BatchSentimentRequest,
    BatchSentimentResponse,
    HealthResponse
)
from .model import get_model

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """서버 상태 확인"""
    try:
        model = get_model()
        return HealthResponse(
            status="healthy",
            model_loaded=model._loaded,
            device=str(model.device) if model.device else "not loaded"
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            model_loaded=False,
            device=str(e)
        )


@router.post("/analyze", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    """
    단일 텍스트 감정 분석
    
    - **text**: 분석할 텍스트
    - **returns**: 부정/긍정 판단 결과
    """
    try:
        model = get_model()
        result = model.predict(request.text)
        
        return SentimentResponse(
            text=request.text,
            is_negative=result['is_negative'],
            label=result['label'],
            confidence=result['confidence'],
            severity=result['severity'],
            severity_label=result['severity_label'],
            all_scores=result['all_scores']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/batch", response_model=BatchSentimentResponse)
async def analyze_sentiment_batch(request: BatchSentimentRequest):
    """
    배치 텍스트 감정 분석
    
    - **texts**: 분석할 텍스트 리스트
    - **returns**: 각 텍스트별 부정/긍정 판단 결과
    """
    try:
        model = get_model()
        results = []
        
        for text in request.texts:
            result = model.predict(text)
            results.append(SentimentResponse(
                text=text,
                is_negative=result['is_negative'],
                label=result['label'],
                confidence=result['confidence'],
                severity=result['severity'],
                severity_label=result['severity_label'],
                all_scores=result['all_scores']
            ))
        
        return BatchSentimentResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
