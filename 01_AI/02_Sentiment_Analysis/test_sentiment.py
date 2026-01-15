"""
감정 분석 모델 테스트 스크립트
사용법: python test_sentiment.py
"""

from transformers import pipeline
import time

# 🏷️ 모델별 "부정/욕설" 라벨 매핑
MODEL_NEGATIVE_LABELS = {
    "matthewburke/korean_sentiment": ["LABEL_0"],  # LABEL_0 = 부정!
    "monologg/koelectra-small-finetuned-sentiment": ["negative"],
    "monologg/koelectra-base-finetuned-sentiment": ["negative"],
    "nlptown/bert-base-multilingual-uncased-sentiment": ["1 star", "2 stars"],
    "smilegate-ai/kor_unsmile": ["악플/욕설", "여성/가족", "남성", "성소수자", 
                                  "인종/국적", "연령", "지역", "종교", "기타 혐오", "악플"],
    "beomi/KcELECTRA-base-v2022": ["LABEL_1"],
}

# 테스트할 문장들
test_sentences = [
    # 부정적 (욕설/비꼼)
    "야 진짜 뭐하냐",
    "아 ㅅㅂ",
    "하... 진짜 못하네",
    "야 진짜 잘하네~",  # 비꼼
    
    # 긍정적
    "사랑해",
    "뽀뽀 쪽",
    "잘했어!",
    "고마워",
]

def test_model(model_name, display_name):
    print(f"\n{'='*60}")
    print(f"🧪 테스트: {display_name}")
    print(f"   모델: {model_name}")
    print(f"{'='*60}")
    
    try:
        # 모델 로드 (첫 실행시 다운로드)
        print("📥 모델 로딩 중...")
        start_load = time.time()
        classifier = pipeline("sentiment-analysis", model=model_name)
        load_time = time.time() - start_load
        print(f"✅ 로드 완료! ({load_time:.2f}초)")
        
        # 추론 테스트
        print("\n📊 추론 결과:")
        total_time = 0
        
        # 모델별 부정 라벨 가져오기
        negative_labels = MODEL_NEGATIVE_LABELS.get(model_name, [])
        
        for sentence in test_sentences:
            start = time.time()
            result = classifier(sentence)
            elapsed = (time.time() - start) * 1000  # ms
            total_time += elapsed
            
            label = result[0]['label']
            score = result[0]['score']
            
            # 모델별 라벨 매핑으로 판단
            is_negative = label in negative_labels
            if not negative_labels:  # 매핑 없으면 기본 로직
                is_negative = "NEG" in label.upper() or "악플" in label or "욕설" in label
            
            emoji = "🔴" if is_negative else "🟢"
            print(f"  {emoji} [{elapsed:6.1f}ms] \"{sentence}\"")
            print(f"      → {label} ({score:.2%})")
        
        avg_time = total_time / len(test_sentences)
        print(f"\n⏱️ 평균 레이턴시: {avg_time:.1f}ms")
        
    except Exception as e:
        print(f"❌ 에러 발생: {e}")

if __name__ == "__main__":
    print("🎭 감정 분석 모델 테스트 시작!")
    print("=" * 60)
    
    # 테스트할 모델 (한국어 감정 분류)
    # 원하는 모델로 변경 가능
    test_model(
        model_name="matthewburke/korean_sentiment",
        display_name="Korean Sentiment (matthewburke)"
    )
    
    print("\n✅ 테스트 완료!")
