"""
threshold_free_selection.py — 1단계 베이스 선정을 '임계값과 무관한' 지표로 재평가.

왜: 멀티라벨·불균형 모델을 0.5 한 점의 F1로 '선정'하면 임계값에 휘둘린다.
    선정 기준은 임계값과 무관해야 한다(6단계 LRAP와 같은 원칙).
    → 5종의 '연속 abuse 점수'로 AP(평균정밀도, AUPRC)·AUROC를 재고,
      F1을 0.1~0.9로 sweep해 UnSmile이 운영 임계값 구간에서 우세하고 AP에서 1위임을 확인
      (전 구간 1위는 아님: sweep 상세는 threshold_free_sweep.json 참조).

연속 abuse 점수 정의(모델별 출력 차이를 흡수):
  · UnSmile         : max(sigmoid(logits)[:9])         (not-clean, 9개 혐오 라벨 최대)
  · KoELECTRA B/S   : softmax(head)[negative=idx0]      (P(negative))
  · Korean Sentiment: P(LABEL_0)                        (P(negative))
  · Multilingual    : P(1 star)+P(2 stars)              (P(negative))

실행: cd 1_Model_Selection && /Users/sondahyun/.echoforest_bench_venv/bin/python threshold_free_selection.py
"""
import os, re, json, numpy as np, pandas as pd, torch
import torch.nn as nn
from glob import glob
from transformers import AutoTokenizer, AutoModelForSequenceClassification, ElectraModel, pipeline
from huggingface_hub import hf_hub_download
from sklearn.metrics import average_precision_score, roc_auc_score, precision_recall_fscore_support
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.font_manager as fm
import warnings; warnings.filterwarnings("ignore")

DATA = "../0_Data_Collection/datasets/test_set.tsv"
HATE = ['여성/가족','남성','성소수자','인종/국적','연령','지역','종교','기타 혐오','악플/욕설']
CACHE = "results/_score_cache"; os.makedirs(CACHE, exist_ok=True)
MAXLEN = 128

df = pd.read_csv(DATA, sep='\t')
texts = df['문장'].astype(str).tolist()
for c in HATE: df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0).astype(int)
y = (df[HATE].values.sum(1) > 0).astype(int)
print(f"[data] {len(texts)}문장  abuse={y.sum()} clean={(1-y).sum()}")

def cached(name, fn):
    p = os.path.join(CACHE, re.sub(r'[^A-Za-z0-9]', '_', name) + '.npy')
    if os.path.exists(p):
        print(f"[cache] {name}")
        return np.load(p)
    print(f"[infer] {name} ...")
    s = fn(); np.save(p, s); return s

def score_unsmile():
    tok = AutoTokenizer.from_pretrained("smilegate-ai/kor_unsmile")
    m = AutoModelForSequenceClassification.from_pretrained("smilegate-ai/kor_unsmile").eval()
    out = []
    with torch.no_grad():
        for i, t in enumerate(texts):
            x = tok(t, return_tensors="pt", truncation=True, max_length=MAXLEN)
            p = torch.sigmoid(m(**x).logits[0]).numpy()
            out.append(float(p[:9].max()))
            if i % 120 == 0: print(f"    {i}/{len(texts)}", end="\r")
    return np.array(out)

def score_koelectra(mid):
    tok = AutoTokenizer.from_pretrained(mid)
    enc = ElectraModel.from_pretrained(mid).eval()
    sd = torch.load(hf_hub_download(mid, "pytorch_model.bin"), map_location="cpu", weights_only=True)
    head = nn.Linear(enc.config.hidden_size, sd["classifier.weight"].shape[0])
    head.weight.data = sd["classifier.weight"]; head.bias.data = sd["classifier.bias"]; head.eval()
    out = []
    with torch.no_grad():
        for i, t in enumerate(texts):
            x = tok(t, return_tensors="pt", truncation=True, max_length=MAXLEN)
            pooled = enc(**x).last_hidden_state[:, 0]
            p = torch.softmax(head(pooled)[0], dim=-1).numpy()
            out.append(float(p[0]))   # idx0 = negative
            if i % 120 == 0: print(f"    {i}/{len(texts)}", end="\r")
    return np.array(out)

def score_pipe(mid, neg_labels):
    clf = pipeline("sentiment-analysis", model=mid)
    out = []
    for i, t in enumerate(texts):
        scores = clf(t, top_k=None, truncation=True, max_length=MAXLEN)
        s = sum(d['score'] for d in scores if d['label'] in neg_labels)
        out.append(float(s))
        if i % 120 == 0: print(f"    {i}/{len(texts)}", end="\r")
    return np.array(out)

MODELS = [
    ("UnSmile",          lambda: score_unsmile()),
    ("Korean Sentiment", lambda: score_pipe("matthewburke/korean_sentiment", {"LABEL_0"})),
    ("KoELECTRA Base",   lambda: score_koelectra("monologg/koelectra-base-finetuned-sentiment")),
    ("KoELECTRA Small",  lambda: score_koelectra("monologg/koelectra-small-finetuned-sentiment")),
    ("Multilingual",     lambda: score_pipe("nlptown/bert-base-multilingual-uncased-sentiment", {"1 star", "2 stars"})),
]

THRS = np.round(np.arange(0.10, 0.91, 0.05), 2)
rows, curves, scores = [], {}, {}
for name, fn in MODELS:
    s = cached(name, fn); scores[name] = s
    ap = average_precision_score(y, s) * 100
    auc = roc_auc_score(y, s) * 100
    f1s = []
    for t in THRS:
        _, _, f, _ = precision_recall_fscore_support(y, (s > t).astype(int), average="binary", zero_division=0)
        f1s.append(round(float(f) * 100, 2))
    curves[name] = f1s
    i5 = int(np.argmin(np.abs(THRS - 0.5)))
    bi = int(np.argmax(f1s))
    rows.append(dict(model=name, AP=round(ap, 2), AUROC=round(auc, 2),
                     F1_at_0_5=f1s[i5], F1_max=f1s[bi], F1_max_thr=float(THRS[bi])))
    print(f"  {name:<18} AP={ap:5.2f}  AUROC={auc:5.2f}  F1@0.5={f1s[i5]:5.2f}  F1max={f1s[bi]:5.2f}@{THRS[bi]}")

rows = sorted(rows, key=lambda r: -r['AP'])
pd.DataFrame(rows).to_csv("results/threshold_free_selection.csv", index=False, encoding="utf-8-sig")
json.dump(rows, open("results/threshold_free_selection.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("\n=== AP(임계값 무관) 랭킹 ===")
for r in rows: print(f"  {r['model']:<18} AP={r['AP']}  (F1@0.5={r['F1_at_0_5']}, F1max={r['F1_max']}@{r['F1_max_thr']})")

# AP에서 UnSmile이 매 임계값 sweep 1위인지 검증
sweep_winner_unsmile = all(
    max(curves, key=lambda n: curves[n][i]) == "UnSmile" for i in range(len(THRS))
)
print(f"\n[검증] UnSmile이 모든 임계값에서 F1 1위? {sweep_winner_unsmile}")
json.dump({"thresholds": [float(t) for t in THRS], "curves": curves,
           "unsmile_wins_all_thresholds": bool(sweep_winner_unsmile)},
          open("results/threshold_free_sweep.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("saved results/threshold_free_selection.{csv,json} + threshold_free_sweep.json")
