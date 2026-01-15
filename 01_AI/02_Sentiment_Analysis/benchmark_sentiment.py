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
    
    # 다국어 (한국어 테스트용)
    ("Multilingual Sentiment", "nlptown/bert-base-multilingual-uncased-sentiment"),
    
    # ===== 혐오 발언 탐지 (Hate Speech Detection) =====
    ("UnSmile (Smilegate)", "smilegate-ai/kor_unsmile"),
    
    # ===== 🆕 최신 모델 =====
    ("KcELECTRA v2 (댓글특화)", "beomi/KcELECTRA-base-v2022"),
    
    # 제외: XLM-RoBERTa (에러 발생)
    # ("XLM-RoBERTa Sentiment", "cardiffnlp/twitter-xlm-roberta-base-sentiment"),
]

# 테스트 문장들 (음성 STT 출력 스타일)
# ⚠️ 초성체(ㅅㅂ, ㄹㅇ 등)는 STT에서 나오지 않으므로 제외!
TEST_SENTENCES = [
    # ===== 부정적 (명시적 욕설) =====
    ("야 씨발 뭐하냐", "NEGATIVE"),
    ("아 개짜증나", "NEGATIVE"),
    ("진짜 못하네", "NEGATIVE"),
    ("그것도 못해?", "NEGATIVE"),
    ("아 씨발", "NEGATIVE"),
    
    # ===== 부정적 (비꼼/냉소) =====
    ("와 진짜 잘하네", "NEGATIVE"),  # 비꼼
    ("대단하다 진짜", "NEGATIVE"),   # 냉소
    ("오 잘한다 잘해", "NEGATIVE"),  # 비꼼
    
    # ===== 부정적 (짜증/불만) =====
    ("야 왜 그래", "NEGATIVE"),
    ("하 답답해", "NEGATIVE"),
    
    # ===== 긍정적 (스킬용 키워드) =====
    ("사랑해", "POSITIVE"),
    ("뽀뽀", "POSITIVE"),
    ("쪽쪽", "POSITIVE"),
    ("최고야", "POSITIVE"),
    
    # ===== 긍정적 (칭찬/격려) =====
    ("잘했어", "POSITIVE"),
    ("고마워", "POSITIVE"),
    ("멋있어", "POSITIVE"),
    ("대박이야", "POSITIVE"),
    
    # ===== 긍정적 (감탄) =====
    ("와 잘한다", "POSITIVE"),  # 진심 칭찬
    ("오 대단해", "POSITIVE"),
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
        "error": None,
        # TP/TN/FP/FN 추가
        "tp": 0,  # True Positive: 부정을 부정으로 맞춤
        "tn": 0,  # True Negative: 긍정을 긍정으로 맞춤
        "fp": 0,  # False Positive: 긍정을 부정으로 틀림
        "fn": 0,  # False Negative: 부정을 긍정으로 틀림
        "precision": 0,
        "recall": 0,
        "f1_score": 0
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
        
        # TP/TN/FP/FN 계산
        for pred in results["predictions"]:
            if pred["expected"] == "NEGATIVE":
                if pred["predicted"] == "NEGATIVE":
                    results["tp"] += 1  # 부정을 부정으로 맞춤
                else:
                    results["fn"] += 1  # 부정을 긍정으로 틀림
            else:  # expected == "POSITIVE"
                if pred["predicted"] == "POSITIVE":
                    results["tn"] += 1  # 긍정을 긍정으로 맞춤
                else:
                    results["fp"] += 1  # 긍정을 부정으로 틀림
        
        # Precision, Recall, F1 계산
        tp, fp, fn = results["tp"], results["fp"], results["fn"]
        if tp + fp > 0:
            results["precision"] = tp / (tp + fp) * 100
        if tp + fn > 0:
            results["recall"] = tp / (tp + fn) * 100
        if results["precision"] + results["recall"] > 0:
            results["f1_score"] = 2 * (results["precision"] * results["recall"]) / (results["precision"] + results["recall"])
        
        print(f"\n📈 결과 요약:")
        print(f"   정확도: {results['accuracy']:.1f}% ({results['correct']}/{results['total']})")
        print(f"   평균 레이턴시: {results['avg_latency']:.1f}ms")
        print(f"   TP={results['tp']} TN={results['tn']} FP={results['fp']} FN={results['fn']}")
        print(f"   Precision: {results['precision']:.1f}% | Recall: {results['recall']:.1f}% | F1: {results['f1_score']:.1f}%")
        
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
    print("=" * 120)
    print("📊 전체 결과 요약")
    print("=" * 120)
    
    # 헤더
    print(f"{'모델명':<25} {'정확도':>8} {'Precision':>10} {'Recall':>8} {'F1':>8} {'레이턴시':>10} {'로드시간':>8} {'상태':>6}")
    print("-" * 120)
    
    # 각 모델 결과
    for r in all_results:
        if r["error"]:
            status = "❌"
            print(f"{r['model_name']:<25} {'-':>8} {'-':>10} {'-':>8} {'-':>8} {'-':>10} {'-':>8} {status:>6}")
        else:
            status = "✅"
            print(f"{r['model_name']:<25} {r['accuracy']:>7.1f}% {r['precision']:>9.1f}% {r['recall']:>7.1f}% {r['f1_score']:>7.1f}% {r['avg_latency']:>8.1f}ms {r['load_time']:>7.1f}s {status:>6}")
    
    print("-" * 120)
    
    # TP/TN/FP/FN 상세
    print("\n📋 Confusion Matrix 상세:")
    print(f"{'모델명':<25} {'TP':>6} {'TN':>6} {'FP':>6} {'FN':>6}")
    print("-" * 60)
    for r in all_results:
        if not r["error"]:
            print(f"{r['model_name']:<25} {r['tp']:>6} {r['tn']:>6} {r['fp']:>6} {r['fn']:>6}")
    
    print("-" * 60)
    
    # 최고 성능 모델 찾기
    successful = [r for r in all_results if not r["error"]]
    if successful:
        best_accuracy = max(successful, key=lambda x: x["accuracy"])
        best_f1 = max(successful, key=lambda x: x["f1_score"])
        best_latency = min(successful, key=lambda x: x["avg_latency"])
        
        print(f"\n🏆 최고 정확도: {best_accuracy['model_name']} ({best_accuracy['accuracy']:.1f}%)")
        print(f"🎯 최고 F1 Score: {best_f1['model_name']} ({best_f1['f1_score']:.1f}%)")
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
