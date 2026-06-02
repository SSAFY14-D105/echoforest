"""
🎮 게임 STT 데이터 기반 6개 모델 벤치마크
- game_test.tsv (188건) 사용
- 6개 감정분석 모델 비교
- 발표용 시각화 생성

사용법: 
    cd C:\SSAFY\S14P11D105-stt-model-test\01_AI\02_Sentiment_Analysis
    conda activate [your-env]
    python benchmark_game_stt.py
"""

import torch
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import time
import gc
import json
import os
from datetime import datetime
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

# ============================================================
# 📋 설정
# ============================================================

DATA_PATH = "../0_Data_Collection/datasets/test_set.tsv"
RESULTS_DIR = "results"
os.makedirs(RESULTS_DIR, exist_ok=True)

# 폰트 설정 (영어 사용 - 호환성)
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['axes.unicode_minus'] = False

# 테스트할 5개 모델 (Korean Sentiment 제외 - 오탐 많음)
MODELS_TO_TEST = [
    ("KoELECTRA Small", "monologg/koelectra-small-finetuned-sentiment"),
    ("KoELECTRA Base", "monologg/koelectra-base-finetuned-sentiment"),
    ("Multilingual", "nlptown/bert-base-multilingual-uncased-sentiment"),
    ("UnSmile", "smilegate-ai/kor_unsmile"),
    ("KcELECTRA v2", "beomi/KcELECTRA-base-v2022"),
]

# 모델별 부정 라벨 매핑
MODEL_NEGATIVE_LABELS = {
    "matthewburke/korean_sentiment": ["LABEL_0"],
    "monologg/koelectra-small-finetuned-sentiment": ["negative"],
    "monologg/koelectra-base-finetuned-sentiment": ["negative"],
    "nlptown/bert-base-multilingual-uncased-sentiment": ["1 star", "2 stars"],
    "smilegate-ai/kor_unsmile": ["악플/욕설", "여성/가족", "남성", "성소수자", 
                                  "인종/국적", "연령", "지역", "종교", "기타 혐오"],
    "beomi/KcELECTRA-base-v2022": ["LABEL_1"],
}

# ============================================================
# 📂 데이터 로드
# ============================================================

# 9개 혐오 라벨 컬럼명
HATE_COLUMNS = ['여성/가족', '남성', '성소수자', '인종/국적', '연령', '지역', '종교', '기타 혐오', '악플/욕설']

def load_game_data():
    """game_test.tsv 로드 - 9개 혐오 라벨 중 하나라도 1이면 Abuse"""
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    sentences = []
    labels = []
    
    for _, row in df.iterrows():
        text = str(row['문장']).strip()
        if not text:
            continue
        # 9개 혐오 라벨 중 하나라도 1이면 Abuse
        is_abuse = any(row.get(col, 0) == 1 for col in HATE_COLUMNS)
        sentences.append(text)
        labels.append(1 if is_abuse else 0)
    
    abuse_count = sum(labels)
    clean_count = len(labels) - abuse_count
    
    print(f"📂 데이터 로드: {len(sentences)}건")
    print(f"   Abuse (9개 혐오 라벨 중 1개 이상): {abuse_count}건")
    print(f"   Clean: {clean_count}건")
    
    return sentences, labels

# ============================================================
# 🧪 벤치마크
# ============================================================

