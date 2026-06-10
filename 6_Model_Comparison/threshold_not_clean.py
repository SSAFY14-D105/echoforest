"""
threshold_not_clean.py — 'clean이 아니면 부정어'(not-clean) 규칙의 운영 임계값 탐색.

규칙: abuse = max(clean 제외 9개 라벨 확률) > τ
출력:
  1) game test_set(482)에서 τ별 not-clean P/R/F1 + clean 헛점화 FP (운영 곡선)
  2) 누수 없는 추정: unsmile valid(학습에 안 쓴 평가셋)에서 F1-max τ를 고른 뒤 game test에 적용
  3) 게임은 오탐(가짜 저주)이 치명적 → precision>=0.90 유지하는 최저 τ도 함께 표시
모델: Full v2 KcELECTRA best_model
실행: cd 6_Model_Comparison && /path/to/venv/bin/python threshold_not_clean.py
"""
import os, numpy as np, pandas as pd, torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics import precision_recall_fscore_support

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LABELS = ["여성/가족","남성","성소수자","인종/국적","연령","지역","종교","기타 혐오","악플/욕설","clean"]
HATE = list(range(9))
MODEL = os.path.join(ROOT, "5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model")
DEV = torch.device("cpu"); MAXLEN = 128

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSequenceClassification.from_pretrained(MODEL).to(DEV).eval()

def infer(texts):
    P = []
    with torch.no_grad():
        for i, s in enumerate(texts):
            x = tok(str(s), return_tensors="pt", truncation=True, max_length=MAXLEN).to(DEV)
            P.append(torch.sigmoid(model(**x).logits[0]).cpu().numpy())
            if i % 400 == 0: print(f"  infer {i}/{len(texts)}", end="\r")
    return np.array(P)

def load(p):
    df = pd.read_csv(p, sep="\t")
    for c in LABELS: df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    return df

def nc(probs, y, thr):
    pred = (probs[:, HATE].max(1) > thr).astype(int)
    gt   = (y[:, HATE].sum(1) > 0).astype(int)
    p, r, f, _ = precision_recall_fscore_support(gt, pred, average="binary", zero_division=0)
    return p, r, f

# 데이터 + 추론
print("[infer] game test_set"); tt = load(os.path.join(ROOT, "0_Data_Collection/datasets/test_set.tsv"))
yt = tt[LABELS].values; pt = infer(tt["문장"])
print("[infer] unsmile valid"); uu = load(os.path.join(ROOT, "3_UnSmile_Correction/unsmile_valid_corrected.tsv"))
yu = uu[LABELS].values; pu = infer(uu["문장"])

grid = np.round(np.arange(0.05, 0.96, 0.05), 2)
fine = np.round(np.arange(0.05, 0.96, 0.01), 2)

# 1) game test 운영 곡선
print("\n=== 1) game test_set — not-clean τ 운영 곡선 ===")
print(f"{'τ':>6}{'P':>9}{'R':>9}{'F1':>9}{'clean헛FP':>10}")
clean_mask = (yt[:, 9] == 1)
for thr in grid:
    p, r, f = nc(pt, yt, thr)
    pred = (pt[:, HATE].max(1) > thr)
    fp = int((clean_mask & pred).sum())
    print(f"{thr:>6}{p:>9.3f}{r:>9.3f}{f:>9.3f}{fp:>10}")

gt_f1 = max(fine, key=lambda thr: nc(pt, yt, thr)[2])
p, r, f = nc(pt, yt, gt_f1)
print(f"\n  game test F1-max τ = {gt_f1}  →  P={p:.3f} R={r:.3f} F1={f:.3f}  (test 직접최적, 누수 주의)")

# precision>=0.90 유지하는 가장 낮은 τ (recall 최대화)
cand = [(thr,)+nc(pt, yt, thr) for thr in fine]
pp = [c for c in cand if c[1] >= 0.90]
if pp:
    best_p90 = min(pp, key=lambda c: c[0])
    print(f"  precision>=0.90 유지 최저 τ = {best_p90[0]}  →  P={best_p90[1]:.3f} R={best_p90[2]:.3f} F1={best_p90[3]:.3f}")

# 2) 누수 없는 추정: unsmile valid에서 τ 고르고 game test에 적용
uv_f1 = max(fine, key=lambda thr: nc(pu, yu, thr)[2])
pv, rv, fv = nc(pu, yu, uv_f1)
pa, ra, fa = nc(pt, yt, uv_f1)
print("\n=== 2) 누수 없는 교차검증 (unsmile 학습에 안 쓴 평가셋에서 τ 선택 → game 적용) ===")
print(f"  unsmile valid F1-max τ = {uv_f1}  (valid: P={pv:.3f} R={rv:.3f} F1={fv:.3f})")
print(f"  → 그 τ를 game test에 적용:  P={pa:.3f} R={ra:.3f} F1={fa:.3f}")
print(f"\n  비교용 고정 0.5: " + "P={:.3f} R={:.3f} F1={:.3f}".format(*nc(pt, yt, 0.5)))
