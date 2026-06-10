"""
Publication-ready figures for the model-comparison stage.

Input:
    results/comparison_results.csv

Outputs:
    results/paper_model_ranking.png/.pdf
    results/paper_selected_tradeoff.png/.pdf
    results/paper_domain_data_effect.png/.pdf
"""

from __future__ import annotations

from glob import glob
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib import font_manager


HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
CSV = RESULTS / "comparison_results.csv"

SELECTED = "Full v2 Game"
BASELINE = "Baseline"

DISPLAY = {
    "Baseline": "Baseline\n(kor_unsmile)",
    "LoRA v1 Game": "LoRA v1\nKcELECTRA",
    "LoRA v1 Tutorial": "LoRA v1\nkcbert",
    "LoRA v2 Game": "LoRA v2\nKcELECTRA",
    "LoRA v2 Tutorial": "LoRA v2\nkcbert",
    "Full v1 Game": "Full v1\nKcELECTRA",
    "Full v1 Tutorial": "Full v1\nkcbert",
    "Full v2 Game": "Full v2\nKcELECTRA",
    "Full v2 Tutorial": "Full v2\nkcbert",
}

PRIMARY = "#2F9D91"
PRIMARY_LIGHT = "#D8ECE8"
SECONDARY = "#C2CAD2"
MUTED = "#DDE3E8"
ACCENT = "#7E8F9B"
GRID = "#EBEEF1"
TEXT = "#3C4650"