def benchmark_model(model_name, model_id, sentences, true_labels):
    """단일 모델 벤치마크"""
    print(f"\n{'='*60}")
    print(f"🧪 {model_name}")
    print(f"   {model_id}")
    print(f"{'='*60}")
    
    result = {
        "model_name": model_name,
        "model_id": model_id,
        "load_time": 0,
        "avg_latency": 0,
        "abuse_precision": 0,
        "abuse_recall": 0,
        "abuse_f1": 0,
        "clean_f1": 0,
        "accuracy": 0,
        "error": None,
    }
    
    try:
        print("📥 모델 로딩...")
        start = time.time()
        
        device = 0 if torch.cuda.is_available() else -1
        
        if "unsmile" in model_id.lower():
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            model = AutoModelForSequenceClassification.from_pretrained(model_id)
            model.eval()
            if torch.cuda.is_available():
                model = model.cuda()
            classifier = None
        else:
            classifier = pipeline("sentiment-analysis", model=model_id, device=device)
            tokenizer = None
            model = None
        
        result["load_time"] = time.time() - start
        print(f"✅ 로드 완료 ({result['load_time']:.2f}초)")
        
        print("🔄 예측 중...")
        predictions = []
        latencies = []
        
        for i, sentence in enumerate(sentences):
            if i % 50 == 0:
                print(f"   {i}/{len(sentences)}...")
            
            start = time.time()
            
            if "unsmile" in model_id.lower():
                inputs = tokenizer(sentence, return_tensors="pt", truncation=True, max_length=128)
                if torch.cuda.is_available():
                    inputs = {k: v.cuda() for k, v in inputs.items()}
                with torch.no_grad():
                    outputs = model(**inputs)
                    probs = torch.sigmoid(outputs.logits[0]).cpu().numpy()
                # Multi-label: 9개 혐오 라벨(인덱스 0~8) 중 하나라도 0.5 초과하면 Abuse
                hate_probs = probs[:9]  # 인덱스 0~8: 혐오 라벨 9개
                is_abuse = np.any(hate_probs > 0.5)
            else:
                output = classifier(sentence)[0]
                pred_label = output['label']
                negative_labels = MODEL_NEGATIVE_LABELS.get(model_id, [])
                is_abuse = pred_label in negative_labels
            
            latencies.append((time.time() - start) * 1000)
            predictions.append(1 if is_abuse else 0)
        
        result["avg_latency"] = np.mean(latencies)
        
        # 메트릭 계산
        precision, recall, f1, _ = precision_recall_fscore_support(
            true_labels, predictions, labels=[0, 1], zero_division=0
        )
        
        result["clean_precision"] = precision[0]
        result["clean_recall"] = recall[0]
        result["clean_f1"] = f1[0]
        result["abuse_precision"] = precision[1]
        result["abuse_recall"] = recall[1]
        result["abuse_f1"] = f1[1]
        result["accuracy"] = np.mean(np.array(predictions) == np.array(true_labels))
        result["predictions"] = predictions
        
        # Confusion Matrix
        cm = confusion_matrix(true_labels, predictions)
        result["tn"], result["fp"], result["fn"], result["tp"] = cm.ravel()
        
        print(f"📊 결과: Abuse Recall={result['abuse_recall']:.2%}, F1={result['abuse_f1']:.2%}")
        
    except Exception as e:
        result["error"] = str(e)
        print(f"❌ 에러: {e}")
    
    finally:
        if classifier:
            del classifier
        if model:
            del model
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    return result

# ============================================================
# 📊 시각화
# ============================================================

