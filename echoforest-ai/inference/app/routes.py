"""
API 라우트 정의
- 4인 협동 게임 저주 스택 시스템 지원
"""

from fastapi import APIRouter, HTTPException
from .schemas import (
    SentimentRequest, 
    SentimentResponse,
    BatchSentimentRequest,
    BatchSentimentResponse,
    HealthResponse,
    STACK_DELTA_MAP
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
    - **returns**: 부정/긍정 판단 결과 + 스택 증가량
    """
    try:
        model = get_model()
        result = model.predict(request.text)
        
        # 심각도에 따른 스택 증가량 계산
        stack_delta = STACK_DELTA_MAP.get(result['severity'], 0)
        
        return SentimentResponse(
            text=request.text,
            is_negative=result['is_negative'],
            label=result['label'],
            confidence=result['confidence'],
            severity=result['severity'],
            severity_label=result['severity_label'],
            stack_delta=stack_delta,
            all_scores=result['all_scores']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/batch", response_model=BatchSentimentResponse)
async def analyze_sentiment_batch(request: BatchSentimentRequest):
    """
    배치 텍스트 감정 분석 (4인 협동 게임 저주 스택용)
    
    - **texts**: 분석할 텍스트 리스트
    - **returns**: 각 텍스트별 판단 결과 + 총 스택 증가량
    
    게임 서버는 응답의 `total_stack_delta` 값을 팀 저주 스택에 더하면 됩니다.
    
    예시:
    - "바보야" → severity 3 (mild) → +1 스택
    - "멍청이다" → severity 3 (mild) → +1 스택  
    - "씨발" → severity 1 (critical) → +5 스택
    - **total_stack_delta = 7**
    """
    try:
        model = get_model()
        results = []
        total_stack_delta = 0
        negative_count = 0
        
        for text in request.texts:
            result = model.predict(text)
            
            # 심각도에 따른 스택 증가량 계산
            stack_delta = STACK_DELTA_MAP.get(result['severity'], 0)
            total_stack_delta += stack_delta
            
            if result['is_negative']:
                negative_count += 1
            
            results.append(SentimentResponse(
                text=text,
                is_negative=result['is_negative'],
                label=result['label'],
                confidence=result['confidence'],
                severity=result['severity'],
                severity_label=result['severity_label'],
                stack_delta=stack_delta,
                all_scores=result['all_scores']
            ))
        
        return BatchSentimentResponse(
            results=results,
            total_count=len(request.texts),
            negative_count=negative_count,
            total_stack_delta=total_stack_delta
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
