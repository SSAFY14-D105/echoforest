"""
plot_ap_auroc_ko.py — 임계값 무관 모델 비교(AP·AUROC) 한글 차트.
results/threshold_free_significance.json 을 읽어 9개 모델의 AP(평균정밀도)를 막대로,
AUROC를 행마다 주석으로 표기. 최종 선정 모델(Full v2 KcELECTRA)을 강조.
포트폴리오 팔레트(muted teal/soft gray)·Pretendard 폰트 사용. 재추론 불필요.
실행: cd 6_Model_Comparison && python plot_ap_auroc_ko.py
"""
import json
from glob import glob
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

def _font_ko():
    pats = [
        "/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-Regular.otf",
        "/Users/sondahyun/Pretendard-1.3.9/public/variable/PretendardVariable.ttf",
        "~/Library/Fonts/Pretendard*.otf", "/Library/Fonts/Pretendard*.otf",
    ]
    for pat in pats:
        for fp in glob(str(Path(pat).expanduser())):
            fm.fontManager.addfont(fp)
            return fm.FontProperties(fname=fp).get_name()
    return "Apple SD Gothic Neo"

KO = _font_ko()
plt.rcParams.update({"font.family": KO, "axes.unicode_minus": False})
INK, SUB, GRID, NEUTRAL, ACCENT, SLATE = "#1F2933", "#9AA5B1", "#EBEEF1", "#C2CAD2", "#2F9D91", "#4B5A68"

HERE = Path(__file__).resolve().parent
RES = HERE / "results"
d = json.load(open(RES / "threshold_free_significance.json", encoding="utf-8"))
rows = d["threshold_free"]                      # AP 내림차순 정렬됨
mc, bt = d["mcnemar_top2"], d["bootstrap_top2"]
SEL = "Full v2 KcELECTRA"

models = [r["model"] for r in rows]
ap = [r["ap"] for r in rows]
auroc = [r["auroc"] for r in rows]
ys = list(range(len(models)))[::-1]            # 1위가 위로

fig, ax = plt.subplots(figsize=(9.2, 5.4))
fig.subplots_adjust(left=0.26, right=0.97, top=0.80, bottom=0.12)
for y, m, a, u in zip(ys, models, ap, auroc):
    col = ACCENT if m == SEL else (SLATE if m == "Baseline" else NEUTRAL)
    ax.barh(y, a - 88, left=88, color=col, height=0.62, zorder=3)
    inside = m in (SEL, "Baseline")
    ax.text(a - 0.18, y, f"{a:.2f}", va="center", ha="right",
            color="white" if inside else INK, fontsize=10.5, fontweight="bold", zorder=4)
    ax.text(a + 0.2, y, f"AUROC {u:.2f}", va="center", ha="left", color=SUB, fontsize=8.8, zorder=4)

ax.set_yticks(ys)
ax.set_yticklabels(models, fontsize=10.5)
for t, m in zip(ax.get_yticklabels(), models):
    if m == SEL: t.set_color(ACCENT); t.set_fontweight("bold")
    elif m == "Baseline": t.set_color(SLATE)
ax.set_xlim(88, 98)
ax.set_xlabel("AP, 평균정밀도 (%)  ·  임계값과 무관", fontsize=10.5, color=SUB)
ax.set_axisbelow(True)
ax.xaxis.grid(True, color=GRID, lw=1)
for s in ("top", "right", "left"):
    ax.spines[s].set_visible(False)
ax.spines["bottom"].set_color(GRID)
ax.tick_params(length=0)

fig.text(0.26, 0.93, "임계값 무관 모델 비교: AP · AUROC", fontsize=15, fontweight="bold", color=INK, ha="left")
fig.text(0.26, 0.875,
         f"0.5 컷에 의존하지 않는 지표에서도 {SEL} 1위 (AP 96.21 · AUROC 95.22).  "
         f"상위 2개는 통계적 동률: McNemar p={mc['p_value']:.2f}, F1차 95%CI [{bt['f1_diff_95ci'][0]}, {bt['f1_diff_95ci'][1]}]%p.",
         fontsize=9.2, color=SUB, ha="left")
# 강조 캡션(선정 모델)
sel_y = ys[models.index(SEL)]
ax.annotate("최종 선정", xy=(rows[models.index(SEL)]["ap"], sel_y),
            xytext=(rows[models.index(SEL)]["ap"] + 0.05, sel_y + 0.9),
            color=ACCENT, fontsize=9.5, fontweight="bold",
            arrowprops=dict(arrowstyle="-", color=ACCENT, lw=1.2))

for ext in ("png", "pdf"):
    fig.savefig(RES / f"threshold_free_ap_auroc_ko.{ext}", dpi=300, facecolor="white", bbox_inches="tight")
plt.close(fig)
print("saved:", RES / "threshold_free_ap_auroc_ko.png", "(+pdf)")
