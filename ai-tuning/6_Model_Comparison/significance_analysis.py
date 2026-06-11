"""
significance_analysis.py — 캐시된 점수로 (재추론 없이):
1) 0.5 vs 0.28에서 상위 모델 Recall/Precision/F1
2) 부트스트랩 95% CI (상위 모델이 통계적으로 동률인지)
실행: cd 6_Model_Comparison && /path/venv/bin/python significance_analysis.py
"""
import os, re, numpy as np, pandas as pd

LABELS = ["여성/가족","남성","성소수자","인종/국적","연령","지역","종교","기타 혐오","악플/욕설","clean"]
HATE = list(range(9))
test = pd.read_csv("../0_Data_Collection/datasets/test_set.tsv", sep="\t")
for c in LABELS: test[c] = pd.to_numeric(test[c], errors="coerce").fillna(0).astype(int)
y = test[LABELS].values
GT = (y[:, HATE].sum(1) > 0).astype(bool)
N = len(GT)

NAMES = ["Baseline","LoRA v2 KcELECTRA","Full v2 KcELECTRA","LoRA v2 kcbert","Full v2 kcbert",
         "LoRA v1 KcELECTRA","Full v1 KcELECTRA","LoRA v1 kcbert","Full v1 kcbert"]
S = {}
for nm in NAMES:
    cf = "results/_robust_scores/" + re.sub(r"[^A-Za-z0-9]", "_", nm) + ".npy"
    if os.path.exists(cf): S[nm] = np.load(cf)

def RPF(sc, thr, idx=None):
    pred = sc > thr; g = GT
    if idx is not None: pred = pred[idx]; g = GT[idx]
    tp = np.sum(pred & g); fp = np.sum(pred & ~g); fn = np.sum(~pred & g)
    p = tp/(tp+fp) if tp+fp else 0.0
    r = tp/(tp+fn) if tp+fn else 0.0
    f = 2*p*r/(p+r) if p+r else 0.0
    return r*100, p*100, f*100

# ── 1) 0.5 vs 0.28 ───────────────────────────────────────────────
print("=== (1) 임계값 0.5 vs 0.28 — Recall / Precision / F1 ===")
print(f"{'모델':<20}{'0.5  R/P/F1':>26}{'0.28  R/P/F1':>26}")
for nm in ["LoRA v2 KcELECTRA","Full v2 KcELECTRA","LoRA v1 KcELECTRA","Full v2 kcbert"]:
    r5,p5,f5 = RPF(S[nm],0.5); r2,p2,f2 = RPF(S[nm],0.28)
    print(f"{nm:<20}{f'{r5:.1f}/{p5:.1f}/{f5:.1f}':>26}{f'{r2:.1f}/{p2:.1f}/{f2:.1f}':>26}")

print("\n  F1 1위 @0.5 :", max(S, key=lambda n: RPF(S[n],0.5)[2]))
print("  F1 1위 @0.28:", max(S, key=lambda n: RPF(S[n],0.28)[2]))
print("  Recall 1위 @0.5 :", max(S, key=lambda n: RPF(S[n],0.5)[0]))
print("  Recall 1위 @0.28:", max(S, key=lambda n: RPF(S[n],0.28)[0]))

# ── 2) 부트스트랩 95% CI ─────────────────────────────────────────
rng = np.random.default_rng(42); B = 4000
def boot(nm, thr):
    out = np.empty(B)
    for b in range(B):
        idx = rng.integers(0, N, N)
        out[b] = RPF(S[nm], thr, idx)[2]
    return out

print("\n=== (2) F1 @0.5 — 95% 부트스트랩 신뢰구간 (n=482) ===")
for nm in ["LoRA v2 KcELECTRA","Full v2 KcELECTRA","LoRA v1 KcELECTRA","Full v2 kcbert"]:
    bf = boot(nm, 0.5)
    print(f"  {nm:<20} F1 {bf.mean():.2f}  95%CI [{np.percentile(bf,2.5):.2f}, {np.percentile(bf,97.5):.2f}]")

# 짝지은 차이 (같은 표본으로 두 모델)
for thr in (0.5, 0.28):
    d = np.empty(B)
    for b in range(B):
        idx = rng.integers(0, N, N)
        d[b] = RPF(S["Full v2 KcELECTRA"], thr, idx)[2] - RPF(S["LoRA v2 KcELECTRA"], thr, idx)[2]
    lo, hi = np.percentile(d, 2.5), np.percentile(d, 97.5)
    sig = "유의 (차이 있음)" if (lo > 0 or hi < 0) else "동률 (CI가 0 포함)"
    print(f"\n  Full v2 - LoRA v2 (F1@{thr}): {d.mean():+.2f}%p, 95%CI [{lo:+.2f}, {hi:+.2f}] → {sig}")
