"""
🎯 Threshold Tuning 스크립트
- 각 모델별 최적 threshold 찾기
- 10% 단위로 먼저 탐색 후 1% 단위로 미세 조정

사용법: python find_optimal_threshold.py
"""

from transformers import pipeline
import json
import os
from datetime import datetime
import gc
import torch

# ============================================================
# 📋 설정
# ============================================================

MODELS_TO_TEST = [
    ("Korean Sentiment", "matthewburke/korean_sentiment"),
    ("KoELECTRA Small", "monologg/koelectra-small-finetuned-sentiment"),
    ("KoELECTRA Base", "monologg/koelectra-base-finetuned-sentiment"),
    ("Multilingual", "nlptown/bert-base-multilingual-uncased-sentiment"),
    ("UnSmile", "smilegate-ai/kor_unsmile"),
    ("KcELECTRA v2", "beomi/KcELECTRA-base-v2022"),
]

# Threshold 범위 (1% 단위: 1%~100%)
THRESHOLDS = [i/100 for i in range(1, 101)]  # 0.01, 0.02, ... 1.00

def load_test_sentences():
    """keywords.json에서 테스트 문장 로드"""
    try:
        with open("keywords.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        
        sentences = []
        for s in data.get("positive_sentences", []):
            sentences.append((s, "POSITIVE"))
        for s in data.get("negative_sentences", []):
            sentences.append((s, "NEGATIVE"))
        for s in data.get("neutral_sentences", []):
            sentences.append((s, "NEUTRAL"))
        
        print(f"📂 {len(sentences)}개 문장 로드 완료")
        return sentences
    except FileNotFoundError:
        print("⚠️ keywords.json 없음")
        return []

def get_negative_score(result, pred_label):
    """모델 출력에서 NEGATIVE 확률 추출"""
    score = result[0]['score']
    
    # 라벨에 따라 점수 해석
    # NEGATIVE 계열 라벨이면 score 그대로, 아니면 반전
    pred_upper = pred_label.upper()
    is_negative_label = (
        "NEG" in pred_upper or 
        pred_label == "LABEL_1" or
        "악플" in pred_label or
        "욕설" in pred_label or
        "혐오" in pred_label or
        pred_label in ["1 star", "2 stars"]
    )
    
    if is_negative_label:
        return score  # NEGATIVE 확률
    else:
        return 1 - score  # POSITIVE였으면 반전

def calculate_metrics(predictions, threshold):
    """주어진 threshold로 TP/TN/FP/FN 및 F1 계산"""
    tp, tn, fp, fn = 0, 0, 0, 0
    
    for p in predictions:
        # threshold 기준으로 판단
        predicted = "NEGATIVE" if p["neg_score"] >= threshold else "POSITIVE"
        
        expected = p["expected"]
        expected_adj = "POSITIVE" if expected == "NEUTRAL" else expected
        
        if expected_adj == "NEGATIVE":
            if predicted == "NEGATIVE":
                tp += 1
            else:
                fn += 1
        else:
            if predicted == "POSITIVE":
                tn += 1
            else:
                fp += 1
    
    # F1 Score 계산
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0
    
    return {
        "threshold": threshold,
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "precision": precision * 100,
        "recall": recall * 100,
        "f1": f1 * 100,
        "accuracy": accuracy * 100
    }

def test_model_thresholds(model_name, model_id, sentences, thresholds):
    """한 모델에 대해 여러 threshold 테스트"""
    print(f"\n{'='*60}")
    print(f"🧪 테스트: {model_name}")
    print(f"{'='*60}")
    
    try:
        # 모델 로드
        print("📥 모델 로딩...")
        classifier = pipeline("sentiment-analysis", model=model_id)
        print("✅ 로드 완료!")
        
        # 모든 문장에 대해 예측 수집
        predictions = []
        print("🔄 예측 수집 중...")
        
        for sentence, expected in sentences:
            result = classifier(sentence)
            pred_label = result[0]['label']
            neg_score = get_negative_score(result, pred_label)
            
            predictions.append({
                "sentence": sentence,
                "expected": expected,
                "neg_score": neg_score,
                "raw_label": pred_label,
                "raw_score": result[0]['score']
            })
        
        print(f"✅ {len(predictions)}개 예측 완료!")
        
        # 각 threshold별 성능 계산
        results = []
        print("\n📊 Threshold별 성능:")
        print(f"{'Threshold':<12} {'F1':>8} {'Precision':>10} {'Recall':>8} {'Accuracy':>10}")
        print("-" * 55)
        
        best_f1 = 0
        best_threshold = 0.5
        
        for threshold in thresholds:
            metrics = calculate_metrics(predictions, threshold)
            results.append(metrics)
            
            print(f"{threshold:<12.0%} {metrics['f1']:>7.1f}% {metrics['precision']:>9.1f}% {metrics['recall']:>7.1f}% {metrics['accuracy']:>9.1f}%")
            
            if metrics['f1'] > best_f1:
                best_f1 = metrics['f1']
                best_threshold = threshold
        
        print("-" * 55)
        print(f"🏆 최적 Threshold: {best_threshold:.0%} (F1: {best_f1:.1f}%)")
        
        return {
            "model_name": model_name,
            "model_id": model_id,
            "best_threshold": best_threshold,
            "best_f1": best_f1,
            "all_results": results,
            "predictions": predictions,
            "error": None
        }
        
    except Exception as e:
        print(f"❌ 에러: {e}")
        return {
            "model_name": model_name,
            "model_id": model_id,
            "error": str(e)
        }
    finally:
        if 'classifier' in locals():
            del classifier
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

def save_results(all_results):
    """결과 저장"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = "results/threshold_tuning"
    os.makedirs(results_dir, exist_ok=True)
    
    # JSON 저장
    json_path = os.path.join(results_dir, f"threshold_{timestamp}.json")
    save_data = {
        "timestamp": datetime.now().isoformat(),
        "results": []
    }
    
    for r in all_results:
        if r.get("error"):
            save_data["results"].append({"model": r["model_name"], "error": r["error"]})
        else:
            save_data["results"].append({
                "model": r["model_name"],
                "best_threshold": r["best_threshold"],
                "best_f1": r["best_f1"],
                "all_results": r["all_results"]
            })
    
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    # Markdown 저장
    md_path = os.path.join(results_dir, f"threshold_{timestamp}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# 🎯 Threshold Tuning 결과\n\n")
        f.write(f"- 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## 📊 모델별 최적 Threshold\n\n")
        f.write("| 모델 | 최적 Threshold | F1 Score |\n")
        f.write("|------|----------------|----------|\n")
        
        for r in all_results:
            if r.get("error"):
                f.write(f"| {r['model_name']} | 에러 | - |\n")
            else:
                f.write(f"| {r['model_name']} | {r['best_threshold']:.0%} | {r['best_f1']:.1f}% |\n")
        
        f.write("\n## 📈 상세 결과\n\n")
        
        for r in all_results:
            if r.get("error"):
                continue
            
            f.write(f"### {r['model_name']}\n\n")
            f.write("| Threshold | F1 | Precision | Recall | Accuracy |\n")
            f.write("|-----------|-----|-----------|--------|----------|\n")
            
            for m in r["all_results"]:
                marker = "🏆" if m["threshold"] == r["best_threshold"] else ""
                f.write(f"| {m['threshold']:.0%} {marker} | {m['f1']:.1f}% | {m['precision']:.1f}% | {m['recall']:.1f}% | {m['accuracy']:.1f}% |\n")
            
            f.write("\n")
    
    print(f"\n💾 결과 저장 완료:")
    print(f"   📄 JSON: {json_path}")
    print(f"   📝 Markdown: {md_path}")

# ============================================================
# 🚀 메인 실행
# ============================================================

if __name__ == "__main__":
    print("🎯 Threshold Tuning 시작!")
    print(f"📋 테스트 모델 수: {len(MODELS_TO_TEST)}")
    print(f"📊 테스트 Threshold: {len(THRESHOLDS)}개 (30%~100%, 1% 단위)")
    
    sentences = load_test_sentences()
    if not sentences:
        print("❌ 테스트 문장 없음!")
        exit(1)
    
    all_results = []
    
    for model_name, model_id in MODELS_TO_TEST:
        result = test_model_thresholds(model_name, model_id, sentences, THRESHOLDS)
        all_results.append(result)
    
    # 결과 요약
    print("\n" + "=" * 60)
    print("📊 최종 결과 요약")
    print("=" * 60)
    print(f"{'모델명':<25} {'최적 Threshold':>15} {'F1 Score':>10}")
    print("-" * 60)
    
    for r in all_results:
        if r.get("error"):
            print(f"{r['model_name']:<25} {'에러':>15} {'-':>10}")
        else:
            print(f"{r['model_name']:<25} {r['best_threshold']:>14.0%} {r['best_f1']:>9.1f}%")
    
    # 저장
    save_results(all_results)
    
    print("\n✅ Threshold Tuning 완료!")
