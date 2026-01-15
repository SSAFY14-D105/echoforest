"""
🎯 Best Model Detailed Analysis
- UnSmile 모델을 사용하여 최적의 Threshold를 찾고, 상세한 오답 노트(틀린 문장)를 생성합니다.
- User Request: "최적 Accuracy로 해줘 ... 어떤 문장들이 틀리는지 확인"

사용법: python analyze_best_model.py
"""

from transformers import pipeline
import json
import os
from datetime import datetime
import torch
import gc

# ============================================================
# 📋 설정
# ============================================================

MODEL_NAME = "UnSmile (Smilegate)"
MODEL_ID = "smilegate-ai/kor_unsmile"

# UnSmile 모델의 부정적 의미(욕설)를 나타내는 라벨들
# 이 라벨이 나오면 '욕설 가능성'이 있는 것으로 간주
NEGATIVE_LABELS = [
    "악플/욕설", "여성/가족", "남성", "성소수자", 
    "인종/국적", "연령", "지역", "종교", "기타 혐오", "악플"
]

def load_test_sentences():
    """keywords.json에서 테스트 문장 로드"""
    try:
        with open("keywords.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        
        sentences = []
        # POSITIVE = 욕설 아님 (칭찬)
        for s in data.get("positive_sentences", []):
            sentences.append({"text": s, "expected": "POSITIVE", "category": "칭찬"})
            
        # NEGATIVE = 욕설 (욕설)
        for s in data.get("negative_sentences", []):
            sentences.append({"text": s, "expected": "NEGATIVE", "category": "욕설"})
            
        # NEUTRAL = 욕설 아님 (일상) -> POSITIVE로 취급
        for s in data.get("neutral_sentences", []):
            sentences.append({"text": s, "expected": "POSITIVE", "category": "일상(중립)"})
            
        print(f"📂 총 {len(sentences)}개 문장 로드 완료")
        return sentences
    except FileNotFoundError:
        print("⚠️ keywords.json 없음")
        return []

def get_curse_score(result):
    """모델 출력에서 '욕설일 확률'을 추출"""
    label = result['label']
    score = result['score']
    
    # 해당 라벨이 '욕설' 카테고리에 속하면 그 점수 그대로 사용
    if label in NEGATIVE_LABELS:
        return score
    # '욕설'이 아닌 라벨(Example: 'clean')이면 (1 - 점수)가 욕설 확률
    else:
        return 1 - score

def calculate_stats(predictions, threshold):
    """특정 threshold에서의 정답률 등 계산"""
    tp, tn, fp, fn = 0, 0, 0, 0
    incorrect_samples = []
    
    for p in predictions:
        # threshold 이상이면 'NEGATIVE'(욕설)로 판단
        predicted_is_curse = p['curse_score'] >= threshold
        expected_is_curse = p['expected'] == "NEGATIVE"
        
        # 실제: 욕설
        if expected_is_curse:
            if predicted_is_curse:
                tp += 1
            else:
                fn += 1
                incorrect_samples.append({
                    "type": "FN (미탐지)",
                    "text": p['text'],
                    "category": p['category'],
                    "curse_score": p['curse_score'],
                    "raw_label": p['raw_label']
                })
        # 실제: 비욕설 (칭찬/일상)
        else:
            if predicted_is_curse:
                fp += 1
                incorrect_samples.append({
                    "type": "FP (과탐지)",
                    "text": p['text'],
                    "category": p['category'],
                    "curse_score": p['curse_score'],
                    "raw_label": p['raw_label']
                })
            else:
                tn += 1
                
    total = tp + tn + fp + fn
    accuracy = (tp + tn) / total if total > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        "threshold": threshold,
        "accuracy": accuracy,
        "f1": f1,
        "precision": precision,
        "recall": recall,
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "incorrect_samples": incorrect_samples
    }

def find_best_threshold(predictions):
    """0.1% 단위로 Threshold를 스캔하여 최적의 구간 찾기"""
    print("🔄 최적 Threshold 탐색 중 (0.0% ~ 100.0%)...")
    
    results = []
    # 0.000 ~ 1.000 까지 0.001 (0.1%) 단위로 스캔
    for i in range(1001):
        threshold = i / 1000.0
        stats = calculate_stats(predictions, threshold)
        results.append(stats)
        
    # 정렬 기준:
    # 1. F1 Score (DESC) - 가장 높은 F1
    # 2. Threshold (DESC) - F1이 같으면 더 높은 threshold (억울한 FP 최소화)
    # 3. Accuracy (DESC) - 그래도 같으면 Accuracy
    
    best_result = sorted(results, key=lambda x: (x['f1'], x['threshold'], x['accuracy']), reverse=True)[0]
    
    return best_result

