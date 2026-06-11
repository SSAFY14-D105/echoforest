"""
6_Model_Comparison — 9개 모델 비교 (not-clean 규칙)
=============================================================================
- abuse 판정 = 'clean이 아니면 부정어' = (clean 제외 9개 라벨 중 max > 0.5) — 배포 규칙과 동일
- GT abuse  = (9개 혐오 라벨 중 하나라도 1)  (게임셋은 카테고리 0이라 index8과 동일 GT)
- 비교용 threshold는 0.5 고정(모델 공정 비교). 운영 임계값(~0.28)은 별도.
- 지표/출력 포맷은 compare_models.py와 동일 → plot_comparison.py가 그대로 차트 생성
사용: cd 6_Model_Comparison && python compare_models.py
"""
import os, json, torch, numpy as np, pandas as pd
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics import precision_recall_fscore_support, label_ranking_average_precision_score, confusion_matrix
import warnings; warnings.filterwarnings("ignore")

DEVICE = torch.device("cpu")
MAX_LEN = 128
LABEL_NAMES = ["여성/가족","남성","성소수자","인종/국적","연령","지역","종교","기타 혐오","악플/욕설","clean"]
HATE = list(range(9))                  # clean(9) 제외
RESULTS = "results"; os.makedirs(RESULTS, exist_ok=True)

BASE_TOK = {"kcelectra": "beomi/KcELECTRA-base-v2022", "kcbert": "beomi/kcbert-base", "unsmile": "smilegate-ai/kor_unsmile"}
L = "../4_LoRA_Fine_Tuning"; F = "../5_Full_Fine_Tuning"
MODELS = {
    "Baseline":          ("smilegate-ai/kor_unsmile", "unsmile"),
    "LoRA v1 Game":      (f"{L}/v1_corrected_only/output/lora_game_kcelectra/merged_model", "kcelectra"),
    "LoRA v1 Tutorial":  (f"{L}/v1_corrected_only/output/lora_tutorial_kcbert/merged_model", "kcbert"),
    "LoRA v2 Game":      (f"{L}/v2_corrected_plus_collected/output/lora_game_kcelectra_v2/merged_model", "kcelectra"),
    "LoRA v2 Tutorial":  (f"{L}/v2_corrected_plus_collected/output/lora_tutorial_kcbert_v2/merged_model", "kcbert"),
    "Full v1 Game":      (f"{F}/v1_corrected_only/output/full_game_kcelectra/best_model", "kcelectra"),
    "Full v1 Tutorial":  (f"{F}/v1_corrected_only/output/full_tutorial_kcbert/best_model", "kcbert"),
    "Full v2 Game":      (f"{F}/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model", "kcelectra"),
    "Full v2 Tutorial":  (f"{F}/v2_corrected_plus_collected/output/full_tutorial_kcbert_v2/best_model", "kcbert"),
}

test = pd.read_csv("../0_Data_Collection/datasets/test_set.tsv", sep="\t")
for c in LABEL_NAMES:
    test[c] = pd.to_numeric(test[c], errors="coerce").fillna(0).astype(int)
labels = test[LABEL_NAMES].values
abuse_gt = (labels[:, HATE].sum(1) > 0).astype(int)
clean_gt = 1 - abuse_gt
print(f"test_set: {len(test)}  not-clean(abuse): {int(abuse_gt.sum())}  clean: {int(clean_gt.sum())}")

def evaluate(name, path, tok_key):
    tok = AutoTokenizer.from_pretrained(BASE_TOK[tok_key])
    model = AutoModelForSequenceClassification.from_pretrained(path).to(DEVICE).eval()
    probs = []
    with torch.no_grad():
        for i, s in enumerate(test["문장"].astype(str)):
            x = tok(s, return_tensors="pt", truncation=True, max_length=MAX_LEN).to(DEVICE)
            probs.append(torch.sigmoid(model(**x).logits[0]).cpu().numpy())
            if i % 120 == 0: print(f"  {name}: {i}/{len(test)}", end="\r")
    probs = np.array(probs); preds = (probs > 0.5).astype(int)
    abuse_pred = (preds[:, HATE].sum(1) > 0).astype(int)   # not-clean
    clean_pred = 1 - abuse_pred
    ap, ar, af, _ = precision_recall_fscore_support(abuse_gt, abuse_pred, average="binary", zero_division=0)
    cp, cr, cf, _ = precision_recall_fscore_support(clean_gt, clean_pred, average="binary", zero_division=0)
    lrap = label_ranking_average_precision_score(labels, probs)
    tn, fp, fn, tp = confusion_matrix(abuse_gt, abuse_pred).ravel()
    del model
    return dict(model=name, lrap=round(float(lrap),4),
               abuse_precision=round(float(ap),4), abuse_recall=round(float(ar),4), abuse_f1=round(float(af),4),
               clean_precision=round(float(cp),4), clean_recall=round(float(cr),4), clean_f1=round(float(cf),4),
               tp=int(tp), tn=int(tn), fp=int(fp), fn=int(fn))

rows = []
for name, (path, tok_key) in MODELS.items():
    print(f"\n[{name}] {path}")
    try:
        r = evaluate(name, path, tok_key); rows.append(r)
        print(f"  OK Abuse R={r['abuse_recall']:.4f} F1={r['abuse_f1']:.4f} P={r['abuse_precision']:.4f} LRAP={r['lrap']:.4f}")
    except Exception as e:
        print(f"  ERROR: {e}"); rows.append(dict(model=name, error=str(e)))

df = pd.DataFrame([r for r in rows if "error" not in r])
base = df[df["model"]=="Baseline"].iloc[0]
df["abuse_r_vs_base_pp"] = ((df["abuse_recall"] - base["abuse_recall"]) * 100).round(2)
df = df.sort_values("abuse_recall", ascending=False).reset_index(drop=True)
df.to_csv(f"{RESULTS}/comparison_results.csv", index=False, encoding="utf-8-sig")
json.dump({"test_n": len(test), "abuse_definition": "not-clean (max of 9 hate labels > 0.5)", "results": rows},
          open(f"{RESULTS}/comparison_results.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)

print("\n" + "="*64)
print(f"{'Model':<20}{'Abuse R':>9}{'Abuse F1':>10}{'Precision':>11}{'LRAP':>8}{'vs base':>9}")
for _, r in df.iterrows():
    print(f"{r['model']:<20}{r['abuse_recall']*100:>8.2f}%{r['abuse_f1']*100:>9.2f}%{r['abuse_precision']*100:>10.2f}%{r['lrap']:>8.3f}{r['abuse_r_vs_base_pp']:>+8.1f}p")
best = df.iloc[0]
print(f"\nBest Abuse Recall: {best['model']}  {best['abuse_recall']*100:.2f}%  (baseline {base['abuse_recall']*100:.2f}% -> +{(best['abuse_recall']-base['abuse_recall'])*100:.1f}p)")
