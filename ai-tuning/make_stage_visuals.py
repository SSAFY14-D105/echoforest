"""
make_stage_visuals.py — 시각화 공백 단계(0,3,4,5,7) 한글 차트 생성.
기존 차트와 동일 팔레트/폰트(Pretendard). not-clean 기준 수치.
실행: /path/venv/bin/python make_stage_visuals.py
"""
import os
from glob import glob
from pathlib import Path
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.font_manager as fm

ROOT = Path(__file__).resolve().parent
INK, SUB, GRID = "#1F2933", "#9AA5B1", "#EBEEF1"
PRIMARY, ACCENT, SECONDARY, SLATE = "#2F9D91", "#5E7E9E", "#C2CAD2", "#4B5A68"
WARN = "#C2703D"

def _font():
    for pat in ["/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-*.otf",
                "~/Library/Fonts/Pretendard*.otf", "/Library/Fonts/Pretendard*.otf"]:
        for fp in glob(str(Path(pat).expanduser())):
            fm.fontManager.addfont(fp)
            return fm.FontProperties(fname=fp).get_name()
    return "AppleGothic"
FONT = _font()
plt.rcParams.update({"font.family": FONT, "axes.unicode_minus": False, "font.size": 12,
                     "text.color": INK, "axes.labelcolor": SUB, "xtick.color": INK, "ytick.color": INK})

def despine(ax, keep=()):
    for k, s in ax.spines.items(): s.set_visible(k in keep)
    ax.tick_params(length=0)
def title(ax, t, sub=None):
    if os.environ.get("NO_STEP_NUM"):  # 포트폴리오용: "7. " 같은 단계 번호 제거
        import re; t = re.sub(r"^\d+\.\s*", "", t)
    ax.set_title(t, loc="left", pad=28, fontsize=16, fontweight="bold", color=INK)
    if sub: ax.text(0, 1.04, sub, transform=ax.transAxes, fontsize=10.5, color=SUB, va="bottom")
def save(fig, path):
    if os.environ.get("SAVE_DIR"):  # 포트폴리오용: 다른 폴더에 저장
        path = os.path.join(os.environ["SAVE_DIR"], os.path.basename(path))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=220, facecolor="white", bbox_inches="tight"); plt.close(fig)
    print("saved", path)

# ── Stage 0: 데이터 구성 ───────────────────────────────────────────────
def stage0():
    # 좌: 전체 데이터(라벨별 누적) / 우: 게임 발화만 확대
    data = [("unSmile 학습\n(댓글, 보정)", 3128, 3700, 7862),
            ("unSmile 검증\n(댓글)", 777, 930, 1956),
            ("게임 학습\n(STT 수집)", 234, 284, 0),
            ("게임 평가\n(STT, 평가용)", 248, 234, 0)]
    labels = [d[0] for d in data]
    abuse = np.array([d[1] for d in data]); clean = np.array([d[2] for d in data]); cat = np.array([d[3] for d in data])
    fig, (ax, bx) = plt.subplots(1, 2, figsize=(12.4, 4.9), gridspec_kw={"width_ratios": [1.45, 1]})
    fig.subplots_adjust(left=0.115, right=0.985, top=0.80, bottom=0.17, wspace=0.42)
    y = np.arange(len(labels))[::-1]
    ax.barh(y, abuse, color=ACCENT, label="악플/욕설", zorder=3, height=0.62)
    ax.barh(y, clean, left=abuse, color=PRIMARY, label="clean", zorder=3, height=0.62)
    ax.barh(y, cat, left=abuse+clean, color=SLATE, label="카테고리 혐오(성별/지역/종교 등)", zorder=3, height=0.62)
    for i, tot in enumerate(abuse+clean+cat):
        ax.text(tot+250, y[i], f"{tot:,}건", va="center", fontsize=10.5, color=INK, fontweight="bold")
    ax.set_yticks(y); ax.set_yticklabels(labels, fontsize=10.5)
    ax.set_xlim(0, 17500); ax.set_xticks([0, 5000, 10000, 15000]); ax.set_xticklabels(["0", "5,000", "10,000", "15,000"])
    despine(ax); ax.xaxis.grid(True, color=GRID, lw=1.1, zorder=0); ax.set_axisbelow(True)
    ax.legend(loc="lower right", frameon=False, fontsize=9.5)
    title(ax, "0. 전체 데이터: 대부분이 댓글", "unSmile 학습 데이터의 54%가 카테고리 혐오, 게임 발화에는 0%")
    # 우: 게임 발화 확대
    gy = np.array([1, 0]); ga = abuse[2:]; gc = clean[2:]
    bx.barh(gy, ga, color=ACCENT, zorder=3, height=0.55)
    bx.barh(gy, gc, left=ga, color=PRIMARY, zorder=3, height=0.55)
    for i in range(2):
        bx.text(ga[i]/2, gy[i], f"욕설 {ga[i]}", ha="center", va="center", color="white", fontsize=10.5, fontweight="bold", zorder=4)
        bx.text(ga[i]+gc[i]/2, gy[i], f"clean {gc[i]}", ha="center", va="center", color="white", fontsize=10.5, fontweight="bold", zorder=4)
        bx.text(ga[i]+gc[i]+12, gy[i], f"{ga[i]+gc[i]}건", va="center", fontsize=10.5, color=INK, fontweight="bold")
    bx.set_yticks(gy); bx.set_yticklabels([labels[2], labels[3]], fontsize=10.5)
    bx.set_xlim(0, 600); despine(bx); bx.xaxis.grid(True, color=GRID, lw=1.1, zorder=0); bx.set_axisbelow(True)
    bx.set_ylim(-0.6, 1.6)
    title(bx, "게임 발화만 확대", "v2 학습에 518건 추가(전체 학습의 3.4%), 평가셋과 문장 겹침 0")
    fig.text(0.115, 0.035, "게임 발화 출처: 메아리의 숲 플레이 녹화와 유튜브 협동게임 영상을 faster-whisper로 받아쓴 뒤 직접 라벨링",
             fontsize=9.5, color=SUB)
    save(fig, str(ROOT/"0_Data_Collection/results/data_composition_ko.png"))