def configure_fonts() -> None:
    font_patterns = [
        "/Users/sondahyun/Pretendard-1.3.9/public/static/Pretendard-*.otf",
        "/Users/sondahyun/Pretendard-1.3.9/public/variable/PretendardVariable.ttf",
        "~/Library/Fonts/Pretendard-Regular.*",
        "/Library/Fonts/Pretendard-Regular.*",
        "~/Library/Fonts/PretendardVariable.*",
        "/Library/Fonts/PretendardVariable.*",
        "~/Library/Fonts/Pretendard*.otf",
        "/Library/Fonts/Pretendard*.otf",
        "~/Library/Fonts/Pretendard*.ttf",
        "/Library/Fonts/Pretendard*.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/Library/Fonts/AppleGothic.ttf",
        "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ]
    font_family = None
    for pattern in font_patterns:
        matches = glob(str(Path(pattern).expanduser()))
        for font_path in matches:
            path = Path(font_path)
            if path.exists():
                font_manager.fontManager.addfont(str(path))
                font_family = font_manager.FontProperties(fname=str(path)).get_name()
        if font_family:
            plt.rcParams["font.family"] = font_family
            break

    plt.rcParams.update(
        {
            "axes.unicode_minus": False,
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "axes.edgecolor": "#DDE3E8",
            "axes.labelcolor": TEXT,
            "xtick.color": TEXT,
            "ytick.color": TEXT,
            "font.size": 12,
            "axes.titlesize": 15,
            "axes.labelsize": 12,
            "legend.fontsize": 11,
        }
    )


def save(fig: plt.Figure, name: str) -> None:
    fig.tight_layout()
    fig.savefig(RESULTS / f"{name}.png", dpi=300, bbox_inches="tight")
    fig.savefig(RESULTS / f"{name}.pdf", bbox_inches="tight")
    plt.close(fig)


def load_results() -> pd.DataFrame:
    df = pd.read_csv(CSV)
    for col in ["abuse_precision", "abuse_recall", "abuse_f1", "clean_f1", "lrap"]:
        df[col] = pd.to_numeric(df[col])
    return df


def plot_model_ranking(df: pd.DataFrame) -> None:
    ordered = df.sort_values("abuse_f1", ascending=True).copy()
    y = np.arange(len(ordered))
    colors = [PRIMARY if model == SELECTED else SECONDARY if model == BASELINE else MUTED for model in ordered["model"]]

    fig, ax = plt.subplots(figsize=(8.6, 6.2))
    ax.barh(y, ordered["abuse_f1"] * 100, color=colors, height=0.68)
    ax.scatter(ordered["abuse_recall"] * 100, y, color=ACCENT, s=46, zorder=3, label="Recall", edgecolor="white", linewidth=0.7)
    ax.set_yticks(y, [DISPLAY.get(model, model) for model in ordered["model"]])
    ax.set_xlabel("Abuse F1 score (%)")
    ax.set_xlim(55, 92)
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.set_title("Model ranking on the evaluation set (n=482)", fontweight="bold", pad=12)

    for idx, row in ordered.iterrows():
        pos = list(ordered.index).index(idx)
        ax.text(
            row["abuse_f1"] * 100 + 0.6,
            pos,
            f"{row['abuse_f1'] * 100:.1f}",
            va="center",
            ha="left",
            fontsize=10,
            color=TEXT,
        )

    ax.axvline(
        float(df[df["model"] == BASELINE]["abuse_f1"].iloc[0]) * 100,
        color=ACCENT,
        linewidth=1.4,
        linestyle="--",
        alpha=0.65,
        label="Baseline F1",
    )
    ax.legend(frameon=False, loc="lower right")
    save(fig, "paper_model_ranking")


def plot_model_ranking_ko(df: pd.DataFrame) -> None:
    ordered = df.sort_values("lrap", ascending=True).copy()
    y = np.arange(len(ordered))
    colors = [PRIMARY if model == SELECTED else SECONDARY if model == BASELINE else MUTED for model in ordered["model"]]

    fig, ax = plt.subplots(figsize=(8.6, 6.2))
    ax.barh(y, ordered["lrap"] * 100, color=colors, height=0.68)
    ax.set_yticks(y, [DISPLAY.get(model, model) for model in ordered["model"]])
    ax.set_xlabel("LRAP × 100 (임계값에 휘둘리지 않는 랭킹 지표)")
    ax.set_xlim(85, 96)
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.set_title("학습에 쓰지 않은 평가셋 482개로 측정한 모델별 LRAP", fontweight="bold", pad=30)
    ax.text(0.5, 1.035,
            "v1 = 댓글 보정 데이터만 학습,  v2 = + 게임채팅 518건 추가 학습   (base: KcELECTRA / kcbert,  방식: Full / LoRA)",
            transform=ax.transAxes, fontsize=9.3, color="#9AA5B1", ha="center")

    for idx, row in ordered.iterrows():
        pos = list(ordered.index).index(idx)
        ax.text(row["lrap"] * 100 + 0.15, pos, f"{row['lrap'] * 100:.1f}", va="center", ha="left", fontsize=10, color=TEXT)

    ax.axvline(
        float(df[df["model"] == BASELINE]["lrap"].iloc[0]) * 100,
        color=ACCENT,
        linewidth=1.4,
        linestyle="--",
        alpha=0.65,
        label="Baseline LRAP",
    )
    ax.legend(frameon=False, loc="lower right")
    save(fig, "paper_model_ranking_ko")


def plot_selected_tradeoff(df: pd.DataFrame) -> None:
    baseline = df[df["model"] == BASELINE].iloc[0]
    selected = df[df["model"] == SELECTED].iloc[0]
    metrics = ["Precision", "Recall", "F1"]
    base_values = np.array([baseline["abuse_precision"], baseline["abuse_recall"], baseline["abuse_f1"]]) * 100
    selected_values = np.array([selected["abuse_precision"], selected["abuse_recall"], selected["abuse_f1"]]) * 100

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    x = np.arange(len(metrics))
    width = 0.36
    ax.bar(x - width / 2, base_values, width, label="Baseline", color=SECONDARY)
    ax.bar(x + width / 2, selected_values, width, label="Full v2 KcELECTRA", color=PRIMARY)
    ax.set_xticks(x, metrics)
    ax.set_ylim(0, 112)
    ax.set_ylabel("Score (%)")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    recall_gain = selected_values[1] - base_values[1]
    f1_gain = selected_values[2] - base_values[2]
    ax.set_title(
        f"Precision-recall trade-off after fine-tuning\nRecall +{recall_gain:.1f}p | F1 +{f1_gain:.1f}p",
        fontweight="bold",
        pad=12,
    )
    ax.legend(frameon=False, loc="upper center", ncols=2)

    for xpos, value in zip(x - width / 2, base_values):
        ax.text(xpos, value + 2.0, f"{value:.1f}", ha="center", va="bottom", fontsize=10, color=ACCENT)
    for xpos, value in zip(x + width / 2, selected_values):
        ax.text(xpos, value + 2.0, f"{value:.1f}", ha="center", va="bottom", fontsize=10, color=PRIMARY, fontweight="bold")

    save(fig, "paper_selected_tradeoff")


def plot_selected_tradeoff_ko(df: pd.DataFrame) -> None:
    baseline = df[df["model"] == BASELINE].iloc[0]
    selected = df[df["model"] == SELECTED].iloc[0]
    metrics = ["정밀도", "재현율", "F1"]
    base_values = np.array([baseline["abuse_precision"], baseline["abuse_recall"], baseline["abuse_f1"]]) * 100
    selected_values = np.array([selected["abuse_precision"], selected["abuse_recall"], selected["abuse_f1"]]) * 100

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    x = np.arange(len(metrics))
    width = 0.36
    ax.bar(x - width / 2, base_values, width, label="Baseline (파인튜닝 전)", color=SECONDARY)
    ax.bar(x + width / 2, selected_values, width, label="Full v2 (게임 학습 후, 선정)", color=PRIMARY)
    ax.set_xticks(x, metrics)
    ax.set_ylim(0, 112)
    ax.set_ylabel("점수 (%)")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    recall_gain = selected_values[1] - base_values[1]
    f1_gain = selected_values[2] - base_values[2]
    ax.set_title(
        f"파인튜닝 후 정밀도-재현율 trade-off\n재현율 +{recall_gain:.1f}p | F1 +{f1_gain:.1f}p",
        fontweight="bold",
        pad=12,
    )
    ax.legend(frameon=False, loc="upper center", ncols=2)

    for xpos, value in zip(x - width / 2, base_values):
        ax.text(xpos, value + 2.0, f"{value:.1f}", ha="center", va="bottom", fontsize=10, color=ACCENT)
    for xpos, value in zip(x + width / 2, selected_values):
        ax.text(xpos, value + 2.0, f"{value:.1f}", ha="center", va="bottom", fontsize=10, color=PRIMARY, fontweight="bold")

    save(fig, "paper_selected_tradeoff_ko")


def plot_domain_data_effect(df: pd.DataFrame) -> None:
    pairs = [
        ("LoRA v1 Game", "LoRA v2 Game", "LoRA / KcELECTRA"),
        ("LoRA v1 Tutorial", "LoRA v2 Tutorial", "LoRA / kcbert"),
        ("Full v1 Game", "Full v2 Game", "Full / KcELECTRA"),
        ("Full v1 Tutorial", "Full v2 Tutorial", "Full / kcbert"),
    ]
    fig, ax = plt.subplots(figsize=(8.2, 4.9))
    y = np.arange(len(pairs))[::-1]

    for row, (before, after, label) in zip(y, pairs):
        v1 = float(df[df["model"] == before]["abuse_recall"].iloc[0]) * 100
        v2 = float(df[df["model"] == after]["abuse_recall"].iloc[0]) * 100
        ax.plot([v1, v2], [row, row], color=GRID, linewidth=4.8, solid_capstyle="round", zorder=1)
        ax.annotate(
            "",
            xy=(v2 - 0.6, row),
            xytext=(v1 + 0.6, row),
            arrowprops=dict(arrowstyle="->", color=PRIMARY, lw=1.8),
            zorder=4,
        )
        ax.scatter([v1], [row], color=SECONDARY, s=140, zorder=3, edgecolor="white", linewidth=0.8)
        ax.scatter([v2], [row], color=PRIMARY, s=150, zorder=5, edgecolor="white", linewidth=0.8)
        ax.text(v1, row + 0.22, f"{v1:.0f}", color=SECONDARY, ha="center", va="bottom", fontsize=10)
        ax.text(v2, row + 0.22, f"{v2:.0f}", color=PRIMARY, ha="center", va="bottom", fontsize=10, fontweight="bold")

    base_r = float(df[df["model"] == BASELINE]["abuse_recall"].iloc[0]) * 100
    ax.axvline(base_r, color=ACCENT, linestyle="--", linewidth=1.2, alpha=0.55)
    ax.text(base_r, -0.58, f"baseline {base_r:.0f}", color=ACCENT, ha="center", va="top", fontsize=9.5)
    ax.set_xlim(56, 89)
    ax.set_ylim(-0.75, len(pairs) - 0.35)
    ax.set_yticks(y, [label for _, _, label in pairs])
    ax.set_xlabel("Abuse Recall (%)")
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.set_title("Effect of adding 518 game-chat training samples", fontweight="bold", pad=12)
    ax.legend(
        handles=[
            plt.Line2D([0], [0], marker="o", color="w", markerfacecolor=SECONDARY, markersize=9, label="v1 corrected UnSmile"),
            plt.Line2D([0], [0], marker="o", color="w", markerfacecolor=PRIMARY, markersize=9, label="v2 + game data"),
        ],
        frameon=False,
        loc="lower right",
    )
    save(fig, "paper_domain_data_effect")


def plot_domain_data_effect_ko(df: pd.DataFrame) -> None:
    pairs = [
        ("LoRA v1 Game", "LoRA v2 Game", "LoRA / KcELECTRA"),
        ("LoRA v1 Tutorial", "LoRA v2 Tutorial", "LoRA / kcbert"),
        ("Full v1 Game", "Full v2 Game", "Full / KcELECTRA"),
        ("Full v1 Tutorial", "Full v2 Tutorial", "Full / kcbert"),
    ]
    fig, ax = plt.subplots(figsize=(8.2, 4.9))
    y = np.arange(len(pairs))[::-1]

    for row, (before, after, label) in zip(y, pairs):
        v1 = float(df[df["model"] == before]["abuse_recall"].iloc[0]) * 100
        v2 = float(df[df["model"] == after]["abuse_recall"].iloc[0]) * 100
        ax.plot([v1, v2], [row, row], color=GRID, linewidth=4.8, solid_capstyle="round", zorder=1)
        ax.annotate(
            "",
            xy=(v2 - 0.6, row),
            xytext=(v1 + 0.6, row),
            arrowprops=dict(arrowstyle="->", color=PRIMARY, lw=1.8),
            zorder=4,
        )
        ax.scatter([v1], [row], color=SECONDARY, s=140, zorder=3, edgecolor="white", linewidth=0.8)
        ax.scatter([v2], [row], color=PRIMARY, s=150, zorder=5, edgecolor="white", linewidth=0.8)
        ax.text(v1, row + 0.22, f"{v1:.0f}", color=SECONDARY, ha="center", va="bottom", fontsize=10)
        ax.text(v2, row + 0.22, f"{v2:.0f}", color=PRIMARY, ha="center", va="bottom", fontsize=10, fontweight="bold")

    base_r = float(df[df["model"] == BASELINE]["abuse_recall"].iloc[0]) * 100
    ax.axvline(base_r, color=ACCENT, linestyle="--", linewidth=1.2, alpha=0.55)
    ax.text(base_r, -0.58, f"baseline {base_r:.0f}", color=ACCENT, ha="center", va="top", fontsize=9.5)
    ax.set_xlim(56, 89)
    ax.set_ylim(-0.75, len(pairs) - 0.35)
    ax.set_yticks(y, [label for _, _, label in pairs])
    ax.set_xlabel("부정어 재현율 (%)")
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.set_title("게임 채팅 518건 추가 학습 효과", fontweight="bold", pad=12)
    ax.legend(
        handles=[
            plt.Line2D([0], [0], marker="o", color="w", markerfacecolor=SECONDARY, markersize=9, label="v1 보정 UnSmile"),
            plt.Line2D([0], [0], marker="o", color="w", markerfacecolor=PRIMARY, markersize=9, label="v2 + 게임 데이터"),
        ],
        frameon=False,
        loc="lower right",
    )
    save(fig, "paper_domain_data_effect_ko")


def main() -> None:
    configure_fonts()
    df = load_results()
    plot_model_ranking(df)
    plot_model_ranking_ko(df)
    plot_selected_tradeoff(df)
    plot_selected_tradeoff_ko(df)
    plot_domain_data_effect(df)
    plot_domain_data_effect_ko(df)
    print("saved paper figures to", RESULTS)


if __name__ == "__main__":
    main()