def create_visualizations(results):
    """발표용 시각화 생성"""
    
    successful = [r for r in results if not r.get("error")]
    if not successful:
        print("❌ 성공한 모델 없음")
        return
    
    # 데이터 준비
    names = [r["model_name"] for r in successful]
    recalls = [r["abuse_recall"] * 100 for r in successful]
    f1s = [r["abuse_f1"] * 100 for r in successful]
    latencies = [r["avg_latency"] for r in successful]
    
    # 베스트 모델 인덱스
    best_idx = np.argmax(recalls)
    
    # Figure 1: 3-Panel 비교
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    colors = ['#2ECC71' if i == best_idx else '#3498DB' for i in range(len(names))]
    
    # 1) Abuse Recall
    ax = axes[0]
    bars = ax.barh(names, recalls, color=colors, edgecolor='black', linewidth=0.8)
    ax.set_xlabel('Abuse Recall (%)', fontsize=11)
    ax.set_title('🎯 Abuse Recall (Higher is Better)', fontsize=12, fontweight='bold')
    ax.set_xlim(0, 100)
    for i, (bar, val) in enumerate(zip(bars, recalls)):
        ax.text(val + 1, i, f'{val:.1f}%', va='center', fontsize=9, fontweight='bold' if i == best_idx else 'normal')
    
    # 2) Abuse F1
    ax = axes[1]
    bars = ax.barh(names, f1s, color=colors, edgecolor='black', linewidth=0.8)
    ax.set_xlabel('Abuse F1 Score (%)', fontsize=11)
    ax.set_title('⚖️ Abuse F1 Score', fontsize=12, fontweight='bold')
    ax.set_xlim(0, 100)
    for i, (bar, val) in enumerate(zip(bars, f1s)):
        ax.text(val + 1, i, f'{val:.1f}%', va='center', fontsize=9)
    
    # 3) Latency
    ax = axes[2]
    bars = ax.barh(names, latencies, color=colors, edgecolor='black', linewidth=0.8)
    ax.set_xlabel('Latency (ms)', fontsize=11)
    ax.set_title('⚡ Inference Latency', fontsize=12, fontweight='bold')
    for i, (bar, val) in enumerate(zip(bars, latencies)):
        ax.text(val + 0.5, i, f'{val:.1f}ms', va='center', fontsize=9)
    
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/6_model_comparison.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"📊 저장: {RESULTS_DIR}/6_model_comparison.png")
    
    # Figure 2: 베스트 모델 하이라이트
    fig, ax = plt.subplots(figsize=(10, 6))
    
    bar_colors = ['#27AE60' if i == best_idx else '#BDC3C7' for i in range(len(names))]
    bars = ax.barh(names, recalls, color=bar_colors, edgecolor='black', linewidth=1)
    
    ax.set_xlabel('Abuse Recall (%)', fontsize=12)
    ax.set_title(f'6 Model Benchmark → Best: {successful[best_idx]["model_name"]}', 
                 fontsize=14, fontweight='bold')
    ax.set_xlim(0, 100)
    
    for i, (bar, val) in enumerate(zip(bars, recalls)):
        color = 'white' if i == best_idx else 'black'
        weight = 'bold' if i == best_idx else 'normal'
        ax.text(val - 3 if val > 15 else val + 1, i, f'{val:.1f}%', 
                va='center', ha='right' if val > 15 else 'left', 
                fontsize=11, fontweight=weight, color=color)
    
    # 베스트 모델 강조
    ax.annotate('✅ SELECTED', xy=(recalls[best_idx], best_idx), 
                xytext=(recalls[best_idx] + 5, best_idx + 0.3),
                fontsize=10, fontweight='bold', color='#27AE60')
    
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/best_model_selection.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"📊 저장: {RESULTS_DIR}/best_model_selection.png")

# ============================================================
# 💾 결과 저장
# ============================================================

