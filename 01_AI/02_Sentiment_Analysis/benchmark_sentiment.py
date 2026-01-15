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
import json
import os
from datetime import datetime

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

# 🏷️ 모델별 "부정/욕설" 라벨 매핑
# 각 모델에서 어떤 라벨이 부정(욕설)을 의미하는지 명시
MODEL_NEGATIVE_LABELS = {
    # Korean Sentiment: LABEL_0 = 부정, LABEL_1 = 긍정
    "matthewburke/korean_sentiment": ["LABEL_0"],
    
    # KoELECTRA: negative = 부정
    "monologg/koelectra-small-finetuned-sentiment": ["negative"],
    "monologg/koelectra-base-finetuned-sentiment": ["negative"],
    
    # Multilingual: 1-2 stars = 부정
    "nlptown/bert-base-multilingual-uncased-sentiment": ["1 star", "2 stars"],
    
    # UnSmile: 악플/욕설 등 = 부정
    "smilegate-ai/kor_unsmile": ["악플/욕설", "여성/가족", "남성", "성소수자", 
                                  "인종/국적", "연령", "지역", "종교", "기타 혐오", "악플"],
    
    # KcELECTRA v2: LABEL_1 = 부정 (추정, Fine-tuning 안 됨)
    "beomi/KcELECTRA-base-v2022": ["LABEL_1"],
}

