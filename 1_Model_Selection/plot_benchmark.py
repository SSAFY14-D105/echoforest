"""
plot_benchmark.py — 모델선정 벤치마크 '포트폴리오용' 차트 (presentation layer)
=============================================================================
results/benchmark_results.csv 를 읽어 차트를 렌더한다. 모델 추론(benchmark_game_stt.py)과
분리돼 있어 **재추론 없이** 다시 그릴 수 있다. 영어(기본)·한국어 두 버전을 모두 생성한다.

  best_model_selection.png / _ko.png — Abuse F1 랭킹(= 선정 결과)
  6_model_comparison.png    / _ko.png — 유효 후보 3종의 Precision–Recall 트레이드오프(덤벨)

디자인: 에디토리얼 좌측정렬 타이틀 · 뮤트 그레이 + 단일 틸 액센트 · 무테/무격자(옅은 격자만).
폰트: en=Helvetica Neue, ko=Apple SD Gothic Neo.

사용:  cd 1_Model_Selection && python plot_benchmark.py
"""
import os
from glob import glob
from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.lines import Line2D

# ── 디자인 시스템 ──────────────────────────────────────────────────────────
def _pick_font(cands):
    avail = {f.name for f in fm.fontManager.ttflist}
    for c in cands:
        if c in avail:
            return c
    return "DejaVu Sans"

def _preferred_font_from_files(patterns, fallback_names):
    for pattern in patterns:
        for font_path in glob(str(Path(pattern).expanduser())):
            path = Path(font_path)
            if path.exists():
                fm.fontManager.addfont(str(path))
                return fm.FontProperties(fname=str(path)).get_name()
    return _pick_font(fallback_names)

FONT_EN = _pick_font(["Helvetica Neue", "Avenir Next", "Helvetica", "Arial", "DejaVu Sans"])
FONT_KO = _preferred_font_from_files(
    [
        "/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-*.otf",
        "/Users/sondahyun/Pretendard-1.3.9/public/variable/PretendardVariable.ttf",
        "~/Library/Fonts/Pretendard*.otf",
        "~/Library/Fonts/Pretendard*.ttf",
        "/Library/Fonts/Pretendard*.otf",
        "/Library/Fonts/Pretendard*.ttf",
    ],
    ["Pretendard", "Apple SD Gothic Neo", "AppleGothic", "Nanum Gothic", "NanumGothic", "DejaVu Sans"],
)

INK     = "#1F2933"   # 본문/강조 텍스트
SUB     = "#9AA5B1"   # 보조 텍스트·축
GRID    = "#EBEEF1"   # 옅은 격자
NEUTRAL = "#C2CAD2"   # 일반 막대(승자 외)
MUTED   = "#E0E4E8"   # noise 모델(흐리게)
ACCENT  = "#2F9D91"   # 승자 / Precision (틸)
SLATE   = "#4B5A68"   # Recall (슬레이트)

# noise 모델(분류 헤드 미로딩) 집합. 현재는 모두 헤드가 실제 로드돼 비어 있음.
# (KoELECTRA는 수동 로드, KcELECTRA base는 헤드가 없어 벤치마크에서 제외)
NOISE = set()

# ── 문구(언어별) ───────────────────────────────────────────────────────────
STRINGS = {
    "en": {
        "sel_title": "Model selection — Abuse F1",
        "sel_sub":   "5 Korean models · test_set (482 held-out game-chat) · threshold 0.5",
        "sel_xlabel": "Abuse F1  (%)",
        "selected":  "selected",
        "sel_foot":  "†  classification head not loaded in current transformers — "
                     "score is noise (off-the-shelf baseline only)",
        "trade_title": "Why F1 decides — precision vs recall",
        "trade_sub":   "Precision vs recall per model · UnSmile is the most balanced (highest precision)",
        "trade_xlabel": "score  (%)",
        "precision": "Precision",
        "recall":    "Recall",
    },
    "ko": {
        "sel_title": "모델 선정 — Abuse F1",
        "sel_sub":   "한국어 모델 5종 · test_set (482, held-out 게임채팅) · 임계값 0.5",
        "sel_xlabel": "Abuse F1  (%)",
        "selected":  "선정",
        "sel_foot":  "†  현 transformers에서 분류 헤드 미로딩 — "
                     "수치는 noise (off-the-shelf 대조군)",
        "trade_title": "왜 F1으로 선정하나 — 정밀도 vs 재현율",
        "trade_sub":   "모델별 정밀도 vs 재현율 · UnSmile이 가장 균형(정밀도 최고)",
        "trade_xlabel": "점수  (%)",
        "precision": "정밀도",
        "recall":    "재현율",
    },
}


def _apply_style(font):
    plt.rcParams.update({
        "font.family": font,
        "font.size": 12,
        "text.color": INK,
        "axes.labelcolor": SUB,
        "xtick.color": SUB,
        "ytick.color": INK,
        "axes.linewidth": 0,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "axes.unicode_minus": False,
    })


def _despine(ax):
    for s in ax.spines.values():
        s.set_visible(False)
    ax.tick_params(length=0)


def _pct(s):
    return float(str(s).replace("%", ""))


def _title_block(ax, title, subtitle):
    ax.set_title(title, loc="left", pad=30, fontsize=17, fontweight="bold", color=INK)
    ax.text(0, 1.045, subtitle, transform=ax.transAxes, fontsize=10.5, color=SUB, va="bottom")


