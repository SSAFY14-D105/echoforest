"""
Smilegate unSmile 모델 래퍼
- 혐오 발언 탐지 모델 (smilegate-ai/kor_unsmile)
- 최적 threshold: 17.4% (0.174)
"""

from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from typing import Dict, List

# 설정
MODEL_NAME = "smilegate-ai/kor_unsmile"
THRESHOLD = 0.174  # 17.4% - 테스트된 최적값

# 심각도 단계 threshold
SEVERITY_THRESHOLDS = {
    1: 0.80,  # 80% 이상: 매우 심함 (최강 저주)
    2: 0.50,  # 50~80%: 심함 (강한 저주)
    3: 0.174, # 17.4~50%: 경미 (약한 저주)
}

# 심각도 설명
SEVERITY_DESCRIPTIONS = {
    0: "clean",      # 정상 발화
    1: "critical",   # 매우 심함
    2: "severe",     # 심함
    3: "mild",       # 경미
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
    """unSmile 감정 분석 모델"""
    
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
        
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self.model.eval()
        
        # GPU 사용 가능하면 GPU로
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
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
        elif max_hate_score >= SEVERITY_THRESHOLDS[1]:
            severity = 1  # 매우 심함 (80% 이상)
        elif max_hate_score >= SEVERITY_THRESHOLDS[2]:
            severity = 2  # 심함 (50~80%)
        else:
            severity = 3  # 경미 (17.4~50%)
        
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
            'severity': severity,           # 심각도 단계 (0=clean, 1=매우심함, 2=심함, 3=경미)
            'severity_label': severity_label,  # 심각도 라벨 (clean, critical, severe, mild)
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
