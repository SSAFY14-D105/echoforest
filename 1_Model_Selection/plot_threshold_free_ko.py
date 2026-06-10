"""
plot_threshold_free_ko.py — 1단계 베이스 선정(임계값 무관) 한국어 차트.
입력: results/threshold_free_selection.csv + results/threshold_free_sweep.json (재추론 불필요)
좌: AP(평균정밀도) 랭킹 = 임계값과 무관한 선정 지표
우: F1 임계값 sweep = 운영 범위에서 UnSmile이 최고 (0.5는 오히려 불리한 점)
실행: cd 1_Model_Selection && /Users/sondahyun/.echoforest_bench_venv/bin/python plot_threshold_free_ko.py
"""
import json, numpy as np, pandas as pd
from glob import glob
from pathlib import Path
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.font_manager as fm

ROOT = Path(__file__).resolve().parent
INK, SUB, GRID = "#1F2933", "#9AA5B1", "#EBEEF1"
PRIMARY, ACCENT, SECONDARY, SLATE = "#2F9D91", "#B8A56D", "#C2CAD2", "#4B5A68"

def font():
    for fp in glob("/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-*.otf"):
        fm.fontManager.addfont(fp); return fm.FontProperties(fname=fp).get_name()
    return "AppleGothic"
plt.rcParams.update({"font.family": font(), "axes.unicode_minus": False, "font.size": 12,
                     "text.color": INK, "axes.labelcolor": SUB, "xtick.color": INK, "ytick.color": INK})

KO = {"UnSmile": "UnSmile", "Korean Sentiment": "Korean Sentiment",
      "KoELECTRA Base": "KoELECTRA Base", "KoELECTRA Small": "KoELECTRA Small", "Multilingual": "Multilingual"}

ap = pd.read_csv(ROOT / "results/threshold_free_selection.csv")
sw = json.load(open(ROOT / "results/threshold_free_sweep.json", encoding="utf-8"))
thr = np.array(sw["thresholds"]); curves = sw["curves"]

fig, (axA, axB) = plt.subplots(1, 2, figsize=(12.2, 5.0), gridspec_kw={"width_ratios": [1, 1.15]})
fig.subplots_adjust(left=0.13, right=0.975, top=0.80, bottom=0.135, wspace=0.32)

# ── 좌: AP 랭킹 ─────────────────────────────────────────────
ap = ap.sort_values("AP")
names = ap["model"].tolist(); vals = ap["AP"].tolist()
ypos = np.arange(len(names))
cols = [PRIMARY if n == "UnSmile" else SECONDARY for n in names]
axA.barh(ypos, vals, color=cols, height=0.62, zorder=3)
for yi, (n, v) in enumerate(zip(names, vals)):
    axA.text(v - 1.4, yi, f"{v:.1f}", va="center", ha="right",
             color="white" if n == "UnSmile" else SLATE,
             fontsize=11.5, fontweight="bold" if n == "UnSmile" else "normal", zorder=4)
axA.text(vals[-1] + 1.0, ypos[-1], "선정", va="center", ha="left", color=PRIMARY, fontsize=10.5, fontweight="bold")
axA.set_yticks(ypos); axA.set_yticklabels([KO[n] for n in names], fontsize=11)
axA.set_xlim(45, 100); axA.set_xlabel("AP · 평균정밀도 (%)", fontsize=10.5)
for s in axA.spines.values(): s.set_visible(False)
axA.tick_params(length=0); axA.xaxis.grid(True, color=GRID, lw=1.1, zorder=0); axA.set_axisbelow(True)
axA.set_title("임계값과 무관한 선정 지표", loc="left", pad=30, fontsize=14.5, fontweight="bold", color=INK)
axA.text(0, 1.045, "AP는 모든 임계값을 평균 낸 랭킹 품질. UnSmile이 2위보다 +12.7p",
         transform=axA.transAxes, fontsize=10, color=SUB)

# ── 우: F1 sweep ────────────────────────────────────────────
STYLE = {"UnSmile": (PRIMARY, 3.0, 1.0), "Korean Sentiment": (ACCENT, 2.0, 1.0),
         "KoELECTRA Base": ("#AEB7C0", 1.6, 0.9), "KoELECTRA Small": ("#C8CED5", 1.6, 0.9),
         "Multilingual": ("#DDE2E7", 1.6, 0.9)}
axB.axvspan(0.10, 0.30, color=PRIMARY, alpha=0.07, zorder=0)
axB.text(0.20, 86.5, "배포 운영범위", ha="center", color=PRIMARY, fontsize=9.5, fontweight="bold")
for n in ["Multilingual", "KoELECTRA Small", "KoELECTRA Base", "Korean Sentiment", "UnSmile"]:
    c, lw, a = STYLE[n]
    axB.plot(thr, curves[n], "-", color=c, lw=lw, alpha=a, zorder=3 if n == "UnSmile" else 2,
             marker="o" if n == "UnSmile" else None, ms=3.5)
axB.axvline(0.5, color=SUB, ls="--", lw=1.1, zorder=1)
axB.text(0.512, 34, "옛 비교점 0.5", color=SUB, fontsize=9)
axB.annotate("0.2에서 +11.6p", xy=(0.20, 81.3), xytext=(0.345, 88),
             fontsize=9.5, color=PRIMARY, fontweight="bold",
             arrowprops=dict(arrowstyle="-", color=PRIMARY, lw=1))
axB.set_xlim(0.08, 0.92); axB.set_ylim(30, 92)
axB.set_xlabel("임계값", fontsize=10.5); axB.set_ylabel("부정어 탐지 F1 (%)", fontsize=10.5)
for s in axB.spines.values(): s.set_visible(False)
axB.tick_params(length=0); axB.grid(True, color=GRID, lw=1.0, zorder=0); axB.set_axisbelow(True)
# 라벨 직접 표기(범례 대신, 더 깔끔)
axB.text(0.40, 79.6, "UnSmile", color=PRIMARY, fontsize=11, fontweight="bold")
axB.text(0.79, 79.8, "Korean Sentiment", color=ACCENT, fontsize=9.5, ha="center")
axB.text(0.905, curves["KoELECTRA Base"][-1] + 1.2, "KoELECTRA", color="#9AA5B1", fontsize=8.5, va="center", ha="right")
axB.set_title("운영 임계값에서 UnSmile이 최고 F1", loc="left", pad=30, fontsize=14.5, fontweight="bold", color=INK)
axB.text(0, 1.045, "0.1~0.55 전 구간 1위. 0.5는 오히려 격차가 가장 좁은 점(+2.6p)이었다",
         transform=axB.transAxes, fontsize=10, color=SUB)

out = ROOT / "results/selection_threshold_free_ko.png"
fig.savefig(out, dpi=220, facecolor="white", bbox_inches="tight"); plt.close(fig)
print("saved", out)