# ── Stage 3: unSmile 보정 전후 ─────────────────────────────────────────
def stage3():
    cats = ["악플/욕설", "clean", "카테고리 혐오"]
    before = [3089, 3739, 7862]; after = [3128, 3700, 7862]
    x = np.arange(len(cats)); w = 0.36
    fig, ax = plt.subplots(figsize=(8.8, 5.0)); fig.subplots_adjust(left=0.10, right=0.96, top=0.78, bottom=0.12)
    ax.bar(x-w/2, before, w, color=SECONDARY, label="개인지칭 제거 후 (14,690)", zorder=3)
    ax.bar(x+w/2, after, w, color=PRIMARY, label="보정 (14,690)", zorder=3)
    for xi, (b, a) in enumerate(zip(before, after)):
        ax.text(xi-w/2, b+90, f"{b:,}", ha="center", fontsize=10, color=SUB)
        ax.text(xi+w/2, a+90, f"{a:,}", ha="center", fontsize=10, color=INK, fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(cats, fontsize=12)
    ax.set_ylim(0, 9700); despine(ax); ax.yaxis.grid(True, color=GRID, lw=1.1, zorder=0); ax.set_axisbelow(True)
    ax.legend(loc="upper left", frameon=False, fontsize=10.5)
    title(ax, "3. unSmile 라벨 보정", "같은 14,690행에서 게임 부정어 키워드 기준 clean→abuse 39건 보정")
    save(fig, str(ROOT/"3_UnSmile_Correction/results/correction_ko.png"))

# ── Stage 4: LoRA vs Full FT ───────────────────────────────────────────
def _models_chart(title_t, sub, f1, rec, outname):
    """base 2종(KcELECTRA, kcbert) x 데이터 v1/v2 비교. 막대=Abuse F1, 위 R=Recall (not-clean)."""
    bases = ["KcELECTRA", "kcbert"]; x = np.arange(len(bases)); w = 0.36
    v1f = [f1[b][0] for b in bases]; v2f = [f1[b][1] for b in bases]
    v1r = [rec[b][0] for b in bases]; v2r = [rec[b][1] for b in bases]
    fig, ax = plt.subplots(figsize=(9.0, 5.4)); fig.subplots_adjust(left=0.09, right=0.96, top=0.73, bottom=0.16)
    ax.bar(x-w/2, v1f, w, color=ACCENT, label="v1 (댓글 보정만)", zorder=3)
    ax.bar(x+w/2, v2f, w, color=PRIMARY, label="v2 (+ 게임채팅 518건)", zorder=3)
    def lab(xc, fv, rv, bold):
        ax.text(xc, fv+4.2, f"{fv:.1f}", ha="center", fontsize=11, color=INK, fontweight=("bold" if bold else "normal"))
        ax.text(xc, fv+0.9, f"R {rv:.1f}", ha="center", fontsize=8.5, color=SUB)
    for xi in range(len(bases)):
        lab(x[xi]-w/2, v1f[xi], v1r[xi], False)
        lab(x[xi]+w/2, v2f[xi], v2r[xi], True)
    ax.set_xticks(x); ax.set_xticklabels(bases, fontsize=12.5); ax.set_ylim(0, 100); ax.set_yticks([0,25,50,75,100])
    ax.set_ylabel("Abuse F1 (%)"); despine(ax); ax.yaxis.grid(True, color=GRID, lw=1.1, zorder=0); ax.set_axisbelow(True)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5,-0.16), ncol=2, frameon=False, fontsize=10.5)
    title(ax, title_t, sub); save(fig, str(ROOT/outname))

