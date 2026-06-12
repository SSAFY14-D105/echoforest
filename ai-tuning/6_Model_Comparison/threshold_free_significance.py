"""
threshold_free_significance.py — 임계값 무관 지표(AP·AUROC) + 유의성 검정 산출/저장.

왜: 6단계 선정 근거를 LRAP 하나에 의존하지 않게 한다.
  - LRAP는 이 test_set에서 활성 라벨이 1개(악플/욕설)뿐이라 사실상 이진 지표로 동작 → 변별력 약함.
  - 대신 not-clean 점수(9개 라벨 max)로 AP(평균정밀도)·AUROC를 재면 "임계값과 무관한" 공정 비교가 된다(Step 1 AP와 같은 철학).
  - 상위 2개가 '사실상 동률'이라는 주장을 McNemar 검정 + 부트스트랩 CI로 측정해 파일로 남긴다.

입력: results/_robust_scores/<model>.npy  (compare_models.py가 캐시한 예제별 not-clean 점수)
출력:
  - results/threshold_free_significance.json   (AP/AUROC 9개 + McNemar + 부트스트랩)
  - results/comparison_results.json / .csv 에 ap·auroc 컬럼 주입
의존성 없음(순수 파이썬). 재추론 불필요, 캐시 점수만 사용. 부트스트랩 시드 고정(42).
실행: cd 6_Model_Comparison && python threshold_free_significance.py
"""
import struct, ast, csv, json, math, random
from pathlib import Path

HERE = Path(__file__).resolve().parent
RES = HERE / "results"
TEST = HERE.parent / "0_Data_Collection/datasets/test_set.tsv"