def save_report(best_stat, all_predictions):
    """MD 파일 생성"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs("results/best_model_analysis", exist_ok=True)
    filename = f"results/best_model_analysis/unsmile_analysis_{timestamp}.md"
    
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"# 🏆 {MODEL_NAME} 상세 분석 보고서\n\n")
        f.write(f"- 분석 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- 모델 ID: `{MODEL_ID}`\n\n")
        
        f.write("## 1. 📊 최적 성능 요약\n\n")
        f.write("> ⚙️ **Threshold 선택 기준**: F1 Score 최대화, 동점 시 억울한 제재(FP)를 최소화하기 위해 더 높은 Threshold 선택\n\n")
        f.write(f"- **최적 Threshold**: `{best_stat['threshold']*100:.1f}%` (이 점수 이상이면 욕설)\n")
        f.write(f"- **Accuracy (정확도)**: `{best_stat['accuracy']*100:.2f}%`\n")
        f.write(f"- **F1 Score**: `{best_stat['f1']*100:.2f}%`\n")
        f.write(f"- Precision (정밀도): `{best_stat['precision']*100:.2f}%`\n")
        f.write(f"- Recall (재현율): `{best_stat['recall']*100:.2f}%`\n\n")
        
        f.write("### 혼동 행렬 (Confusion Matrix)\n")
        f.write("| | 예측: 욕설 (Positive) | 예측: 비욕설 (Negative) |\n")
        f.write("|---|---|---|\n")
        f.write(f"| **실제: 욕설** | ✅ TP: {best_stat['tp']}개 (잘 잡음) | ❌ **FN: {best_stat['fn']}개 (놓침)** |\n")
        f.write(f"| **실제: 비욕설** | ❌ **FP: {best_stat['fp']}개 (억울함)** | ✅ TN: {best_stat['tn']}개 (잘 넘김) |\n\n")
        
        f.write("## 2. 📝 오답 노트 (틀린 문장들)\n\n")
        
        incorrects = best_stat['incorrect_samples']
        if not incorrects:
            f.write("✅ 틀린 문장이 하나도 없습니다! 완벽합니다.\n")
        else:
            # FP (과탐지) 먼저
            fps = [x for x in incorrects if "FP" in x['type']]
            f.write(f"### 😨 과탐지 (FP): 욕설이 아닌데 욕설로 오해 ({len(fps)}개)\n")
            f.write("> **중요**: 일반 유저들이 억울하게 제재당할 수 있는 케이스입니다.\n\n")
            f.write("| 문장 | 카테고리 | 욕설확률 | 원본라벨 |\n")
            f.write("|---|---|---|---|\n")
            for item in fps:
                f.write(f"| {item['text']} | {item['category']} | **{item['curse_score']*100:.1f}%** | {item['raw_label']} |\n")
            f.write("\n")
            
            # FN (미탐지) 그 다음
            fns = [x for x in incorrects if "FN" in x['type']]
            f.write(f"### 😶 미탐지 (FN): 욕설인데 못 잡음 ({len(fns)}개)\n")
            f.write("> **중요**: 욕설 필터링을 뚫고 지나가는 케이스입니다.\n\n")
            f.write("| 문장 | 카테고리 | 욕설확률 | 원본라벨 |\n")
            f.write("|---|---|---|---|\n")
            for item in fns:
                f.write(f"| {item['text']} | {item['category']} | **{item['curse_score']*100:.1f}%** | {item['raw_label']} |\n")
            f.write("\n")
            
        f.write("## 3. ✅ 전체 예측 리스트 (참고용)\n\n")
        f.write("<details>\n<summary>클릭하여 전체 보기</summary>\n\n")
        f.write("| 판정 | 문장 | 실제 | 예측 | 욕설확률 |\n")
        f.write("|---|---|---|---|---|\n")
        
        # Sort predictions by curse_score desc
        sorted_preds = sorted(all_predictions, key=lambda x: x['curse_score'], reverse=True)
        
        for p in sorted_preds:
            threshold = best_stat['threshold']
            is_curse = p['curse_score'] >= threshold
            pred_str = "🔴욕설" if is_curse else "🟢비욕설"
            match = "✅" if (is_curse == (p['expected'] == "NEGATIVE")) else "❌"
            
            f.write(f"| {match} | {p['text']} | {p['category']} | {pred_str} | {p['curse_score']*100:.1f}% |\n")
        
        f.write("\n</details>\n")
        
    print(f"\n💾 리포트 저장 완료: {filename}")
    return filename

def main():
    print(f"🚀 {MODEL_NAME} 정밀 분석 시작...")
    
    # 1. 데이터 로드
    sentences = load_test_sentences()
    if not sentences:
        return

    # 2. 모델 로드
    print("📥 모델 로딩 중...")
    try:
        classifier = pipeline("sentiment-analysis", model=MODEL_ID, device=0 if torch.cuda.is_available() else -1)
        print("✅ 모델 로드 완료")
    except Exception as e:
        print(f"❌ 모델 로드 실패: {e}")
        return

    # 3. 예측 수행
    print("🔮 전체 문장 예측 중...")
    predictions = []
    for item in sentences:
        res = classifier(item['text'])[0]
        curse_score = get_curse_score(res)
        
        predictions.append({
            "text": item['text'],
            "expected": item['expected'],
            "category": item['category'],
            "curse_score": curse_score,
            "raw_label": res['label'],
            "raw_score": res['score']
        })
    print("✅ 예측 완료")

    # 4. 최적 Threshold 찾기
    best_stat = find_best_threshold(predictions)
    print(f"\n🏆 찾은 최적 Threshold (F1 Score 기준): {best_stat['threshold']*100:.1f}%")
    print(f"   - F1: {best_stat['f1']*100:.2f}%")
    print(f"   - Acc: {best_stat['accuracy']*100:.2f}%")

    # 5. 리포트 생성
    save_report(best_stat, predictions)

if __name__ == "__main__":
    main()