def stage4():
    _models_chart(
        "4. LoRA 파인튜닝: base 2종 x 데이터 v1/v2",
        "막대=Abuse F1, R=Recall (not-clean). KcELECTRA v2가 LoRA 중 최고 (F1 87.9)",
        {"KcELECTRA": [85.41, 87.90], "kcbert": [80.96, 83.27]},
        {"KcELECTRA": [80.24, 87.90], "kcbert": [74.60, 86.29]},
        "4_LoRA_Fine_Tuning/results/lora_models_ko.png")


def stage4_training_curve():
    ep = list(range(1, 11))
    tr = [0.3207, 0.2294, 0.1520, 0.1336, 0.1193, 0.1131, 0.1060, 0.1078, 0.1013, 0.1032]
    va = [0.273981, 0.175130, 0.143568, 0.133208, 0.122073, 0.116931, 0.119880, 0.116324, 0.114371, 0.114944]
    lrap = [0.585884, 0.813355, 0.845140, 0.860402, 0.875845, 0.883432, 0.879030, 0.882829, 0.887409, 0.886291]
    fig, ax = plt.subplots(figsize=(9.0, 5.0)); fig.subplots_adjust(left=0.10, right=0.90, top=0.78, bottom=0.12)
    ax.plot(ep, tr, "-o", color=ACCENT, lw=2.2, label="Training Loss", zorder=3)
    ax.plot(ep, va, "-o", color=PRIMARY, lw=2.4, label="Validation Loss", zorder=3)
    ax.set_xlabel("Epoch"); ax.set_ylabel("Loss"); ax.set_xticks(ep); ax.set_ylim(0, 0.36)
    despine(ax, keep=()); ax.yaxis.grid(True, color=GRID, lw=1.1, zorder=0); ax.set_axisbelow(True)
    ax2 = ax.twinx(); ax2.plot(ep, lrap, "--s", color=SLATE, lw=1.8, label="LRAP(valid)", zorder=2)
    ax2.set_ylabel("LRAP", color=SLATE); ax2.set_ylim(0.4, 1.0); ax2.tick_params(length=0)
    for s in ax2.spines.values(): s.set_visible(False)
    l1,la1=ax.get_legend_handles_labels(); l2,la2=ax2.get_legend_handles_labels()
    ax.legend(l1+l2, la1+la2, loc="center right", frameon=False, fontsize=10.5)
    title(ax, "4. LoRA Fine-Tuning 학습 곡선 (LoRA v2 KcELECTRA)",
          "10 epoch, LoRA r=16, Loss 안정 수렴, valid LRAP 0.89까지 상승")
    save(fig, str(ROOT/"4_LoRA_Fine_Tuning/results/training_curve_ko.png"))