# 테스트 문장들 (keywords.json에서 로드)
def load_test_sentences():
    """keywords.json에서 테스트 문장 로드"""
    try:
        with open("keywords.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        
        sentences = []
        # 긍정 문장
        for s in data.get("positive_sentences", []):
            sentences.append((s, "POSITIVE"))
        # 부정 문장
        for s in data.get("negative_sentences", []):
            sentences.append((s, "NEGATIVE"))
        # 중립 문장 (저주 X, 스킬 X)
        for s in data.get("neutral_sentences", []):
            sentences.append((s, "NEUTRAL"))
        
        pos = len(data.get("positive_sentences", []))
        neg = len(data.get("negative_sentences", []))
        neu = len(data.get("neutral_sentences", []))
        print(f"📂 keywords.json에서 {len(sentences)}개 문장 로드 완료")
        print(f"   긍정: {pos}개 | 부정: {neg}개 | 중립: {neu}개")
        return sentences
    except FileNotFoundError:
        print("⚠️ keywords.json 없음, 기본 문장 사용")
        return [
            ("사랑해", "POSITIVE"),
            ("씨발", "NEGATIVE"),
            ("일로 와", "NEUTRAL"),
        ]

TEST_SENTENCES = load_test_sentences()

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
                    # 모델별 라벨 매핑 사용
                    negative_labels = MODEL_NEGATIVE_LABELS.get(model_id, [])
                    is_negative = pred_label in negative_labels
                    
                    # 매핑에 없으면 기본 로직 사용
                    if not negative_labels:
                        pred_upper = pred_label.upper()
                        is_negative = (
                            "NEG" in pred_upper or 
                            "악플" in pred_label or
                            "욕설" in pred_label or
                            "혐오" in pred_label
                        )
                    
                    predicted = "NEGATIVE" if is_negative else "POSITIVE"
                    
                    # NEUTRAL은 POSITIVE로 취급 (욕설 탐지 목적)
                    # 욕설(NEGATIVE)인지 아닌지만 중요!
                    expected_for_compare = "POSITIVE" if expected == "NEUTRAL" else expected
                    
                    is_correct = predicted == expected_for_compare
                    if is_correct:
                        results["correct"] += 1
                    
                    emoji = "✅" if is_correct else "❌"
                    print(f"  {emoji} [{elapsed:5.1f}ms] \"{sentence}\"")
                    print(f"      예측: {pred_label} ({score:.2%}) | 정답: {expected}")
                    
                    # 욕설 확률 계산 (100% = 욕설, 0% = 칭찬으로 통일)
                    if is_negative:
                        curse_score = score  # 욕설 라벨이면 그대로
                    else:
                        curse_score = 1 - score  # 비욕설 라벨이면 반전
                    
                    results["predictions"].append({
                        "sentence": sentence,
                        "expected": expected,
                        "predicted": predicted,
                        "raw_label": pred_label,
                        "score": score,
                        "curse_score": curse_score,  # 욕설 확률 (통일)
                        "correct": is_correct,
                        "latency_ms": elapsed
                    })
        
        # 통계 계산
        results["avg_latency"] = sum(all_latencies) / len(all_latencies)
        results["accuracy"] = results["correct"] / results["total"] * 100
        
        # TP/TN/FP/FN 계산
        # NEUTRAL은 POSITIVE로 취급 (욕설 탐지 목적)
        for pred in results["predictions"]:
            expected = pred["expected"]
            # NEUTRAL → POSITIVE로 변환
            expected_for_calc = "POSITIVE" if expected == "NEUTRAL" else expected
            
            if expected_for_calc == "NEGATIVE":
                if pred["predicted"] == "NEGATIVE":
                    results["tp"] += 1  # 욕설을 욕설로 맞춤
                else:
                    results["fn"] += 1  # 욕설을 비욕설로 틀림
            else:  # expected == "POSITIVE" or "NEUTRAL"
                if pred["predicted"] == "POSITIVE":
                    results["tn"] += 1  # 비욕설을 비욕설로 맞춤
                else:
                    results["fp"] += 1  # 비욕설을 욕설로 틀림
        
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
# 💾 결과 저장 함수
# ============================================================

def save_results(all_results):
    """결과를 JSON과 Markdown 파일로 저장"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = "results/benchmark_history"
    
    # results 폴더 없으면 생성
    os.makedirs(results_dir, exist_ok=True)
    
    # 저장할 데이터 정리
    save_data = {
        "timestamp": datetime.now().isoformat(),
        "test_sentences_count": len(TEST_SENTENCES),
        "num_iterations": NUM_ITERATIONS,
        "results": []
    }
    
    for r in all_results:
        # predictions에서 직렬화 불가능한 항목 제거
        clean_result = {
            "model_name": r["model_name"],
            "model_id": r["model_id"],
            "load_time": r["load_time"],
            "avg_latency": r["avg_latency"],
            "accuracy": r["accuracy"],
            "precision": r["precision"],
            "recall": r["recall"],
            "f1_score": r["f1_score"],
            "tp": r["tp"],
            "tn": r["tn"],
            "fp": r["fp"],
            "fn": r["fn"],
            "error": r["error"],
            "predictions": r["predictions"]  # 상세 예측 결과 저장
        }
        save_data["results"].append(clean_result)
    
    # JSON 저장
    json_path = os.path.join(results_dir, f"benchmark_{timestamp}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    # 베스트 모델 찾기 (F1 Score 기준)
    successful = [r for r in all_results if not r["error"]]
    best_model = max(successful, key=lambda x: x["f1_score"]) if successful else None
    
    # Markdown 저장
    md_path = os.path.join(results_dir, f"benchmark_{timestamp}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# 📊 벤치마크 결과\n\n")
        f.write(f"- **실행 시간**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **테스트 문장 수**: {len(TEST_SENTENCES)}\n")
        f.write(f"- **반복 횟수**: {NUM_ITERATIONS}\n\n")
        
        f.write("## 결과 요약\n\n")
        f.write("| 모델 | 정확도 | Precision | Recall | F1 | 레이턴시 | 로드시간 |\n")
        f.write("|------|--------|-----------|--------|-----|----------|----------|\n")
        
        for r in all_results:
            if r["error"]:
                f.write(f"| {r['model_name']} | 에러 | - | - | - | - | - |\n")
            else:
                f.write(f"| {r['model_name']} | {r['accuracy']:.1f}% | {r['precision']:.1f}% | {r['recall']:.1f}% | {r['f1_score']:.1f}% | {r['avg_latency']:.1f}ms | {r['load_time']:.1f}s |\n")
        
        f.write("\n## Confusion Matrix\n\n")
        f.write("| 모델 | TP | TN | FP | FN |\n")
        f.write("|------|-----|-----|-----|-----|\n")
        
        for r in all_results:
            if not r["error"]:
                f.write(f"| {r['model_name']} | {r['tp']} | {r['tn']} | {r['fp']} | {r['fn']} |\n")
        
        # 베스트 모델 상세 분석
        if best_model and best_model["predictions"]:
            f.write(f"\n---\n\n## 🏆 베스트 모델 상세 분석: {best_model['model_name']}\n\n")
            f.write(f"- F1 Score: {best_model['f1_score']:.1f}%\n")
            f.write(f"- 정확도: {best_model['accuracy']:.1f}%\n\n")
            
            # 틀린 것 (FP: 비욕설을 욕설로, FN: 욕설을 비욕설로)
            f.write("### ❌ 틀린 예측\n\n")
            f.write("| 문장 | 실제 | 예측 | 신뢰도 | 유형 |\n")
            f.write("|------|------|------|--------|------|\n")
            
            for p in best_model["predictions"]:
                expected_adj = "POSITIVE" if p["expected"] == "NEUTRAL" else p["expected"]
                if not p["correct"]:
                    error_type = "FP (억울한 저주)" if expected_adj == "POSITIVE" else "FN (놓침)"
                    f.write(f"| {p['sentence']} | {p['expected']} | {p['predicted']} | {p['score']:.1%} | {error_type} |\n")
            
            # 맞춘 것 요약
            f.write("\n### ✅ 맞춘 예측 요약\n\n")
            
            # TP (욕설을 욕설로)
            tp_list = [p for p in best_model["predictions"] if p["correct"] and p["expected"] == "NEGATIVE"]
            f.write(f"#### TP (욕설 → 욕설): {len(tp_list)}개\n\n")
            if tp_list[:10]:  # 처음 10개만
                for p in tp_list[:10]:
                    f.write(f"- \"{p['sentence']}\" ({p['score']:.1%})\n")
                if len(tp_list) > 10:
                    f.write(f"- ... 외 {len(tp_list) - 10}개\n")
            
            # TN (비욕설을 비욕설로)
            tn_list = [p for p in best_model["predictions"] if p["correct"] and p["expected"] in ["POSITIVE", "NEUTRAL"]]
            f.write(f"\n#### TN (비욕설 → 비욕설): {len(tn_list)}개\n\n")
            if tn_list[:10]:  # 처음 10개만
                for p in tn_list[:10]:
                    f.write(f"- \"{p['sentence']}\" ({p['score']:.1%})\n")
                if len(tn_list) > 10:
                    f.write(f"- ... 외 {len(tn_list) - 10}개\n")
    
    # 모든 모델 상세 예측 결과 저장 (별도 파일)
    detail_path = os.path.join(results_dir, f"predictions_detail_{timestamp}.md")
    with open(detail_path, "w", encoding="utf-8") as f:
        f.write("# 📋 모든 모델 상세 예측 결과\n\n")
        f.write(f"- 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- 테스트 문장 수: {len(TEST_SENTENCES)}\n\n")
        
        for r in all_results:
            if r["error"]:
                continue
            
            f.write(f"---\n\n## 🧪 {r['model_name']}\n\n")
            f.write(f"- 정확도: {r['accuracy']:.1f}%\n")
            f.write(f"- F1: {r['f1_score']:.1f}%\n")
            f.write(f"- TP: {r['tp']} | TN: {r['tn']} | FP: {r['fp']} | FN: {r['fn']}\n\n")
            
            f.write("### 전체 예측 결과\n\n")
            f.write("| 결과 | 문장 | 실제 | 욕설확률 | 모델판단 | 원본라벨 |\n")
            f.write("|------|------|------|----------|----------|----------|\n")
            
            for p in r["predictions"]:
                emoji = "✅" if p["correct"] else "❌"
                
                # 실제 라벨을 한국어로 통일
                actual_kr = "욕설" if p["expected"] == "NEGATIVE" else ("중립" if p["expected"] == "NEUTRAL" else "칭찬")
                
                # 예측 라벨을 한국어로 통일 (욕설/비욕설)
                predicted_kr = "🔴욕설" if p["predicted"] == "NEGATIVE" else "🟢비욕설"
                
                # 욕설 확률 (100% = 욕설, 0% = 칭찬)
                curse_pct = p.get("curse_score", p["score"]) * 100
                
                f.write(f"| {emoji} | {p['sentence'][:25]}{'...' if len(p['sentence']) > 25 else ''} | {actual_kr} | **{curse_pct:.1f}%** | {predicted_kr} | {p['raw_label']} |\n")
            
            f.write("\n")
    
    print(f"\n💾 결과 저장 완료:")
    print(f"   📄 JSON: {json_path}")
    print(f"   📝 Markdown: {md_path}")
    print(f"   📋 상세 예측: {detail_path}")

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
    
    # 결과 자동 저장
    save_results(all_results)
    
    print("\n✅ 벤치마크 완료!")

