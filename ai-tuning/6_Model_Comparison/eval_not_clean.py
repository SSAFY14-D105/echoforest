"""
eval_not_clean.py — 배포 규칙('clean이 아니면 부정어')으로 최종 모델을 평가한다.

목적
- 평가 규칙을 배포 규칙과 일치시킨다: abuse = NOT clean = (10개 라벨 중 clean 빼고 하나라도 > 0.5)
- 두 셋으로 나눠 본다.
  1) 게임 test_set(482, 욕설/clean): index8 규칙 vs not-clean 규칙 비교 → 카테고리가 clean에 헛점화하는지(정밀도) 확인.
  2) unsmile valid(3663, 전 라벨): 그룹 혐오(성별/지역/종교 등) 탐지 성능 → not-clean + 카테고리별 recall.

모델: Full v2 KcELECTRA best_model (로컬 토크나이저로 오프라인 로드)
실행: cd 6_Model_Comparison && python eval_not_clean.py
"""
import os, numpy as np, pandas as pd, torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics import precision_recall_fscore_support

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo 루트
LABELS = ["여성/가족","남성","성소수자","인종/국적","연령","지역","종교","기타 혐오","악플/욕설","clean"]
HATE = list(range(9))          # clean(9) 제외한 9개
IDX8 = 8                       # 악플/욕설
MODEL = os.path.join(ROOT, "5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model")
DEV = torch.device("cpu"); MAXLEN = 128
THR = 0.5                      # 카테고리 라벨 기준(원하면 index8만 따로 낮춰 실험)

print(f"[load] {MODEL}")
tok = AutoTokenizer.from_pretrained(MODEL)                       # 로컬 토크나이저(오프라인)
model = AutoModelForSequenceClassification.from_pretrained(MODEL).to(DEV).eval()

def infer(texts):
    P = []
    with torch.no_grad():
        for i, s in enumerate(texts):
            x = tok(str(s), return_tensors="pt", truncation=True, max_length=MAXLEN).to(DEV)
            P.append(torch.sigmoid(model(**x).logits[0]).cpu().numpy())
            if i % 200 == 0: print(f"  infer {i}/{len(texts)}", end="\r")
    return np.array(P)

def prf(gt, pred):
    p, r, f, _ = precision_recall_fscore_support(gt, pred, average="binary", zero_division=0)
    return p, r, f

def load(path):
    df = pd.read_csv(path, sep="\t")
    for c in LABELS: df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    return df

# ── 1) 게임 test_set ────────────────────────────────────────────────
t = load(os.path.join(ROOT, "0_Data_Collection/datasets/test_set.tsv"))
y = t[LABELS].values
preds = (infer(t["문장"]) > THR).astype(int)

gt_idx8     = y[:, IDX8]
gt_notclean = (y[:, HATE].sum(1) > 0).astype(int)
pr_idx8     = preds[:, IDX8]
pr_notclean = (preds[:, HATE].sum(1) > 0).astype(int)

print("\n=== 1) 게임 test_set (482) ===")
print(f"  GT: index8={int(gt_idx8.sum())},  not-clean={int(gt_notclean.sum())}  (카테고리 0건이라 같아야 정상)")
for name, gt, pd_ in [("index8 규칙", gt_idx8, pr_idx8), ("not-clean 규칙", gt_notclean, pr_notclean)]:
    p, r, f = prf(gt, pd_)
    print(f"  [{name:<12}] P={p:.4f}  R={r:.4f}  F1={f:.4f}")
clean_mask = (y[:, 9] == 1)
extra_fp = int((clean_mask & (pr_idx8 == 0) & (pr_notclean == 1)).sum())
print(f"  → not-clean이 추가한 FP(clean인데 카테고리 라벨 발화): {extra_fp}건 / clean {int(clean_mask.sum())}건")
if extra_fp:
    ex = t["문장"][clean_mask & (pr_idx8 == 0) & (pr_notclean == 1)].head(8).tolist()
    for s in ex: print(f"      · {s[:60]}")

# ── 2) unsmile valid (그룹 혐오 평가) ───────────────────────────────
u = load(os.path.join(ROOT, "3_UnSmile_Correction/unsmile_valid_corrected.tsv"))
yu = u[LABELS].values
pu = (infer(u["문장"]) > THR).astype(int)
gt_nc = (yu[:, HATE].sum(1) > 0).astype(int)
pr_nc = (pu[:, HATE].sum(1) > 0).astype(int)
p, r, f = prf(gt_nc, pr_nc)
print("\n=== 2) unsmile valid (3663): not-clean = 그룹 혐오 포함 전체 부정 ===")
print(f"  [not-clean] P={p:.4f}  R={r:.4f}  F1={f:.4f}   (부정 GT {int(gt_nc.sum())}건)")
print("  카테고리별 recall (이 모델이 그룹 혐오를 실제로 잡는지):")
for j in HATE:
    m = yu[:, j] == 1
    if m.sum() > 0:
        rec = (pu[m, j] == 1).mean()
        print(f"    {LABELS[j]:<8}: recall {rec:.3f}  (n={int(m.sum())})")
print("\n해석: 게임셋은 index8과 not-clean이 거의 동일(그룹 혐오 0건). "
      "그룹 혐오 탐지력은 unsmile 카테고리별 recall로 판단한다.")
