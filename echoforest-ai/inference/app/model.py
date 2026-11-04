"""
욕설 탐지 모델 래퍼
- 배포 모델: 게임 도메인 파인튜닝 모델 Full v2 KcELECTRA (FP16 압축본)
  (ai-tuning/8_Quantization/fp16_model, 학습 과정은 ai-tuning/AI_튜닝_최종_보고서.md)
- 판정: clean을 뺀 9개 라벨 점수 중 최댓값(not-clean 점수)이 임계값 0.5 이상이면 부정어
- 스택: 부정어 1건당 +1 (심각도 구간 없음)

이전 설정(kor_unsmile + 임계값 0.1 + 0.8/0.5/0.1 심각도 구간)은
AI_MODEL_PATH=smilegate-ai/kor_unsmile, AI_THRESHOLD=0.1, AI_STACK_MODE=severity 로 되돌릴 수 있습니다.
"""

import os

from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from typing import Dict, List

# 설정 (환경변수로 바꿀 수 있음)
MODEL_NAME = os.getenv("AI_MODEL_PATH", "/code/models/fp16_model")
TOKENIZER_FALLBACK = "beomi/KcELECTRA-base-v2022"  # 모델 폴더에 토크나이저가 없을 때 사용하는 베이스 토크나이저
THRESHOLD = float(os.getenv("AI_THRESHOLD", "0.5"))
STACK_MODE = os.getenv("AI_STACK_MODE", "per_detection")  # per_detection: 1건당 +1 / severity: 이전 3단계 구간

# 이전 설정(AI_STACK_MODE=severity)에서 쓰던 심각도 구간 (kor_unsmile 점수 분포 기준)
SEVERITY_THRESHOLDS = {
    1: 0.80,  # 80% 이상: 매우 심함 (최강 저주)
    2: 0.50,  # 50~80%: 심함 (강한 저주)
    3: 0.1,   # 10~50%: 경미 (약한 저주)
}

# 심각도 설명
SEVERITY_DESCRIPTIONS = {
    0: "clean",      # 정상 발화
    1: "critical",   # 매우 심함 (severity 모드)
    2: "severe",     # 심함 (severity 모드)
    3: "mild",       # 경미 (severity 모드)
    4: "negative",   # 부정어 (per_detection 모드, 구간 없음)
}

# unSmile 레이블 (혐오 카테고리)
LABELS = [
    "여성/가족",
    "남성", 
    "성소수자",
    "인종/국적",
    "연령",
    "지역",
    "종교",
    "기타 혐오",
    "악플/욕설",
    "clean"
]



class UnSmileModel:
    """욕설 탐지 모델 (unSmile 10개 라벨 형식)"""
    
    def __init__(self, model_name: str = MODEL_NAME, threshold: float = THRESHOLD):
        self.model_name = model_name
        self.threshold = threshold
        self.tokenizer = None
        self.model = None
        self.device = None
        self._loaded = False
    
    def load(self):
        """모델 로드"""
        if self._loaded:
            return
        
        print(f"📥 모델 로딩 중: {self.model_name}")
        
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        except Exception as e:
            print(f"⚠️ 모델 폴더 토크나이저 로드 실패({e}) → {TOKENIZER_FALLBACK} 사용")
            self.tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_FALLBACK)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self.model.eval()
        
        # GPU 사용 가능하면 GPU로 (FP16 그대로), CPU면 float32로 올려서 계산
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if self.device.type == "cpu":
            self.model = self.model.float()
        self.model = self.model.to(self.device)
        
        self._loaded = True
        print(f"✅ 모델 로드 완료! Device: {self.device}")
    
    def predict(self, text: str) -> Dict:
        """
        텍스트의 감정/혐오 여부 판단
        
        Args:
            text: 분석할 텍스트
            
        Returns:
            dict
        """
        if not self._loaded:
            self.load()
        
        # AI 모델 기반 분석
        
        # 토큰화
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # 추론
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()
        
        # 레이블별 점수
        all_scores = {label: float(prob) for label, prob in zip(LABELS, probs)}
        
        # clean 점수
        clean_score = all_scores.get("clean", 0)
        
        # 혐오 레이블 중 가장 높은 것 찾기 (clean 제외)
        hate_scores = {k: v for k, v in all_scores.items() if k != "clean"}
        max_hate_label = max(hate_scores, key=hate_scores.get)
        max_hate_score = hate_scores[max_hate_label]
        
        # threshold 기준으로 판단 (Confidence)
        # 중요: 신조어나 어미 변형으로 인해 점수가 낮게 나올 수 있으므로, 
        # 특정 수준 이상이면 무조건 3단계라도 주는 보정 로직을 추가할 수도 있음.
        
        is_negative = max_hate_score >= self.threshold
        
        # 심각도 단계 계산
        if not is_negative:
            severity = 0  # clean
        elif STACK_MODE != "severity":
            severity = 4  # 부정어 (구간 없이 1건당 +1)
        elif max_hate_score >= SEVERITY_THRESHOLDS[1]:
            severity = 1  # 매우 심함 (80% 이상)
        elif max_hate_score >= SEVERITY_THRESHOLDS[2]:
            severity = 2  # 심함 (50~80%)
        else:
            severity = 3  # 경미 (10~50%)
        
        severity_label = SEVERITY_DESCRIPTIONS[severity]
        
        if is_negative:
            label = max_hate_label
            confidence = max_hate_score
        else:
            label = "clean"
            confidence = clean_score
        
        return {
            'is_negative': is_negative,
            'label': label,
            'confidence': confidence,
            'severity': severity,           # 심각도 단계 (0=clean, 4=부정어 / severity 모드: 1=매우심함, 2=심함, 3=경미)
            'severity_label': severity_label,  # 심각도 라벨 (clean, negative / severity 모드: critical, severe, mild)
            'all_scores': all_scores
        }
    
    def predict_batch(self, texts: List[str]) -> List[Dict]:
        """여러 텍스트 일괄 분석"""
        return [self.predict(text) for text in texts]


# 싱글톤 모델 인스턴스
_model_instance = None

def get_model() -> UnSmileModel:
    """모델 싱글톤 인스턴스 반환"""
    global _model_instance
    if _model_instance is None:
        _model_instance = UnSmileModel()
        _model_instance.load()
    return _model_instance