# ── 1) 선정 차트: Abuse F1 랭킹 ────────────────────────────────────────────
def chart_selection(df, path, t):
    d = df.sort_values("F1", ascending=True).reset_index(drop=True)  # barh: 위쪽이 최고
    n = len(d)
    fig, ax = plt.subplots(figsize=(9.4, 5.0))
    fig.subplots_adjust(left=0.255, right=0.965, top=0.80, bottom=0.165)

    colors = [ACCENT if m == "UnSmile" else (MUTED if m in NOISE else NEUTRAL) for m in d["Model"]]
    y = np.arange(n)
    ax.barh(y, d["F1"], height=0.60, color=colors, zorder=3)

    names = [m + ("  †" if m in NOISE else "") for m in d["Model"]]
    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=12.5, color=INK)
    for tick, m in zip(ax.get_yticklabels(), d["Model"]):
        if m in NOISE:
            tick.set_color(SUB)
        if m == "UnSmile":
            tick.set_fontweight("bold")

    for i, v in enumerate(d["F1"]):
        is_un = d["Model"].iloc[i] == "UnSmile"
        ax.text(v - 1.6 if is_un else v + 1.4, i, f"{v:.1f}",
                va="center", ha="right" if is_un else "left",
                color="white" if is_un else INK,
                fontweight="bold" if is_un else "normal", fontsize=12, zorder=5)

    ui = int(d.index[d["Model"] == "UnSmile"][0])
    ax.text(d["F1"].iloc[ui] + 4.5, ui, t["selected"], va="center", ha="left",
            color="white", fontsize=10.5, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.45", facecolor=ACCENT, edgecolor="none"))

    ax.set_xlim(0, 100)
    ax.set_xticks([0, 20, 40, 60, 80, 100])
    ax.xaxis.grid(True, color=GRID, lw=1.2, zorder=0)
    ax.set_axisbelow(True)
    _despine(ax)
    ax.set_xlabel(t["sel_xlabel"], fontsize=10.5)

    _title_block(ax, t["sel_title"], t["sel_sub"])
    if any(m in NOISE for m in d["Model"]):   # noise 모델이 있을 때만 각주 표시
        ax.text(0, -0.205, t["sel_foot"], transform=ax.transAxes, fontsize=8.7, color=SUB)

    fig.savefig(path, dpi=220, facecolor="white")
    plt.close(fig)
    print("saved", path)


# ── 2) 트레이드오프 차트: Precision vs Recall (덤벨) ────────────────────────
def chart_tradeoff(df, path, t):
    d = df[~df["Model"].isin(NOISE)].sort_values("F1", ascending=True).reset_index(drop=True)
    n = len(d)
    fig, ax = plt.subplots(figsize=(9.4, max(3.9, 1.7 + 0.62 * n)))
    fig.subplots_adjust(left=0.235, right=0.875, top=0.80, bottom=0.15)

    y = np.arange(n)
    for i, row in d.iterrows():
        r, p = row["REC"], row["PRE"]
        ax.plot([min(r, p), max(r, p)], [i, i], color=GRID, lw=4, zorder=1, solid_capstyle="round")
        ax.scatter(r, i, s=150, color=SLATE, zorder=3)
        ax.scatter(p, i, s=150, color=ACCENT, zorder=3)
        ax.text(r, i + 0.215, f"{r:.0f}", ha="center", va="bottom", color=SLATE, fontsize=9.5)
        ax.text(p, i + 0.215, f"{p:.0f}", ha="center", va="bottom", color=ACCENT, fontsize=9.5)
        ax.text(104, i, f"F1 {row['F1']:.1f}", va="center", ha="left", color=INK,
                fontsize=10.5, fontweight="bold", clip_on=False)

    ax.set_yticks(y)
    ax.set_yticklabels(d["Model"], fontsize=12.5)
    for tick, m in zip(ax.get_yticklabels(), d["Model"]):
        if m == "UnSmile":
            tick.set_fontweight("bold")

    ax.set_xlim(0, 100)
    ax.set_ylim(-0.55, n - 1 + 0.95)
    ax.set_xticks([0, 20, 40, 60, 80, 100])
    ax.xaxis.grid(True, color=GRID, lw=1.2, zorder=0)
    ax.set_axisbelow(True)
    _despine(ax)
    ax.set_xlabel(t["trade_xlabel"], fontsize=10.5)

    # 레전드: 좌측 빈 공간(모든 점이 x>=52라 비어 있음) 안쪽
    ax.legend(handles=[
        Line2D([0], [0], marker="o", color="w", markerfacecolor=ACCENT, markersize=10, label=t["precision"]),
        Line2D([0], [0], marker="o", color="w", markerfacecolor=SLATE, markersize=10, label=t["recall"]),
    ], loc="upper left", bbox_to_anchor=(0.0, 1.0), ncol=1, frameon=False,
       fontsize=10.5, handletextpad=0.3, labelspacing=0.55)

    _title_block(ax, t["trade_title"], t["trade_sub"])
    fig.savefig(path, dpi=220, facecolor="white")
    plt.close(fig)
    print("saved", path)


def render_charts(csv_path, out_dir, lang="en", suffix=""):
    """lang: 'en'|'ko' · suffix: 파일명 접미사(예 '_ko')."""
    _apply_style(FONT_KO if lang == "ko" else FONT_EN)
    t = STRINGS[lang]
    df = pd.read_csv(csv_path)
    df["F1"] = df["Abuse_F1"].map(_pct)
    df["REC"] = df["Abuse_Recall"].map(_pct)
    df["PRE"] = df["Abuse_Precision"].map(_pct)
    chart_selection(df, os.path.join(out_dir, f"best_model_selection{suffix}.png"), t)
    chart_tradeoff(df, os.path.join(out_dir, f"6_model_comparison{suffix}.png"), t)


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    csv = os.path.join(here, "results", "benchmark_results.csv")
    out = os.path.join(here, "results")
    render_charts(csv, out, lang="en", suffix="")       # 영어판
    render_charts(csv, out, lang="ko", suffix="_ko")    # 한국어판
