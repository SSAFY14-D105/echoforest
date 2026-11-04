"""
plot_threshold_robustness_ko.py — 임계값 sweep 한글 차트 (재추론 불필요).
입력: results/threshold_robustness_f1.csv (threshold_robustness.py가 생성)
선: AP 기준 상위 4개 모델 + Baseline. 0.5 = 모델 비교 기준이자 배포 임계값, ~0.28 = F1 최대(참고).
실행: cd 6_Model_Comparison && python plot_threshold_robustness_ko.py
"""
from glob import glob
from pathlib import Path
import pandas as pd
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.font_manager as fm

HERE = Path(__file__).resolve().parent
def font():
    for fp in glob("/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-*.otf"):
        fm.fontManager.addfont(fp)
    for fp in glob("/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-*.otf"):
        return fm.FontProperties(fname=fp).get_name()
    return "AppleGothic"
plt.rcParams.update({"font.family": font(), "axes.unicode_minus": False, "font.size": 12})
INK, SUB, GRID, PRIMARY = "#1F2933", "#9AA5B1", "#EBEEF1", "#2F9D91"
COL = {"Full v2 KcELECTRA": PRIMARY, "LoRA v2 KcELECTRA": "#5E7E9E", "Full v2 kcbert": "#8FA3AE",
       "LoRA v1 KcELECTRA": "#C2CAD2", "Baseline": "#4B5A68"}

df = pd.read_csv(HERE / "results/threshold_robustness_f1.csv", encoding="utf-8-sig").set_index("threshold")
fig, ax = plt.subplots(figsize=(9.6, 5.4)); fig.subplots_adjust(left=0.09, right=0.76, top=0.84, bottom=0.12)
for name, c in COL.items():
    lw = 3.0 if name == "Full v2 KcELECTRA" else 1.8
    ax.plot(df.index, df[name], "-o", ms=3, lw=lw, color=c, label=name, zorder=3 if name == "Full v2 KcELECTRA" else 2)
ax.axvline(0.5, color=PRIMARY, ls="--", lw=1.4)
ax.text(0.508, 30.5, "비교 기준·배포 임계값 0.5", color=PRIMARY, fontsize=9.5, fontweight="bold")
ax.axvline(0.28, color=SUB, ls=":", lw=1.5)
ax.text(0.287, 30.5, "F1 최대 ~0.28\n(참고)", color=SUB, fontsize=9, linespacing=1.1)
ax.set_xlabel("임계값", color=INK); ax.set_ylabel("Abuse F1 (%)", color=INK); ax.set_ylim(25, 95)
ax.set_xticks([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
ax.grid(color=GRID, lw=1); ax.set_axisbelow(True)
for s in ax.spines.values(): s.set_visible(False)
ax.tick_params(length=0)
ax.legend(loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False, fontsize=10)
ax.set_title("임계값을 바꿔도 순위가 유지되는가 (AP 상위 4개 + Baseline)", loc="left", pad=24, fontsize=15, fontweight="bold", color=INK)
ax.text(0, 1.02, "abuse = not-clean · v1 = 댓글 보정만, v2 = +게임 발화 518건 · 0.2~0.8 전 구간에서 파인튜닝 모델이 Baseline보다 위",
        transform=ax.transAxes, fontsize=9.5, color=SUB)
fig.savefig(HERE / "results/threshold_robustness_ko.png", dpi=220, facecolor="white", bbox_inches="tight"); plt.close(fig)
print("saved", HERE / "results/threshold_robustness_ko.png")
