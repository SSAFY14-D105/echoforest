"""
🎮 게임 STT 데이터 기반 6개 모델 벤치마크
- game_test.tsv (188건) 사용
- 6개 감정분석 모델 비교
- 발표용 시각화 생성

사용법: python benchmark_game_data.py
"""

import torch
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import time
import gc
import json
import os
from datetime import datetime
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support

# ============================================================
# 📋 설정
# ============================================================

# 데이터 경로
DATA_PATH = "../5_Model_Comparison/data/game_test.tsv"
RESULTS_DIR = "./benchmark_results"
os.makedirs(RESULTS_DIR, exist_ok=True)

# 폰트 설정 (영어 사용)
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['axes.unicode_minus'] = False

# 테스트할 6개 모델
MODELS_TO_TEST = [
    ("Korean Sentiment", "matthewburke/korean_sentiment"),
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

def load_game_data():
    """game_test.tsv 로드 및 파싱"""
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    sentences = []
    labels = []
    
    for _, row in df.iterrows():
        text = row['문장']
        # 악플/욕설 컬럼이 1이면 ABUSE, 아니면 CLEAN
        is_abuse = row['악플/욕설'] == 1
        sentences.append(text)
        labels.append(1 if is_abuse else 0)  # 1 = Abuse, 0 = Clean
    
    abuse_count = sum(labels)
    clean_count = len(labels) - abuse_count
    
    print(f"📂 데이터 로드 완료: {len(sentences)}건")
    print(f"   Abuse: {abuse_count}건 | Clean: {clean_count}건")
    
    return sentences, labels

# ============================================================
# 🧪 벤치마크 함수
# ============================================================

def benchmark_single_model(model_name, model_id, sentences, true_labels):
    """단일 모델 벤치마크"""
    print(f"\n{'='*60}")
    print(f"🧪 테스트: {model_name}")
    print(f"   모델: {model_id}")
    print(f"{'='*60}")
    
    result = {
        "model_name": model_name,
        "model_id": model_id,
        "load_time": 0,
        "avg_latency": 0,
        "abuse_precision": 0,
        "abuse_recall": 0,
        "abuse_f1": 0,
        "clean_precision": 0,
        "clean_recall": 0,
        "clean_f1": 0,
        "accuracy": 0,
        "error": None,
    }
    
    try:
        # 모델 로드
        print("📥 모델 로딩 중...")
        start = time.time()
        
        if "unsmile" in model_id.lower():
            # UnSmile은 multi-label 모델
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            model = AutoModelForSequenceClassification.from_pretrained(model_id)
            model.eval()
            if torch.cuda.is_available():
                model = model.cuda()
            classifier = None
        else:
            classifier = pipeline("sentiment-analysis", model=model_id, device=0 if torch.cuda.is_available() else -1)
            tokenizer = None
            model = None
        
        result["load_time"] = time.time() - start
        print(f"✅ 로드 완료! ({result['load_time']:.2f}초)")
        
        # 예측
        print("🔄 예측 중...")
        predictions = []
        latencies = []
        
        for sentence in sentences:
            start = time.time()
            
            if "unsmile" in model_id.lower():
                # UnSmile 특별 처리
                inputs = tokenizer(sentence, return_tensors="pt", truncation=True, max_length=128)
                if torch.cuda.is_available():
                    inputs = {k: v.cuda() for k, v in inputs.items()}
                with torch.no_grad():
                    outputs = model(**inputs)
                    probs = torch.sigmoid(outputs.logits[0]).cpu().numpy()
                # 악플/욕설 인덱스 (8번)
                abuse_prob = probs[8]
                is_abuse = abuse_prob > 0.5
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
        
        print(f"📊 결과:")
        print(f"   Accuracy: {result['accuracy']:.2%}")
        print(f"   Abuse Recall: {result['abuse_recall']:.2%}")
        print(f"   Abuse F1: {result['abuse_f1']:.2%}")
        print(f"   Avg Latency: {result['avg_latency']:.1f}ms")
        
    except Exception as e:
        result["error"] = str(e)
        print(f"❌ 에러: {e}")
    
    finally:
        # 메모리 정리
        if classifier:
            del classifier
        if model:
            del model
        if tokenizer:
            del tokenizer
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    return result

# ============================================================
# 📊 시각화
# ============================================================

def create_visualizations(results, true_labels):
    """발표용 시각화 생성"""
    
    successful = [r for r in results if not r.get("error")]
    if not successful:
        print("❌ 성공한 모델이 없어 시각화 불가")
        return
    
    # 데이터 준비
    model_names = [r["model_name"] for r in successful]
    abuse_recalls = [r["abuse_recall"] * 100 for r in successful]
    abuse_f1s = [r["abuse_f1"] * 100 for r in successful]
    latencies = [r["avg_latency"] for r in successful]
    
    # Figure 1: 6모델 비교 차트
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    colors = plt.cm.viridis(np.linspace(0.2, 0.8, len(model_names)))
    
    # 1) Abuse Recall 비교
    ax = axes[0]
    bars = ax.barh(model_names, abuse_recalls, color=colors, edgecolor='black', linewidth=0.5)
    ax.set_xlabel('Abuse Recall (%)', fontsize=11)
    ax.set_title('Abuse Recall Comparison', fontsize=12, fontweight='bold')
    ax.set_xlim(0, 100)
    for i, (bar, val) in enumerate(zip(bars, abuse_recalls)):
        ax.text(val + 1, i, f'{val:.1f}%', va='center', fontsize=9)
    
    # 2) Abuse F1 비교
    ax = axes[1]
    bars = ax.barh(model_names, abuse_f1s, color=colors, edgecolor='black', linewidth=0.5)
    ax.set_xlabel('Abuse F1 Score (%)', fontsize=11)
    ax.set_title('Abuse F1 Score Comparison', fontsize=12, fontweight='bold')
    ax.set_xlim(0, 100)
    for i, (bar, val) in enumerate(zip(bars, abuse_f1s)):
        ax.text(val + 1, i, f'{val:.1f}%', va='center', fontsize=9)
    
    # 3) Latency 비교
    ax = axes[2]
    bars = ax.barh(model_names, latencies, color=colors, edgecolor='black', linewidth=0.5)
    ax.set_xlabel('Latency (ms)', fontsize=11)
    ax.set_title('Inference Latency Comparison', fontsize=12, fontweight='bold')
    for i, (bar, val) in enumerate(zip(bars, latencies)):
        ax.text(val + 0.5, i, f'{val:.1f}ms', va='center', fontsize=9)
    
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/6_models_comparison.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"📊 저장: {RESULTS_DIR}/6_models_comparison.png")
    
    # Figure 2: 베스트 모델 하이라이트
    best_idx = np.argmax(abuse_recalls)
    best_model = successful[best_idx]
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    bar_colors = ['#2ECC71' if i == best_idx else '#95A5A6' for i in range(len(model_names))]
    bars = ax.barh(model_names, abuse_recalls, color=bar_colors, edgecolor='black', linewidth=0.8)
    
    ax.set_xlabel('Abuse Recall (%)', fontsize=12)
    ax.set_title('6 Model Benchmark - Best: ' + best_model["model_name"], fontsize=14, fontweight='bold')
    ax.set_xlim(0, 100)
    
    for i, (bar, val) in enumerate(zip(bars, abuse_recalls)):
        color = 'white' if i == best_idx else 'black'
        ax.text(val - 5 if val > 20 else val + 1, i, f'{val:.1f}%', 
                va='center', ha='right' if val > 20 else 'left', 
                fontsize=10, fontweight='bold', color=color)
    
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/best_model_highlight.png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"📊 저장: {RESULTS_DIR}/best_model_highlight.png")

