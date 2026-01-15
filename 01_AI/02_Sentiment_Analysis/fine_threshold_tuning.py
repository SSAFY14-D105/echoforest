"""
🎯 Fine Threshold Tuning - 미세 조정
- 쓸만한 모델 2개에 대해 0.1% 단위로 최적 threshold 찾기

사용법: python fine_threshold_tuning.py
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

# 미세 조정할 모델들 (쓸만한 것만!)
MODELS_TO_TUNE = [
    {
        "name": "Korean Sentiment",
        "model_id": "matthewburke/korean_sentiment",
        "range_start": 80.0,  # 80%
        "range_end": 90.0,    # 90%
        "step": 0.01          # 0.01%
    },
    {
        "name": "UnSmile",
        "model_id": "smilegate-ai/kor_unsmile",
        "range_start": 10.0,  # 10%
        "range_end": 20.0,    # 20%
        "step": 0.01          # 0.01%
    },
]

# 🏷️ 모델별 "부정/욕설" 라벨 매핑
MODEL_NEGATIVE_LABELS = {
    "matthewburke/korean_sentiment": ["LABEL_0"],
    "smilegate-ai/kor_unsmile": ["악플/욕설", "여성/가족", "남성", "성소수자", 
                                  "인종/국적", "연령", "지역", "종교", "기타 혐오", "악플"],
}

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

def get_negative_score(result, pred_label, model_id):
    """모델 출력에서 NEGATIVE 확률 추출"""
    score = result[0]['score']
    
    negative_labels = MODEL_NEGATIVE_LABELS.get(model_id, [])
    is_negative_label = pred_label in negative_labels
    
    if not negative_labels:
        pred_upper = pred_label.upper()
        is_negative_label = (
            "NEG" in pred_upper or 
            "악플" in pred_label or
            "욕설" in pred_label or
            "혐오" in pred_label
        )
    
    if is_negative_label:
        return score
    else:
        return 1 - score

def calculate_metrics(predictions, threshold):
    """주어진 threshold로 TP/TN/FP/FN 및 F1 계산"""
    tp, tn, fp, fn = 0, 0, 0, 0
    
    for p in predictions:
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

def tune_model(config, sentences):
    """한 모델에 대해 미세 조정 테스트"""
    model_name = config["name"]
    model_id = config["model_id"]
    range_start = config["range_start"]
    range_end = config["range_end"]
    step = config["step"]
    
    # Threshold 범위 생성
    thresholds = []
    current = range_start
    while current <= range_end + 0.001:  # 부동소수점 오차 보정
        thresholds.append(current / 100)  # 퍼센트를 비율로
        current += step
    
    print(f"\n{'='*60}")
    print(f"🧪 미세 조정: {model_name}")
    print(f"   범위: {range_start:.1f}% ~ {range_end:.1f}%")
    print(f"   단위: {step}%")
    print(f"   테스트 수: {len(thresholds)}개")
    print(f"{'='*60}")
    
    try:
        print("📥 모델 로딩...")
        classifier = pipeline("sentiment-analysis", model=model_id)
        print("✅ 로드 완료!")
        
        predictions = []
        print("🔄 예측 수집 중...")
        
        for sentence, expected in sentences:
            result = classifier(sentence)
            pred_label = result[0]['label']
            neg_score = get_negative_score(result, pred_label, model_id)
            
            predictions.append({
                "sentence": sentence,
                "expected": expected,
                "neg_score": neg_score,
                "raw_label": pred_label,
                "raw_score": result[0]['score']
            })
        
        print(f"✅ {len(predictions)}개 예측 완료!")
        
        results = []
        print("\n📊 Threshold별 성능:")
        print(f"{'Threshold':<12} {'F1':>8} {'Precision':>10} {'Recall':>8} {'Accuracy':>10}")
        print("-" * 55)
        
        best_f1 = 0
        best_threshold = thresholds[0]
        
        for threshold in thresholds:
            metrics = calculate_metrics(predictions, threshold)
            results.append(metrics)
            
            print(f"{threshold*100:<11.2f}% {metrics['f1']:>7.2f}% {metrics['precision']:>9.2f}% {metrics['recall']:>7.2f}% {metrics['accuracy']:>9.2f}%")
            
            # F1이 같거나 높으면 업데이트 (동점 시 더 높은 threshold 선택)
            if metrics['f1'] >= best_f1:
                best_f1 = metrics['f1']
                best_threshold = threshold
        
        print("-" * 55)
        print(f"🏆 최적 Threshold: {best_threshold*100:.2f}% (F1: {best_f1:.2f}%)")
        
        return {
            "model_name": model_name,
            "model_id": model_id,
            "best_threshold": best_threshold,
            "best_f1": best_f1,
            "all_results": results,
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
    results_dir = "results/fine_tuning"
    os.makedirs(results_dir, exist_ok=True)
    
    # Markdown 저장
    md_path = os.path.join(results_dir, f"fine_tune_{timestamp}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# 🎯 Fine Threshold Tuning 결과\n\n")
        f.write(f"- 실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## 📊 최적 Threshold 요약\n\n")
        f.write("| 모델 | 최적 Threshold | F1 Score |\n")
        f.write("|------|----------------|----------|\n")
        
        for r in all_results:
            if r.get("error"):
                f.write(f"| {r['model_name']} | 에러 | - |\n")
            else:
                f.write(f"| {r['model_name']} | **{r['best_threshold']*100:.2f}%** | **{r['best_f1']:.2f}%** |\n")
        
        f.write("\n## 📈 상세 결과\n\n")
        
        for r in all_results:
            if r.get("error"):
                continue
            
            f.write(f"### {r['model_name']}\n\n")
            f.write("| Threshold | F1 | Precision | Recall | Accuracy |\n")
            f.write("|-----------|-----|-----------|--------|----------|\n")
            
            for m in r["all_results"]:
                marker = "🏆" if abs(m["threshold"] - r["best_threshold"]) < 0.0001 else ""
                f.write(f"| {m['threshold']*100:.2f}% {marker} | {m['f1']:.2f}% | {m['precision']:.2f}% | {m['recall']:.2f}% | {m['accuracy']:.2f}% |\n")
            
            f.write("\n")
    
    print(f"\n💾 결과 저장 완료:")
    print(f"   📝 Markdown: {md_path}")

# ============================================================
# 🚀 메인 실행
# ============================================================

if __name__ == "__main__":
    print("🎯 Fine Threshold Tuning 시작!")
    print(f"📋 미세 조정 모델 수: {len(MODELS_TO_TUNE)}")
    
    sentences = load_test_sentences()
    if not sentences:
        print("❌ 테스트 문장 없음!")
        exit(1)
    
    all_results = []
    
    for config in MODELS_TO_TUNE:
        result = tune_model(config, sentences)
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
            print(f"{r['model_name']:<25} {r['best_threshold']*100:>14.2f}% {r['best_f1']:>9.2f}%")
    
    save_results(all_results)
    
    print("\n✅ Fine Threshold Tuning 완료!")
