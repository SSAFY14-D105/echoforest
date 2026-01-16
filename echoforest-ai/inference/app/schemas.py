"""
API 요청/응답 스키마 정의
"""

from pydantic import BaseModel
from typing import Dict, List, Optional


class SentimentRequest(BaseModel):
    """감정 분석 요청"""
    text: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "안녕하세요"
            }
        }


class SentimentResponse(BaseModel):
    """감정 분석 응답"""
    text: str
    is_negative: bool
    label: str
    confidence: float
    severity: int  # 심각도 단계 (0=clean, 1=매우심함, 2=심함, 3=경미)
    severity_label: str  # 심각도 라벨 (clean, critical, severe, mild)
    all_scores: Optional[Dict[str, float]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "씨발",
                "is_negative": True,
                "label": "악플/욕설",
                "confidence": 0.92,
                "severity": 1,
                "severity_label": "critical",
                "all_scores": {"clean": 0.05, "악플/욕설": 0.92}
            }
        }


class BatchSentimentRequest(BaseModel):
    """배치 감정 분석 요청"""
    texts: List[str]


class BatchSentimentResponse(BaseModel):
    """배치 감정 분석 응답"""
    results: List[SentimentResponse]


class HealthResponse(BaseModel):
    """헬스 체크 응답"""
    status: str
    model_loaded: bool
    device: str
