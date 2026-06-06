"""
게임 STT 데이터 기반 5개 모델 벤치마크 (Step 1 · 모델 선정)
- test_set.tsv (482건, held-out) 사용
- 5개 한국어 감정/혐오 분석 모델 비교 → Abuse F1 기준 선정 (모두 분류 헤드가 실제 로드되는 모델)
- 산출물: results/ (benchmark_autogen.md 원시요약, benchmark_results.csv/.json, 그래프 en/ko 4종)
  ※ 큐레이션 문서(그래프 설명 등)는 results/MODEL_BENCHMARK.md (손으로 유지, 자동 덮어쓰기 안 함)

사용법:
    cd 1_Model_Selection
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

# 테스트할 5개 모델 — 모두 분류 헤드가 실제로 로드되는 모델만.
#  · KoELECTRA 2종: 저장 헤드가 구 형식(단일 Linear)이라 수동 로드(load_koelectra_sentiment)
#  · beomi/KcELECTRA-base-v2022는 분류 헤드가 없는 base LM(ElectraForPreTraining)이라
#    선정 후보에서 제외 — 이 base는 4·5단계에서 게임 데이터로 헤드를 학습시켜 사용
MODELS_TO_TEST = [
    ("KoELECTRA Small", "monologg/koelectra-small-finetuned-sentiment"),
    ("KoELECTRA Base", "monologg/koelectra-base-finetuned-sentiment"),
    ("Multilingual", "nlptown/bert-base-multilingual-uncased-sentiment"),
    ("Korean Sentiment", "matthewburke/korean_sentiment"),
    ("UnSmile", "smilegate-ai/kor_unsmile"),
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
    """test_set.tsv 로드 - 9개 혐오 라벨 중 하나라도 1이면 Abuse"""
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

# KoELECTRA 감정모델: 저장된 분류 헤드가 '단일 Linear(구 형식)'라, 표준 로더
# (ElectraForSequenceClassification)는 헤드를 랜덤 초기화해버린다(수치=noise).
# → 인코더(ElectraModel) + 단일 Linear를 [CLS]에 수동으로 붙여 학습된 헤드를 로드.
KOELECTRA_FLAT = {
    "monologg/koelectra-small-finetuned-sentiment",
    "monologg/koelectra-base-finetuned-sentiment",
}

def load_koelectra_sentiment(model_id):
    """반환 (tokenizer, encoder, head_linear). 라벨 index 0 = negative(=abuse)."""
    import torch.nn as nn
    from transformers import ElectraModel
    from huggingface_hub import hf_hub_download
    tok = AutoTokenizer.from_pretrained(model_id)
    enc = ElectraModel.from_pretrained(model_id).eval()
    sd = torch.load(hf_hub_download(model_id, "pytorch_model.bin"),
                    map_location="cpu", weights_only=True)
    head = nn.Linear(enc.config.hidden_size, sd["classifier.weight"].shape[0])
    head.weight.data = sd["classifier.weight"]
    head.bias.data = sd["classifier.bias"]
    head.eval()
    if torch.cuda.is_available():
        enc, head = enc.cuda(), head.cuda()
    return tok, enc, head

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
        tokenizer = model = classifier = ko_head = None

        if "unsmile" in model_id.lower():
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            model = AutoModelForSequenceClassification.from_pretrained(model_id)
            model.eval()
            if torch.cuda.is_available():
                model = model.cuda()
        elif model_id in KOELECTRA_FLAT:
            # 저장 헤드가 구 형식(단일 Linear)이라 표준 로더가 헤드를 랜덤초기화함 → 수동 로드
            tokenizer, model, ko_head = load_koelectra_sentiment(model_id)
        else:
            classifier = pipeline("sentiment-analysis", model=model_id, device=device)
        
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
                # abuse = 악플/욕설(index 8) > 0.5 — 배포(FastAPI probs[8])·Step 6·Step 2 baseline과 동일 정의
                is_abuse = probs[8] > 0.5
            elif model_id in KOELECTRA_FLAT:
                inputs = tokenizer(sentence, return_tensors="pt", truncation=True, max_length=128)
                if torch.cuda.is_available():
                    inputs = {k: v.cuda() for k, v in inputs.items()}
                with torch.no_grad():
                    pooled = model(**inputs).last_hidden_state[:, 0]   # 첫 토큰([CLS])
                    is_abuse = int(ko_head(pooled)[0].argmax()) == 0    # idx 0 = negative(=abuse)
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
    """[deprecated] 차트는 plot_benchmark.render_charts()로 분리됨.
    포트폴리오용 디자인을 results/benchmark_results.csv 기반으로 그린다
    (모델 추론과 분리 → 재추론 없이 재렌더 가능). main에서 save_results 후 호출."""
    pass

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
    best = max(successful, key=lambda x: x["abuse_f1"])
    
    md_content = f"""# 🎮 5개 모델 벤치마크 결과 (자동 생성)

