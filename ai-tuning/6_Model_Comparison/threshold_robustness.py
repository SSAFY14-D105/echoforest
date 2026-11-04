"""
threshold_robustness.py — 9개 모델을 임계값 0.1~0.9로 sweep.
목적: "0.5 한 점 비교"가 임계값에 휘둘리는지(공정한지) 검증.
- abuse 점수 = not-clean (clean 제외 9개 라벨 max)
- 각 임계값에서 abuse F1 → 모델별 곡선 + 임계값별 순위
- 모델별 max_score를 .npy로 캐시(재실행 빠름)
실행: cd 6_Model_Comparison && /path/venv/bin/python threshold_robustness.py
"""
import os, re, numpy as np, pandas as pd, torch
from glob import glob
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics import precision_recall_fscore_support
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.font_manager as fm
import warnings; warnings.filterwarnings("ignore")

DEVICE = torch.device("cpu"); MAX_LEN = 128
LABELS = ["여성/가족","남성","성소수자","인종/국적","연령","지역","종교","기타 혐오","악플/욕설","clean"]
HATE = list(range(9))
BASE_TOK = {"kcelectra":"beomi/KcELECTRA-base-v2022","kcbert":"beomi/kcbert-base","unsmile":"smilegate-ai/kor_unsmile"}
L = "../4_LoRA_Fine_Tuning"; F = "../5_Full_Fine_Tuning"
MODELS = {
    "Baseline":          ("smilegate-ai/kor_unsmile", "unsmile"),
    "LoRA v2 KcELECTRA": (f"{L}/v2_corrected_plus_collected/output/lora_game_kcelectra_v2/merged_model", "kcelectra"),
    "LoRA v2 kcbert":    (f"{L}/v2_corrected_plus_collected/output/lora_tutorial_kcbert_v2/merged_model", "kcbert"),
    "Full v2 KcELECTRA": (f"{F}/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model", "kcelectra"),
    "Full v2 kcbert":    (f"{F}/v2_corrected_plus_collected/output/full_tutorial_kcbert_v2/best_model", "kcbert"),
    "LoRA v1 KcELECTRA": (f"{L}/v1_corrected_only/output/lora_game_kcelectra/merged_model", "kcelectra"),
    "LoRA v1 kcbert":    (f"{L}/v1_corrected_only/output/lora_tutorial_kcbert/merged_model", "kcbert"),
    "Full v1 KcELECTRA": (f"{F}/v1_corrected_only/output/full_game_kcelectra/best_model", "kcelectra"),
    "Full v1 kcbert":    (f"{F}/v1_corrected_only/output/full_tutorial_kcbert/best_model", "kcbert"),
}
CACHE = "results/_robust_scores"; os.makedirs(CACHE, exist_ok=True)

test = pd.read_csv("../0_Data_Collection/datasets/test_set.tsv", sep="\t")
for c in LABELS: test[c] = pd.to_numeric(test[c], errors="coerce").fillna(0).astype(int)
labels = test[LABELS].values
abuse_gt = (labels[:, HATE].sum(1) > 0).astype(int)
texts = test["문장"].astype(str).tolist()

def max_scores(name, path, tok_key):
    cf = os.path.join(CACHE, re.sub(r"[^A-Za-z0-9]", "_", name) + ".npy")
    if os.path.exists(cf): return np.load(cf)
    tok = AutoTokenizer.from_pretrained(BASE_TOK[tok_key])
    model = AutoModelForSequenceClassification.from_pretrained(path).to(DEVICE).eval()
    out = []
    with torch.no_grad():
        for i, s in enumerate(texts):
            x = tok(s, return_tensors="pt", truncation=True, max_length=MAX_LEN)
            p = torch.sigmoid(model(**x).logits[0]).cpu().numpy()
            out.append(float(p[HATE].max()))
            if i % 160 == 0: print(f"    {i}/{len(texts)}", end="\r")
    del model
    arr = np.array(out); np.save(cf, arr); return arr

THRS = np.round(np.arange(0.10, 0.91, 0.05), 2)
curves = {}; best = {}
for name, (path, tk) in MODELS.items():
    print(f"[{name}]")
    sc = max_scores(name, path, tk)
    f1s = []
    for t in THRS:
        pred = (sc > t).astype(int)
        _, _, f, _ = precision_recall_fscore_support(abuse_gt, pred, average="binary", zero_division=0)
        f1s.append(round(float(f)*100, 2))
    curves[name] = f1s
    bi = int(np.argmax(f1s)); best[name] = (float(THRS[bi]), f1s[bi])
    i05 = int(np.argmin(np.abs(THRS - 0.5)))
    print(f"  F1@0.5={f1s[i05]:.2f}  |  F1-max @ τ={THRS[bi]} = {f1s[bi]:.2f}")

# 저장 먼저 (출력 전에)
pd.DataFrame(curves, index=THRS).rename_axis("threshold").to_csv("results/threshold_robustness_f1.csv", encoding="utf-8-sig")

# 차트: CSV를 읽어 그리는 plot_threshold_robustness_ko.py에 맡김(재추론 없이 차트만 다시 그릴 수 있게)
import runpy; runpy.run_path("plot_threshold_robustness_ko.py", run_name="__main__")
print("saved results/threshold_robustness_f1.csv")

# 순위 출력 (버그 수정: lst[i])
print("\n=== 임계값별 abuse F1 순위 (상위 3) ===")
for i, t in enumerate(THRS):
    rk = sorted(curves.items(), key=lambda kv: kv[1][i], reverse=True)[:3]
    print(f"  τ={t:.2f}: " + " > ".join(f"{n}({lst[i]:.1f})" for n, lst in rk))

print("\n=== 모델별 F1 최적 임계값 ===")
for n, (t, v) in sorted(best.items(), key=lambda kv: -kv[1][1]):
    print(f"  {n:<20} F1-max {v:.2f} @ τ={t}")
