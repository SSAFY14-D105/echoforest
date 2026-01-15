"""
🎭 감정 분석 모델 벤치마크 스크립트
- 여러 모델 순차 테스트
- 반복 측정으로 정확한 레이턴시 측정
- 결과 요약 테이블 출력

사용법: python benchmark_sentiment.py
"""

from transformers import pipeline
import time
import gc
import torch

# ============================================================
# 📋 설정
# ============================================================

# 테스트할 모델들 (이름, Hugging Face 모델 ID)
# 💡 감정 분류(sentiment-analysis)에 적합한 모델만 포함
MODELS_TO_TEST = [
    # ===== 감정 분류 (Sentiment Analysis) =====
    ("Korean Sentiment (matthewburke)", "matthewburke/korean_sentiment"),
    ("KoELECTRA Small Sentiment", "monologg/koelectra-small-finetuned-sentiment"),
    ("KoELECTRA Base Sentiment", "monologg/koelectra-base-finetuned-sentiment"),
    
    # 다국어/영어 기반 (한국어 테스트용)
    ("XLM-RoBERTa Sentiment", "cardiffnlp/twitter-xlm-roberta-base-sentiment"),
    ("Multilingual Sentiment", "nlptown/bert-base-multilingual-uncased-sentiment"),
    
    # ===== 혐오 발언 탐지 (Hate Speech Detection) ===== ⭐ NEW!
    ("UnSmile (Smilegate)", "smilegate-ai/kor_unsmile"),
    # ("KcELECTRA Hate", "beomi/KcELECTRA-base-v2022-hate"),  # 추가 테스트용
    
    # 참고: 아래는 감정분류 fine-tuning 안 된 base 모델이라 제외
    # ("DistilKoBERT", "monologg/distilkobert"),
    # ("KcBERT", "beomi/kcbert-base"),
    # ("KLUE RoBERTa", "klue/roberta-base"),
]

# 테스트 문장들
TEST_SENTENCES = [
    # 부정적 (명시적)
    ("야 진짜 뭐하냐", "NEGATIVE"),
    ("아 ㅅㅂ", "NEGATIVE"),
    ("하... 진짜 못하네", "NEGATIVE"),
    
    # 부정적 (비꼼/냉소)
    ("야 진짜 잘하네~", "NEGATIVE"),  # 비꼼
    ("와 대단하다 진짜", "NEGATIVE"),  # 냉소
    
    # 긍정적
    ("사랑해", "POSITIVE"),
    ("뽀뽀 쪽", "POSITIVE"),
    ("잘했어!", "POSITIVE"),
    ("고마워", "POSITIVE"),
    ("최고야", "POSITIVE"),
]

# 반복 측정 횟수 (정확한 레이턴시 측정용)
NUM_ITERATIONS = 3

# ============================================================
# 🧪 테스트 함수
# ============================================================