def load_npy(path):
    with open(path, "rb") as f:
        assert f.read(6) == b"\x93NUMPY"
        major = f.read(1); f.read(1)
        hlen = int.from_bytes(f.read(2 if major == b"\x01" else 4), "little")
        hdr = ast.literal_eval(f.read(hlen).decode("latin1").strip())
        data = f.read()
    d = hdr["descr"]
    if d in ("<f8", "|f8", "float64"): return list(struct.unpack("<%dd" % (len(data) // 8), data))
    if d in ("<f4", "float32"):        return list(struct.unpack("<%df" % (len(data) // 4), data))
    raise ValueError(d)

# 정답 라벨: abuse = not-clean(clean==0)
with open(TEST, encoding="utf-8") as f:
    rows = list(csv.DictReader(f, delimiter="\t"))
y = [1 if int(float(r["clean"])) == 0 else 0 for r in rows]
P = sum(y); N = len(y) - P

def ap_score(s, y):
    order = sorted(range(len(s)), key=lambda i: s[i], reverse=True)
    tp = fp = 0; ap = 0.0; prev = 0.0; tot = sum(y)
    for i in order:
        if y[i]: tp += 1
        else: fp += 1
        rec = tp / tot; prec = tp / (tp + fp)
        ap += (rec - prev) * prec; prev = rec
    return ap

def auroc(s, y):
    n = len(s); order = sorted(range(n), key=lambda i: s[i]); ranks = [0.0] * n; i = 0
    while i < n:
        j = i
        while j < n and s[order[j]] == s[order[i]]: j += 1
        avg = (i + 1 + j) / 2.0
        for k in range(i, j): ranks[order[k]] = avg
        i = j
    pos = sum(y); neg = n - pos
    sr = sum(ranks[i] for i in range(n) if y[i])
    return (sr - pos * (pos + 1) / 2.0) / (pos * neg)

# 표시명(KcELECTRA/kcbert) = 캐시 파일명
MODELS = ["Baseline", "LoRA v1 KcELECTRA", "LoRA v1 kcbert", "LoRA v2 KcELECTRA", "LoRA v2 kcbert",
          "Full v1 KcELECTRA", "Full v1 kcbert", "Full v2 KcELECTRA", "Full v2 kcbert"]
S = {m: load_npy(RES / "_robust_scores" / (m.replace(" ", "_") + ".npy")) for m in MODELS}

ap_auroc = {m: {"ap": round(ap_score(S[m], y) * 100, 2), "auroc": round(auroc(S[m], y) * 100, 2)} for m in MODELS}
ranked = sorted(MODELS, key=lambda m: -ap_auroc[m]["ap"])
print(f"n={len(y)} abuse={P} clean={N}\n=== AP / AUROC (임계값 무관) ===")
for m in ranked:
    print(f"  {m:<20} AP={ap_auroc[m]['ap']:6.2f}  AUROC={ap_auroc[m]['auroc']:6.2f}")

# McNemar (상위 2개 @0.5)
A, B = ranked[0], ranked[1]
pa = [1 if s > 0.5 else 0 for s in S[A]]; pb = [1 if s > 0.5 else 0 for s in S[B]]
b = sum(1 for i in range(len(y)) if pa[i] == y[i] and pb[i] != y[i])
c = sum(1 for i in range(len(y)) if pa[i] != y[i] and pb[i] == y[i])
stat = (abs(b - c) - 1) ** 2 / (b + c) if (b + c) > 0 else 0.0
pval = math.erfc(math.sqrt(stat / 2)) if stat > 0 else 1.0

# 부트스트랩 95% CI (A-B): F1 차이, FP 차이
def f1fp(idx, pred):
    tp = fp = fn = 0
    for i in idx:
        if pred[i] and y[i]: tp += 1
        elif pred[i] and not y[i]: fp += 1
        elif not pred[i] and y[i]: fn += 1
    p = tp / (tp + fp) if tp + fp else 0; r = tp / (tp + fn) if tp + fn else 0
    return (2 * p * r / (p + r) if p + r else 0), fp

random.seed(42); df1 = []; dfp = []; n = len(y); Bn = 2000
for _ in range(Bn):
    idx = [random.randrange(n) for _ in range(n)]
    fa, fpa = f1fp(idx, pa); fb, fpb = f1fp(idx, pb)
    df1.append((fa - fb) * 100); dfp.append(fpa - fpb)
df1.sort(); dfp.sort()
ci = lambda a: [round(a[int(.025 * Bn)], 2), round(a[int(.975 * Bn)], 2)]

out = {
    "test_n": len(y), "abuse": P, "clean": N,
    "abuse_definition": "not-clean (max of 9 hate labels > 0.5)",
    "note": "AP/AUROC는 캐시된 not-clean 점수 기준 임계값 무관 지표. McNemar/부트스트랩은 상위 2개 @0.5 비교(시드 42).",
    "threshold_free": [{"model": m, **ap_auroc[m]} for m in ranked],
    "mcnemar_top2": {"model_a": A, "model_b": B, "b": b, "c": c, "chi2": round(stat, 4),
                     "p_value": round(pval, 4), "significant_at_0_05": pval < 0.05},
    "bootstrap_top2": {"model_a": A, "model_b": B, "B": Bn, "seed": 42,
                       "f1_diff_pp": round(sum(df1) / len(df1), 2), "f1_diff_95ci": ci(df1),
                       "fp_diff_95ci": ci(dfp),
                       "tie": ci(df1)[0] < 0 < ci(df1)[1]},
}
(RES / "threshold_free_significance.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

# comparison_results.json 에 ap/auroc 주입 (Game/Tutorial -> KcELECTRA/kcbert 매핑)
def to_disp(nm): return nm.replace(" Game", " KcELECTRA").replace(" Tutorial", " kcbert")
cj = json.loads((RES / "comparison_results.json").read_text(encoding="utf-8"))
for r in cj["results"]:
    d = to_disp(r["model"]); a = ap_auroc.get(d)
    if a:
        new = {}
        for k, v in r.items():
            new[k] = v
            if k == "lrap": new["ap"] = a["ap"]; new["auroc"] = a["auroc"]
        r.clear(); r.update(new)
(RES / "comparison_results.json").write_text(json.dumps(cj, ensure_ascii=False, indent=2), encoding="utf-8")

# comparison_results.csv 에 ap/auroc 컬럼 주입(lrap 다음)
with open(RES / "comparison_results.csv", encoding="utf-8-sig") as f:
    cr = list(csv.DictReader(f)); fields = list(cr[0].keys())
if "ap" not in fields:
    fields = fields[:fields.index("lrap") + 1] + ["ap", "auroc"] + fields[fields.index("lrap") + 1:]
for row in cr:
    a = ap_auroc.get(to_disp(row["model"]))
    if a: row["ap"] = a["ap"]; row["auroc"] = a["auroc"]
with open(RES / "comparison_results.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(cr)

print(f"\n=== McNemar {A} vs {B} @0.5 ===")
print(f"  b={b} c={c} chi2={stat:.3f} p={pval:.3f} -> {'동률(유의차 없음)' if pval >= 0.05 else '유의차 있음'}")
print(f"=== 부트스트랩 95%CI (A-B) ===  F1 {out['bootstrap_top2']['f1_diff_pp']:+}%p {ci(df1)}  FP {ci(dfp)}")
print("\n저장: results/threshold_free_significance.json + comparison_results.json/.csv 에 ap·auroc 주입")