> ⚙️ 이 파일은 `benchmark_game_stt.py`가 매 실행마다 **자동 생성**하는 원시 요약입니다.
> 그래프 읽는 법·688 비교 등 **큐레이션 문서는** [`MODEL_BENCHMARK.md`](./MODEL_BENCHMARK.md).

## 📊 테스트 환경
- **테스트 데이터**: `test_set.tsv` ({sentences_count}건, held-out)
- **테스트 일시**: {datetime.now().strftime('%Y-%m-%d %H:%M')}
- **데이터 출처**: 협동 게임 STT + 유튜브 협동게임 STT

---

## 🏆 결과 요약

| 모델 | Abuse Recall | Abuse F1 | 선정 |
|------|:------------:|:--------:|:----:|
"""
    
    for r in sorted(successful, key=lambda x: -x["abuse_f1"]):
        selected = "✅" if r["model_name"] == best["model_name"] else ""
        md_content += f"| {r['model_name']} | **{r['abuse_recall']*100:.2f}%** | {r['abuse_f1']*100:.2f}% | {selected} |\n"
    
    md_content += f"""
---

## 🎯 {best['model_name']} 선정 이유

### 1. 최고 성능 (선정 기준: Abuse F1)
- **Abuse F1**: {best['abuse_f1']*100:.2f}% (모델 중 1위)
- **Abuse Precision**: {best['abuse_precision']*100:.2f}% · **Recall**: {best['abuse_recall']*100:.2f}%
- **Accuracy**: {best['accuracy']*100:.2f}% · **Clean F1**: {best['clean_f1']*100:.2f}%

> ⚠️ 선정은 Recall이 아니라 **F1 기준**. 단순 Recall 최대 모델은 거의 모든 문장을 욕설로 분류해(Precision↓·오탐↑) 실사용 불가 → 균형 지표로 선정.

### 2. 한국어 혐오 발언 전용
- Smilegate AI의 **한국어 혐오 발언 탐지** 전용 모델, 댓글/채팅 학습 → 게임 대화에 적합

### 3. 다른 모델 한계 — 감정 ≠ 욕설
- 나머지 4종은 모두 **범용 감정모델**이라 "부정 감정"을 "욕설"로 간주 → 과탐(Precision 52~58%).
- clean 234건 중 158~174건을 욕설로 오탐 → 게임에 쓰면 멀쩡한 말에 저주 발동 → 실사용 부적합.

> ℹ️ `beomi/KcELECTRA-base-v2022`는 분류 헤드가 없는 base LM이라 후보 제외(4·5단계 fine-tuning 대상). KoELECTRA 2종은 저장 헤드가 구 형식이라 수동 로드해 실수치 산출.

---

## 📈 시각화

### 모델 비교
![Model Comparison](./6_model_comparison.png)

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
    
    with open(f'{RESULTS_DIR}/benchmark_autogen.md', 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"📝 저장: {RESULTS_DIR}/benchmark_autogen.md (원시 요약 · 큐레이션은 MODEL_BENCHMARK.md)")

# ============================================================
# 🚀 메인
# ============================================================

if __name__ == "__main__":
    print("🎮 게임 STT 데이터 기반 5개 모델 벤치마크")
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
        best = max(successful, key=lambda x: x["abuse_f1"])
        print(f"\n🏆 Best: {best['model_name']} (Abuse F1: {best['abuse_f1']*100:.2f}%)")
    
    # 저장(CSV/JSON/MD) 후, 포트폴리오 차트는 plot_benchmark에서 CSV 기반 렌더(영어+한국어)
    save_results(all_results, len(sentences))
    from plot_benchmark import render_charts
    _csv = os.path.join(RESULTS_DIR, "benchmark_results.csv")
    render_charts(_csv, RESULTS_DIR, lang="en", suffix="")
    render_charts(_csv, RESULTS_DIR, lang="ko", suffix="_ko")
    
    print("\n✅ 벤치마크 완료!")
    print(f"   결과: {RESULTS_DIR}/")
