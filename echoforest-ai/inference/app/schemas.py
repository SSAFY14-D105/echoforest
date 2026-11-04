"""
API 요청/응답 스키마 정의
- 4인 협동 게임 저주 스택 시스템용
"""

from pydantic import BaseModel
from typing import Dict, List, Optional


# 심각도별 스택 증가량
# 배포 설정(튜닝 모델): 부정어 1건당 +1 (severity 4)
# 튜닝 모델은 욕설 점수가 0.8 이상에 몰려 있어, 이전 구간(+5/+3/+1)을 쓰면 거의 다 +5가 되고
# 스택 상한(5)이라 한 문장 만에 저주가 걸리기 때문
STACK_DELTA_MAP = {
    0: 0,   # clean: 스택 증가 없음
    1: 5,   # critical (80%+): +5 스택   ← AI_STACK_MODE=severity 일 때만
    2: 3,   # severe (50~80%): +3 스택   ← AI_STACK_MODE=severity 일 때만
    3: 1,   # mild (10~50%): +1 스택     ← AI_STACK_MODE=severity 일 때만
    4: 1,   # negative: +1 스택 (배포 기본값)
}


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
    severity: int  # 심각도 단계 (0=clean, 4=부정어 / severity 모드: 1=매우심함, 2=심함, 3=경미)
    severity_label: str  # 심각도 라벨 (clean, negative / severity 모드: critical, severe, mild)
    stack_delta: int = 0  # 이 발화로 인한 스택 증가량 (배포 기본값: 부정어 1건당 1)
    all_scores: Optional[Dict[str, float]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "씨발",
                "is_negative": True,
                "label": "악플/욕설",
                "confidence": 0.84,
                "severity": 4,
                "severity_label": "negative",
                "stack_delta": 1,
                "all_scores": {"clean": 0.06, "악플/욕설": 0.84}
            }
        }


class BatchSentimentRequest(BaseModel):
    """배치 감정 분석 요청"""
    texts: List[str]


class BatchSentimentResponse(BaseModel):
    """
    배치 감정 분석 응답 (4인 협동 게임 저주 스택용)
    
    게임 서버는 total_stack_delta 값을 팀 저주 스택에 더하면 됩니다.
    예: "야 바보야"(+1) + "너 멍청이다"(+1) + "씨발"(+1) = total_stack_delta: 3
    """
    results: List[SentimentResponse]
    total_count: int  # 총 분석된 텍스트 수
    negative_count: int  # 부정어로 판정된 텍스트 수
    total_stack_delta: int  # 이 배치로 인한 총 스택 증가량 (모든 부정어 누적!)
    
    class Config:
        json_schema_extra = {
            "example": {
                "results": [
                    {"text": "야 바보야", "is_negative": True, "severity": 4, "severity_label": "negative", "stack_delta": 1, "confidence": 0.856, "label": "악플/욕설"},
                    {"text": "너 멍청이다", "is_negative": True, "severity": 4, "severity_label": "negative", "stack_delta": 1, "confidence": 0.868, "label": "악플/욕설"},
                    {"text": "씨발", "is_negative": True, "severity": 4, "severity_label": "negative", "stack_delta": 1, "confidence": 0.840, "label": "악플/욕설"}
                ],
                "total_count": 3,
                "negative_count": 3,
                "total_stack_delta": 3
            }
        }


class HealthResponse(BaseModel):
    """헬스 체크 응답"""
    status: str
    model_loaded: bool
    device: str