# ── Stage 5: Full FT 학습 곡선 ─────────────────────────────────────────
def stage5():
    ep = [1,2,3,4,5]; tr = [0.3814,0.2473,0.1678,0.1433,0.1285]; va = [0.2987,0.1992,0.1650,0.1517,0.1488]
    lrap = [0.516,0.831,0.864,0.875,0.875]
    fig, ax = plt.subplots(figsize=(9.0, 5.0)); fig.subplots_adjust(left=0.10, right=0.90, top=0.78, bottom=0.12)
    ax.plot(ep, tr, "-o", color=ACCENT, lw=2.2, label="Training Loss", zorder=3)
    ax.plot(ep, va, "-o", color=PRIMARY, lw=2.4, label="Validation Loss", zorder=3)
    ax.set_xlabel("Epoch"); ax.set_ylabel("Loss"); ax.set_xticks(ep); ax.set_ylim(0, 0.42)
    despine(ax, keep=()); ax.yaxis.grid(True, color=GRID, lw=1.1, zorder=0); ax.set_axisbelow(True)
    ax2 = ax.twinx(); ax2.plot(ep, lrap, "--s", color=SLATE, lw=1.8, label="LRAP(valid)", zorder=2)
    ax2.set_ylabel("LRAP", color=SLATE); ax2.set_ylim(0.4, 1.0); ax2.tick_params(length=0)
    for s in ax2.spines.values(): s.set_visible(False)
    l1,la1=ax.get_legend_handles_labels(); l2,la2=ax2.get_legend_handles_labels()
    ax.legend(l1+l2, la1+la2, loc="center right", frameon=False, fontsize=10.5)
    title(ax, "5. Full Fine-Tuning 학습 곡선 (Full v2 KcELECTRA)",
          "5 epoch, lr 2e-5, batch 16, Loss 안정 수렴, valid LRAP 0.88까지 상승")
    save(fig, str(ROOT/"5_Full_Fine_Tuning/results/training_curve_ko.png"))

def stage5_models():
    _models_chart(
        "5. Full Fine-Tuning: base 2종 x 데이터 v1/v2",
        "막대=Abuse F1, R=Recall (not-clean). KcELECTRA v2가 최종 선정 (F1 87.8)",
        {"KcELECTRA": [81.80, 87.78], "kcbert": [77.42, 84.82]},
        {"KcELECTRA": [73.39, 85.48], "kcbert": [67.74, 82.26]},
        "5_Full_Fine_Tuning/results/full_models_ko.png")

# ── Stage 7: 최종 모델 선정 ────────────────────────────────────────────
def stage7():
    metrics = ["Recall", "Precision", "F1", "AP", "AUROC"]
    full = [85.48, 90.21, 87.78, 96.21, 95.22]; lora = [87.90, 87.90, 87.90, 96.04, 94.80]
    x = np.arange(len(metrics)); w = 0.36
    fig, ax = plt.subplots(figsize=(9.6, 5.4)); fig.subplots_adjust(left=0.08, right=0.97, top=0.72, bottom=0.16)
    ax.bar(x-w/2, lora, w, color=SECONDARY, label="LoRA v2 KcELECTRA (Recall 1위)", zorder=3)
    ax.bar(x+w/2, full, w, color=PRIMARY, label="Full v2 KcELECTRA (최종 선정)", zorder=3)
    for xi,(l,f) in enumerate(zip(lora, full)):
        ax.text(xi-w/2, l+0.9, f"{l:.1f}", ha="center", fontsize=10, color=SUB)
        ax.text(xi+w/2, f+0.9, f"{f:.1f}", ha="center", fontsize=10, color=INK, fontweight="bold")
        win = ACCENT if f>=l else WARN
        ax.annotate(f"{f-l:+.1f}", xy=(xi, max(l,f)+5.5), ha="center", color=win, fontsize=11, fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(metrics, fontsize=12.5); ax.set_ylim(0, 108)
    ax.set_yticks([0,25,50,75,100]); despine(ax); ax.yaxis.grid(True, color=GRID, lw=1.1, zorder=0); ax.set_axisbelow(True)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5,-0.17), ncol=2, frameon=False, fontsize=10.5)
    title(ax, "7. 최종 모델 선정: Full v2 KcELECTRA",
          "두 모델은 통계적 동률(McNemar p=1.000). 오탐이 더 적은 쪽(FP 23 vs 30)을 게임 UX 기준으로 선택\n"
          "AP·AUROC는 임계값과 무관한 지표, 나머지는 임계값 0.5 기준")
    ax.title.set_position((0, 1.0)); ax.set_title(ax.get_title(loc="left"), loc="left", pad=50, fontsize=16, fontweight="bold", color=INK)
    save(fig, str(ROOT/"7_Best_Model_Selection/results/final_selection_ko.png"))

if __name__ == "__main__":
    stage0(); stage3(); stage4(); stage4_training_curve(); stage5(); stage5_models(); stage7()
    print("done")