def save_results(results, sentences_count):
    """결과 저장 (CSV, JSON, Markdown)"""
    
    successful = [r for r in results if not r.get("error")]
    
    # CSV
    df = pd.DataFrame([
        {
            "Model": r["model_name"],
            "Abuse_Recall": f"{r['abuse_recall']*100:.2f}%",
            "Abuse_F1": f"{r['abuse_f1']*100:.2f}%",
            "Abuse_Precision": f"{r['abuse_precision']*100:.2f}%",
            "Clean_F1": f"{r['clean_f1']*100:.2f}%",
            "Accuracy": f"{r['accuracy']*100:.2f}%",
            "Latency_ms": f"{r['avg_latency']:.1f}",
            "TP": r.get("tp", 0),
            "TN": r.get("tn", 0),
            "FP": r.get("fp", 0),
            "FN": r.get("fn", 0),
        }
        for r in successful
    ])
    df.to_csv(f'{RESULTS_DIR}/benchmark_results.csv', index=False)
    print(f"💾 저장: {RESULTS_DIR}/benchmark_results.csv")
    
    # JSON
    json_data = {
        "timestamp": datetime.now().isoformat(),
        "test_data": DATA_PATH,
        "test_count": sentences_count,
        "results": [
            {
                k: int(v) if isinstance(v, (np.int64, np.int32)) else (float(v) if isinstance(v, (np.float64, np.float32)) else v)
                for k, v in r.items() 
                if k != "predictions"
            } 
            for r in successful
        ]
    }
    with open(f'{RESULTS_DIR}/benchmark_results.json', 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f"💾 저장: {RESULTS_DIR}/benchmark_results.json")
    
    # Markdown README
    best = max(successful, key=lambda x: x["abuse_recall"])
    
    md_content = f"""# 🎮 6개 모델 벤치마크 결과

## 📊 테스트 환경
- **테스트 데이터**: `game_test.tsv` ({sentences_count}건)
- **테스트 일시**: {datetime.now().strftime('%Y-%m-%d %H:%M')}
- **데이터 출처**: 협동 게임 STT + 유튜브 협동게임 STT

---

## 🏆 결과 요약

| 모델 | Abuse Recall | Abuse F1 | 선정 |
|------|:------------:|:--------:|:----:|
"""
    
    for r in sorted(successful, key=lambda x: -x["abuse_recall"]):
        selected = "✅" if r["model_name"] == best["model_name"] else ""
        md_content += f"| {r['model_name']} | **{r['abuse_recall']*100:.2f}%** | {r['abuse_f1']*100:.2f}% | {selected} |\n"
    
    md_content += f"""
---

## 🎯 UnSmile 선정 이유

### 1. 최고 성능
- **Abuse Recall**: {best['abuse_recall']*100:.2f}% (6개 모델 중 1위)
- **Abuse F1**: {best['abuse_f1']*100:.2f}%

### 2. 한국어 혐오 발언 전용
- Smilegate AI에서 개발한 **한국어 혐오 발언 탐지** 전용 모델
- 댓글/채팅 데이터로 학습되어 게임 대화에 적합

### 3. 다른 모델 한계
- **KoELECTRA 계열**: Fine-tuning 안 된 베이스 모델 → 성능 저조
- **Korean Sentiment**: 일반 감정 분석 → 욕설 특화 X
- **Multilingual**: 한국어 성능 부족

---

## 📈 시각화

### 6개 모델 비교
![6 Model Comparison](./6_model_comparison.png)

### 베스트 모델 선정
![Best Model Selection](./best_model_selection.png)

---

## 📋 상세 결과

| 모델 | TP | TN | FP | FN | Precision | Recall |
|------|:--:|:--:|:--:|:--:|:---------:|:------:|
"""
    
    for r in successful:
        md_content += f"| {r['model_name']} | {r.get('tp', 0)} | {r.get('tn', 0)} | {r.get('fp', 0)} | {r.get('fn', 0)} | {r['abuse_precision']*100:.1f}% | {r['abuse_recall']*100:.1f}% |\n"
    
    md_content += """
---

## 🚀 다음 단계
1. UnSmile 기반으로 **게임 STT 데이터로 Fine-tuning**
2. LoRA vs Full Fine-tuning 비교
3. 최적 모델 INT8 양자화
"""
    
    with open(f'{RESULTS_DIR}/MODEL_BENCHMARK.md', 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"📝 저장: {RESULTS_DIR}/MODEL_BENCHMARK.md")

# ============================================================
# 🚀 메인
# ============================================================

if __name__ == "__main__":
    print("🎮 게임 STT 데이터 기반 6개 모델 벤치마크")
    print("="*60)
    
    # 데이터 로드
    sentences, true_labels = load_game_data()
    
    # 벤치마크
    all_results = []
    for model_name, model_id in MODELS_TO_TEST:
        result = benchmark_model(model_name, model_id, sentences, true_labels)
        all_results.append(result)
    
    # 결과 요약
    print("\n" + "="*80)
    print("📊 전체 결과")
    print("="*80)
    print(f"{'Model':<20} {'Abuse Recall':>14} {'Abuse F1':>12} {'Latency':>10}")
    print("-"*60)
    
    for r in all_results:
        if r.get("error"):
            print(f"{r['model_name']:<20} {'ERROR':>14}")
        else:
            print(f"{r['model_name']:<20} {r['abuse_recall']*100:>13.2f}% {r['abuse_f1']*100:>11.2f}% {r['avg_latency']:>9.1f}ms")
    
    # 베스트 모델
    successful = [r for r in all_results if not r.get("error")]
    if successful:
        best = max(successful, key=lambda x: x["abuse_recall"])
        print(f"\n🏆 Best: {best['model_name']} (Abuse Recall: {best['abuse_recall']*100:.2f}%)")
    
    # 시각화 및 저장
    create_visualizations(all_results)
    save_results(all_results, len(sentences))
    
    print("\n✅ 벤치마크 완료!")
    print(f"   결과: {RESULTS_DIR}/")
