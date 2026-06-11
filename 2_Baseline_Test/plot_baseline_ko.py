"""plot_baseline_ko.py: 2단계 baseline 진단 차트 한글판.
baseline_test_results.csv(캐시)로 eval 재실행 없이 생성. not-clean 기준, em-dash 미사용.
실행: <venv>/bin/python plot_baseline_ko.py
"""
from glob import glob
from pathlib import Path
import numpy as np, pandas as pd
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.font_manager as fm
from matplotlib.colors import LinearSegmentedColormap

ROOT = Path(__file__).resolve().parent
INK, SUB, GRID = "#1F2933", "#9AA5B1", "#EBEEF1"
PRIMARY, ACCENT, SECONDARY, SLATE = "#2F9D91", "#5E7E9E", "#C2CAD2", "#4B5A68"

def _font():
    for pat in ["/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-*.otf",
                "~/Library/Fonts/Pretendard*.otf", "/Library/Fonts/Pretendard*.otf"]:
        for fp in glob(str(Path(pat).expanduser())):
            fm.fontManager.addfont(fp); return fm.FontProperties(fname=fp).get_name()
    return "AppleGothic"
plt.rcParams.update({"font.family": _font(), "axes.unicode_minus": False, "font.size": 12, "text.color": INK})

df = pd.read_csv(ROOT / "baseline_test_results.csv")
HATE = ["여성/가족", "남성", "성소수자", "인종/국적", "연령", "지역", "종교", "기타 혐오", "악플/욕설"]
yt_ab = (df[HATE].sum(axis=1) > 0).astype(int).values
ab_pred = df["pred_abuse"].values.astype(int); ab_prob = df["prob_abuse"].values.astype(float)
yt_cl = df["clean"].astype(int).values; cl_pred = df["pred_clean"].values.astype(int)

def cmat(yt, yp):
    return np.array([[int(((yt == 0) & (yp == 0)).sum()), int(((yt == 0) & (yp == 1)).sum())],
                     [int(((yt == 1) & (yp == 0)).sum()), int(((yt == 1) & (yp == 1)).sum())]])
CM_AB, CM_CL = cmat(yt_ab, ab_pred), cmat(yt_cl, cl_pred)
TN, FP, FN, TP = CM_AB[0, 0], CM_AB[0, 1], CM_AB[1, 0], CM_AB[1, 1]
prec, rec = TP / (TP + FP), TP / (TP + FN); f1 = 2 * prec * rec / (prec + rec)
n, tot_ab = len(df), int(yt_ab.sum())

fig, axes = plt.subplots(2, 2, figsize=(13, 10))
fig.suptitle(f"베이스라인: 기본 unSmile · test_set({n}) | 부정어 재현율 {rec*100:.1f}% · {tot_ab}건 중 {FN}건 미탐",
             fontsize=14, fontweight="bold", color=INK, y=0.99)

def heat(ax, M, base, xt, yt_lab, t):
    cmap = LinearSegmentedColormap.from_list("x", ["#FFFFFF", base])
    ax.imshow(M, cmap=cmap, vmin=0, vmax=M.max())
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f"{M[i, j]}", ha="center", va="center", fontsize=15, fontweight="bold",
                    color="white" if M[i, j] > M.max() * 0.6 else INK)
    ax.set_xticks([0, 1], xt); ax.set_yticks([0, 1], yt_lab, rotation=90, va="center")
    ax.set_title(t, fontsize=12, fontweight="bold", color=INK, loc="left", pad=10); ax.tick_params(length=0)
    for s in ax.spines.values(): s.set_visible(False)

heat(axes[0, 0], CM_AB, PRIMARY, ["예측 비부정어", "예측 부정어"], ["실제 비부정어", "실제 부정어"], "부정어 혼동행렬 (FN=미탐)")
heat(axes[0, 1], CM_CL, SLATE, ["예측 비정상", "예측 정상"], ["실제 비정상", "실제 정상"], "정상(clean) 혼동행렬")

def _clean(ax):
    for s in ["top", "right"]: ax.spines[s].set_visible(False)
    ax.spines["left"].set_color(GRID); ax.spines["bottom"].set_color(GRID); ax.tick_params(length=0, colors=SUB)

ax3 = axes[1, 0]
ax3.hist(ab_prob[yt_ab == 1], bins=24, alpha=0.9, label="실제 부정어", color=PRIMARY)
ax3.hist(ab_prob[yt_cl == 1], bins=24, alpha=0.55, label="실제 정상", color=SECONDARY)
ax3.axvline(0.5, color=SLATE, ls="--", lw=1.5, label="임계값 0.5")
ax3.set_xlabel("부정어 확률", color=SUB); ax3.set_ylabel("문장 수", color=SUB)
ax3.set_title("부정어 확률 분포: 0.5 왼쪽으로 샌 부분이 미탐", fontsize=11.5, fontweight="bold", color=INK, loc="left", pad=10)
ax3.legend(frameon=False); _clean(ax3)

ax4 = axes[1, 1]
mets, sc = ["정밀도", "재현율", "F1"], [prec, rec, f1]
bars = ax4.bar(np.arange(3), sc, 0.5, color=[SECONDARY, PRIMARY, SECONDARY])
ax4.axhline(0.75, color=SLATE, ls="--", lw=1.2)
ax4.text(2.48, 0.77, "파인튜닝 목표 ≥0.75", color=SLATE, fontsize=9, va="bottom", ha="right")
ax4.set_xticks(np.arange(3), mets); ax4.set_ylim(0, 1.05)
ax4.set_title("부정어 지표: 재현율이 파인튜닝으로 메울 격차", fontsize=11.5, fontweight="bold", color=INK, loc="left", pad=10)
_clean(ax4)
for b, v in zip(bars, sc):
    ax4.text(b.get_x() + b.get_width() / 2, v + 0.02, f"{v:.2f}", ha="center", color=INK, fontweight="bold")

plt.tight_layout(rect=[0, 0, 1, 0.96])
out = str(ROOT / "baseline_accuracy_ko.png")
plt.savefig(out, dpi=200, bbox_inches="tight", facecolor="white")
print(f"saved {out}  | CM_AB TN{TN} FP{FP} FN{FN} TP{TP} | P{prec*100:.2f} R{rec*100:.2f} F{f1*100:.2f}")
