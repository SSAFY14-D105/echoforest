"""
quant_not_clean.py — 양자화 지표를 not-clean('clean이 아니면 부정어') 규칙으로 재계산.
- 원본(best_model) / INT8(quantize_dynamic 재생성) / FP16(fp16_model) 추론
- abuse = max(clean 제외 9개 라벨) > 0.5
- 크기·속도는 그대로 두고 지표/혼동행렬/threshold_calibration만 갱신
- threshold_sweep.csv(INT8 not-clean) 갱신 → plot_quantization_figures_ko.py가 차트 재생성
실행: cd 8_Quantization && /path/venv/bin/python quant_not_clean.py
"""
import json, platform, numpy as np, pandas as pd, torch
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix
import warnings; warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]; HERE = Path(__file__).resolve().parent
MODEL_PATH = ROOT/"5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model"
TEST = ROOT/"0_Data_Collection/datasets/test_set.tsv"
VALID = ROOT/"3_UnSmile_Correction/unsmile_valid_corrected.tsv"
FP16_DIR = HERE/"fp16_model"; RES = HERE/"results"
LABELS = ["여성/가족","남성","성소수자","인종/국적","연령","지역","종교","기타 혐오","악플/욕설","clean"]
HATE = list(range(9)); MAXLEN = 128; BS = 32

mach = platform.machine().lower()
for e in (["qnnpack","fbgemm","x86","onednn"] if "arm" in mach else ["fbgemm","x86","qnnpack","onednn"]):
    if e in torch.backends.quantized.supported_engines:
        torch.backends.quantized.engine = e; break

def load(p):
    df = pd.read_csv(p, sep="\t")
    for c in LABELS: df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    return df

def probs_of(model, tok, texts):
    out = []; model.eval()
    with torch.no_grad():
        for i in range(0, len(texts), BS):
            enc = tok(texts[i:i+BS], return_tensors="pt", padding=True, truncation=True, max_length=MAXLEN)
            out.append(torch.sigmoid(model(**enc).logits.float()).cpu().numpy())
            print(f"  {i}/{len(texts)}", end="\r")
    return np.vstack(out)

def nc_at(probs, labels, thr):
    pred = (probs > thr).astype(int)
    ag = (labels[:, HATE].sum(1) > 0).astype(int); ap = (pred[:, HATE].sum(1) > 0).astype(int)
    p, r, f, _ = precision_recall_fscore_support(ag, ap, average="binary", zero_division=0)
    return float(p), float(r), float(f)

def nc_eval(probs, labels, thr=0.5):
    pred = (probs > thr).astype(int)
    ag = (labels[:, HATE].sum(1) > 0).astype(int); ap = (pred[:, HATE].sum(1) > 0).astype(int)
    cg = 1-ag; cp = 1-ap
    apr, arc, af, _ = precision_recall_fscore_support(ag, ap, average="binary", zero_division=0)
    cpr, crc, cf, _ = precision_recall_fscore_support(cg, cp, average="binary", zero_division=0)
    tn, fp, fn, tp = confusion_matrix(ag, ap).ravel()
    return dict(abuse_precision=round(float(apr),4), abuse_recall=round(float(arc),4), abuse_f1=round(float(af),4),
                clean_precision=round(float(cpr),4), clean_recall=round(float(crc),4), clean_f1=round(float(cf),4),
                tp=int(tp), tn=int(tn), fp=int(fp), fn=int(fn),
                confusion_matrix=[[int(tn),int(fp)],[int(fn),int(tp)]], threshold=round(float(thr),4))

tok = AutoTokenizer.from_pretrained(MODEL_PATH)
orig = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH).eval()
int8 = torch.ao.quantization.quantize_dynamic(orig, {torch.nn.Linear}, dtype=torch.qint8).eval()
try:
    fp16 = AutoModelForSequenceClassification.from_pretrained(FP16_DIR).eval()
    _ = fp16(**tok("테스트", return_tensors="pt", truncation=True, max_length=8)).logits  # smoke
    fp16_ok = True
except Exception as ex:
    print("fp16 추론 불가 -> 원본과 동일로 처리:", ex); fp16_ok = False

print("[infer] test_set original/int8/fp16")
test = load(TEST); y = test[LABELS].values; txt = test["문장"].astype(str).tolist()
po = probs_of(orig, tok, txt); pi = probs_of(int8, tok, txt)
ro = nc_eval(po, y); ri = nc_eval(pi, y)
rf = nc_eval(probs_of(fp16, tok, txt), y) if fp16_ok else dict(ro)

print(f"\noriginal not-clean: R={ro['abuse_recall']} P={ro['abuse_precision']} F1={ro['abuse_f1']}  (tp{ro['tp']} fp{ro['fp']} fn{ro['fn']})")
print(f"INT8     not-clean: R={ri['abuse_recall']} P={ri['abuse_precision']} F1={ri['abuse_f1']}  (tp{ri['tp']} fp{ri['fp']} fn{ri['fn']})")
print(f"FP16     not-clean: R={rf['abuse_recall']} P={rf['abuse_precision']} F1={rf['abuse_f1']}")

print("\n[infer] INT8 valid (not-clean F1-max threshold)")
valid = load(VALID); yv = valid[LABELS].values
pv = probs_of(int8, tok, valid["문장"].astype(str).tolist())
sel = max(np.round(np.arange(0.1,0.91,0.01),2), key=lambda thr: nc_at(pv, yv, thr)[2])
ptp, ptr, ptf = nc_at(pi, y, float(sel))
print(f"INT8 not-clean valid F1-max threshold = {sel}  -> game test R={ptr:.4f} F1={ptf:.4f}")

# threshold_sweep.csv (INT8 not-clean, game test)
rows = []
for thr in np.round(np.arange(0.1,0.91,0.02),2):
    p, r, f = nc_at(pi, y, float(thr)); rows.append({"threshold":float(thr),"precision":round(p,4),"recall":round(r,4),"f1":round(f,4)})
pd.DataFrame(rows).to_csv(RES/"threshold_sweep.csv", index=False, encoding="utf-8-sig")

# update quantization_report.json (지표만; 크기·속도 보존)
rep = json.load(open(RES/"quantization_report.json", encoding="utf-8"))
rep["performance"]["original"].update(ro)
rep["performance"]["int8_dynamic"].update(ri)
rep["performance"]["fp16"].update(rf)
rep.setdefault("threshold_calibration", {})
rep["threshold_calibration"]["selected_threshold"] = float(sel)
rep["threshold_calibration"]["test_recall"] = round(float(ptr),4)
rep["threshold_calibration"]["test_f1"] = round(float(ptf),4)
rep["abuse_definition"] = "not-clean (max of 9 hate labels > 0.5)"
json.dump(rep, open(RES/"quantization_report.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
print("\nreport + threshold_sweep.csv 갱신 완료")
