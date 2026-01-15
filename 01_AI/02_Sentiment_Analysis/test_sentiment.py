"""
감정 분석 모델 테스트 스크립트
사용법: python test_sentiment.py
"""

from transformers import pipeline
import time

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
        
        for sentence in test_sentences:
            start = time.time()
            result = classifier(sentence)
            elapsed = (time.time() - start) * 1000  # ms
            total_time += elapsed
            
            label = result[0]['label']
            score = result[0]['score']
            
            # 이모지로 결과 표시
            emoji = "🔴" if "NEG" in label.upper() else "🟢"
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