def test_single_model(model_name, model_id):
    """단일 모델 테스트 후 결과 반환"""
    results = {
        "model_name": model_name,
        "model_id": model_id,
        "load_time": 0,
        "avg_latency": 0,
        "accuracy": 0,
        "correct": 0,
        "total": len(TEST_SENTENCES),
        "predictions": [],
        "error": None
    }
    
    print(f"\n{'='*60}")
    print(f"🧪 테스트: {model_name}")
    print(f"   모델: {model_id}")
    print(f"{'='*60}")
    
    try:
        # 모델 로드
        print("📥 모델 로딩 중...")
        start_load = time.time()
        classifier = pipeline("sentiment-analysis", model=model_id)
        results["load_time"] = time.time() - start_load
        print(f"✅ 로드 완료! ({results['load_time']:.2f}초)")
        
        # 워밍업 (첫 추론은 느릴 수 있음)
        print("🔥 워밍업...")
        classifier("테스트")
        
        # 반복 측정
        all_latencies = []
        
        for iteration in range(NUM_ITERATIONS):
            print(f"\n📊 반복 {iteration + 1}/{NUM_ITERATIONS}")
            
            for sentence, expected in TEST_SENTENCES:
                start = time.time()
                result = classifier(sentence)
                elapsed = (time.time() - start) * 1000  # ms
                all_latencies.append(elapsed)
                
                pred_label = result[0]['label']
                score = result[0]['score']
                
                # 정확도 계산 (마지막 반복에서만)
                if iteration == NUM_ITERATIONS - 1:
                    # POSITIVE/NEGATIVE 또는 LABEL_0/LABEL_1 등 다양한 형식 처리
                    is_negative = "NEG" in pred_label.upper() or pred_label == "LABEL_1"
                    predicted = "NEGATIVE" if is_negative else "POSITIVE"
                    
                    is_correct = predicted == expected
                    if is_correct:
                        results["correct"] += 1
                    
                    emoji = "✅" if is_correct else "❌"
                    print(f"  {emoji} [{elapsed:5.1f}ms] \"{sentence}\"")
                    print(f"      예측: {pred_label} ({score:.2%}) | 정답: {expected}")
                    
                    results["predictions"].append({
                        "sentence": sentence,
                        "expected": expected,
                        "predicted": predicted,
                        "raw_label": pred_label,
                        "score": score,
                        "correct": is_correct,
                        "latency_ms": elapsed
                    })
        
        # 통계 계산
        results["avg_latency"] = sum(all_latencies) / len(all_latencies)
        results["accuracy"] = results["correct"] / results["total"] * 100
        
        print(f"\n📈 결과 요약:")
        print(f"   정확도: {results['accuracy']:.1f}% ({results['correct']}/{results['total']})")
        print(f"   평균 레이턴시: {results['avg_latency']:.1f}ms")
        
    except Exception as e:
        results["error"] = str(e)
        print(f"❌ 에러 발생: {e}")
    
    finally:
        # 메모리 해제
        print("🧹 메모리 정리 중...")
        if 'classifier' in locals():
            del classifier
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    return results

def print_summary(all_results):
    """모든 결과 요약 테이블 출력"""
    print("\n")
    print("=" * 80)
    print("📊 전체 결과 요약")
    print("=" * 80)
    
    # 헤더
    print(f"{'모델명':<30} {'정확도':>10} {'레이턴시':>12} {'로드시간':>10} {'상태':>8}")
    print("-" * 80)
    
    # 각 모델 결과
    for r in all_results:
        if r["error"]:
            status = "❌ 에러"
            print(f"{r['model_name']:<30} {'-':>10} {'-':>12} {'-':>10} {status:>8}")
        else:
            status = "✅ 성공"
            print(f"{r['model_name']:<30} {r['accuracy']:>9.1f}% {r['avg_latency']:>10.1f}ms {r['load_time']:>9.1f}s {status:>8}")
    
    print("-" * 80)
    
    # 최고 성능 모델 찾기
    successful = [r for r in all_results if not r["error"]]
    if successful:
        best_accuracy = max(successful, key=lambda x: x["accuracy"])
        best_latency = min(successful, key=lambda x: x["avg_latency"])
        
        print(f"\n🏆 최고 정확도: {best_accuracy['model_name']} ({best_accuracy['accuracy']:.1f}%)")
        print(f"⚡ 최저 레이턴시: {best_latency['model_name']} ({best_latency['avg_latency']:.1f}ms)")

# ============================================================
# 🚀 메인 실행
# ============================================================

if __name__ == "__main__":
    print("🎭 감정 분석 모델 벤치마크 시작!")
    print(f"📋 테스트 모델 수: {len(MODELS_TO_TEST)}")
    print(f"📝 테스트 문장 수: {len(TEST_SENTENCES)}")
    print(f"🔄 반복 횟수: {NUM_ITERATIONS}")
    print("=" * 60)
    
    all_results = []
    
    for model_name, model_id in MODELS_TO_TEST:
        result = test_single_model(model_name, model_id)
        all_results.append(result)
    
    # 전체 요약 출력
    print_summary(all_results)
    
    print("\n✅ 벤치마크 완료!")