# ============================================================
# 💾 결과 저장
# ============================================================

def save_results(results):
    """결과 저장"""
    
    # CSV 저장
    df_results = pd.DataFrame([
        {
            "Model": r["model_name"],
            "Abuse_Recall": f"{r['abuse_recall']*100:.2f}%",
            "Abuse_F1": f"{r['abuse_f1']*100:.2f}%",
            "Clean_F1": f"{r['clean_f1']*100:.2f}%",
            "Accuracy": f"{r['accuracy']*100:.2f}%",
            "Latency_ms": f"{r['avg_latency']:.1f}",
            "Load_Time_s": f"{r['load_time']:.2f}",
            "Error": r.get("error", "")
        }
        for r in results
    ])
    df_results.to_csv(f'{RESULTS_DIR}/benchmark_results.csv', index=False)
    print(f"💾 저장: {RESULTS_DIR}/benchmark_results.csv")
    
    # JSON 저장
    json_data = {
        "timestamp": datetime.now().isoformat(),
        "data_path": DATA_PATH,
        "results": [
            {k: v for k, v in r.items() if k != "predictions"}
            for r in results
        ]
    }
    with open(f'{RESULTS_DIR}/benchmark_results.json', 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f"💾 저장: {RESULTS_DIR}/benchmark_results.json")

# ============================================================
# 🚀 메인
# ============================================================

if __name__ == "__main__":
    print("🎮 게임 STT 데이터 기반 6개 모델 벤치마크")
    print("="*60)
    
    # 데이터 로드
    sentences, true_labels = load_game_data()
    
    # 벤치마크 실행
    all_results = []
    for model_name, model_id in MODELS_TO_TEST:
        result = benchmark_single_model(model_name, model_id, sentences, true_labels)
        all_results.append(result)
    
    # 결과 요약
    print("\n" + "="*80)
    print("📊 전체 결과 요약")
    print("="*80)
    print(f"{'Model':<20} {'Abuse Recall':>12} {'Abuse F1':>10} {'Latency':>10}")
    print("-"*60)
    
    for r in all_results:
        if r.get("error"):
            print(f"{r['model_name']:<20} {'ERROR':>12}")
        else:
            print(f"{r['model_name']:<20} {r['abuse_recall']*100:>11.2f}% {r['abuse_f1']*100:>9.2f}% {r['avg_latency']:>9.1f}ms")
    
    # 베스트 모델
    successful = [r for r in all_results if not r.get("error")]
    if successful:
        best = max(successful, key=lambda x: x["abuse_recall"])
        print(f"\n🏆 Best Model: {best['model_name']} (Abuse Recall: {best['abuse_recall']*100:.2f}%)")
    
    # 시각화 및 저장
    create_visualizations(all_results, true_labels)
    save_results(all_results)
    
    print("\n✅ 벤치마크 완료!")
