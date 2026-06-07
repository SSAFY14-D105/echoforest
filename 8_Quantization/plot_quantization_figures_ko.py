"""
Korean publication figures for quantization/compression results.

Run after `python quantize_model.py`.
"""

from __future__ import annotations

import json
from glob import glob
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from matplotlib import font_manager


HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
REPORT = RESULTS / "quantization_report.json"

PRIMARY = "#2F9D91"
SECONDARY = "#C2CAD2"
ACCENT = "#B8A56D"
GRID = "#EBEEF1"
TEXT = "#3C4650"
CONFUSION_CMAP = LinearSegmentedColormap.from_list(
    "echoforest_teal_gray",
    ["#F7F9FA", "#D8ECE8", "#88C7C0", "#2F9D91", "#2E5E68"],
)
LABELS = ["여성/가족", "남성", "성소수자", "인종/국적", "연령", "지역", "종교", "기타 혐오", "악플/욕설", "clean"]


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
        for font_path in glob(str(Path(pattern).expanduser())):
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


def save(fig: plt.Figure, stem: str) -> None:
    fig.tight_layout()
    fig.savefig(RESULTS / f"{stem}.png", dpi=300, bbox_inches="tight")
    fig.savefig(RESULTS / f"{stem}.pdf", bbox_inches="tight")
    plt.close(fig)


def annotate(ax: plt.Axes, values: list[float], fmt: str, offset: float) -> None:
    for patch, value in zip(ax.patches, values):
        ax.text(
            patch.get_x() + patch.get_width() / 2,
            patch.get_height() + offset,
            fmt.format(value),
            ha="center",
            va="bottom",
            fontsize=10,
            color=TEXT,
        )


def plot_dashboard_ko(report: dict) -> None:
    size = report["size"]
    speed = report["speed"]
    original = report["performance"]["original"]
    int8 = report["performance"]["int8_dynamic"]
    fp16 = report["performance"]["fp16"]

    fig, axes = plt.subplots(2, 2, figsize=(11, 8.2))

    ax = axes[0, 0]
    values = [size["original_safetensors_mb"], size["int8_dynamic_mb"], size["fp16_safetensors_mb"]]
    ax.bar(["원본", "INT8", "FP16"], values, color=[SECONDARY, ACCENT, PRIMARY], width=0.58)
    ax.set_ylabel("모델 크기 (MiB)")
    ax.set_title("모델 크기 압축", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    annotate(ax, values, "{:.1f}", max(values) * 0.025)
    ax.text(1.0, max(values) * 0.82, "둘 다 약 50% 감소", ha="center", va="center", color=PRIMARY, fontsize=12, fontweight="bold")

    ax = axes[0, 1]
    values = [speed["original_ms"], speed["int8_dynamic_ms"], speed["fp16_ms"]]
    ax.bar(["원본", "INT8", "FP16"], values, color=[SECONDARY, ACCENT, PRIMARY], width=0.58)
    ax.set_ylabel("문장당 CPU 지연시간 (ms)")
    ax.set_title("CPU 추론 속도", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    annotate(ax, values, "{:.2f}", max(values) * 0.025)
    ax.text(1.0, max(values) * 0.82, f"FP16 {speed['fp16_speedup']:.2f}x", ha="center", va="center", color=PRIMARY, fontsize=12, fontweight="bold")

    ax = axes[1, 0]
    metrics = ["정밀도", "재현율", "F1"]
    original_values = [original["abuse_precision"] * 100, original["abuse_recall"] * 100, original["abuse_f1"] * 100]
    int8_values = [int8["abuse_precision"] * 100, int8["abuse_recall"] * 100, int8["abuse_f1"] * 100]
    fp16_values = [fp16["abuse_precision"] * 100, fp16["abuse_recall"] * 100, fp16["abuse_f1"] * 100]
    x = np.arange(len(metrics))
    width = 0.26
    ax.bar(x - width, original_values, width, label="원본", color=SECONDARY)
    ax.bar(x, int8_values, width, label="INT8", color=ACCENT)
    ax.bar(x + width, fp16_values, width, label="FP16", color=PRIMARY)
    ax.set_xticks(x, metrics)
    ax.set_ylim(0, 100)
    ax.set_ylabel("악플/욕설 탐지 점수 (%)")
    ax.set_title("성능 보존 여부", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.legend(frameon=False, loc="lower left")

    ax = axes[1, 1]
    cm = np.array(int8["confusion_matrix"])
    im = ax.imshow(cm, cmap=CONFUSION_CMAP)
    ax.set_title("INT8 혼동행렬: 미탐 증가", fontweight="bold")
    ax.set_xlabel("예측")
    ax.set_ylabel("실제")
    ax.set_xticks([0, 1], ["정상", "욕설"])
    ax.set_yticks([0, 1], ["정상", "욕설"])
    for row in range(2):
        for col in range(2):
            ax.text(col, row, str(cm[row, col]), ha="center", va="center", color="white" if cm[row, col] > cm.max() * 0.55 else TEXT, fontsize=16, fontweight="bold")
    fig.colorbar(im, ax=ax, shrink=0.8, label="건수")
    save(fig, "quantization_dashboard_ko")


def plot_confusion_ko(report: dict) -> None:
    matrices = [
        ("원본", np.array(report["performance"]["original"]["confusion_matrix"])),
        ("INT8", np.array(report["performance"]["int8_dynamic"]["confusion_matrix"])),
        ("FP16", np.array(report["performance"]["fp16"]["confusion_matrix"])),
    ]
    fig, axes = plt.subplots(1, 3, figsize=(12.4, 4.2))
    vmax = max(int(m.max()) for _, m in matrices)
    for ax, (title, matrix) in zip(axes, matrices):
        ax.imshow(matrix, cmap=CONFUSION_CMAP, vmin=0, vmax=vmax)
        ax.set_title(title, fontweight="bold")
        ax.set_xlabel("예측")
        ax.set_ylabel("실제")
        ax.set_xticks([0, 1], ["정상", "욕설"])
        ax.set_yticks([0, 1], ["정상", "욕설"])
        for row in range(2):
            for col in range(2):
                ax.text(col, row, str(matrix[row, col]), ha="center", va="center", color="white" if matrix[row, col] > vmax * 0.55 else TEXT, fontsize=15, fontweight="bold")
    save(fig, "confusion_matrices_ko")


def plot_per_label_ko() -> None:
    df = pd.read_csv(RESULTS / "per_label_metrics.csv")
    supported_labels = (
        df.groupby("label")["support"]
        .max()
        .reindex(LABELS)
        .loc[lambda support: support > 0]
        .index
        .tolist()
    )
    pivot = df.pivot(index="label", columns="version", values="f1").loc[supported_labels]
    x = np.arange(len(supported_labels))
    width = 0.26
    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    ax.bar(x - width, pivot["Original"] * 100, width, label="원본", color=SECONDARY)
    ax.bar(x, pivot["INT8 Dynamic"] * 100, width, label="INT8", color=ACCENT)
    ax.bar(x + width, pivot["FP16"] * 100, width, label="FP16", color=PRIMARY)
    for offset, values in [
        (-width, pivot["Original"] * 100),
        (0, pivot["INT8 Dynamic"] * 100),
        (width, pivot["FP16"] * 100),
    ]:
        for xpos, value in zip(x + offset, values):
            ax.text(xpos, value + 1.2, f"{value:.1f}", ha="center", va="bottom", fontsize=10, color=TEXT)
    ax.set_ylabel("F1 점수 (%)")
    ax.set_ylim(0, 100)
    ax.set_xticks(x, supported_labels)
    ax.set_title("라벨별 F1 보존 여부", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.legend(frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.10), ncols=3)
    save(fig, "per_label_f1_ko")


def plot_threshold_ko(report: dict) -> None:
    sweep = pd.read_csv(RESULTS / "threshold_sweep.csv")
    calibrated_threshold = report["threshold_calibration"]["selected_threshold"]
    best = sweep.iloc[sweep["f1"].idxmax()]
    calibrated = sweep.iloc[(sweep["threshold"] - calibrated_threshold).abs().idxmin()]
    fixed = sweep.iloc[(sweep["threshold"] - 0.5).abs().idxmin()]

    fig, ax = plt.subplots(figsize=(8.0, 4.8))
    ax.plot(sweep["threshold"], sweep["precision"] * 100, label="정밀도", color=SECONDARY, linewidth=2)
    ax.plot(sweep["threshold"], sweep["recall"] * 100, label="재현율", color=ACCENT, linewidth=2)
    ax.plot(sweep["threshold"], sweep["f1"] * 100, label="F1", color=PRIMARY, linewidth=2.4)
    ax.axvline(0.5, color=SECONDARY, linestyle="--", linewidth=1.2, alpha=0.7)
    ax.axvline(calibrated_threshold, color=PRIMARY, linestyle=":", linewidth=1.8, alpha=0.85)
    ax.scatter([best["threshold"]], [best["f1"] * 100], color=PRIMARY, s=60, zorder=5)
    ax.text(best["threshold"] + 0.015, best["f1"] * 100, f"test 최고 F1 {best['f1'] * 100:.1f}%\n@ {best['threshold']:.2f}", va="center", fontsize=10, color=PRIMARY)
    ax.text(0.515, fixed["recall"] * 100 - 9, "고정\n0.50", va="center", fontsize=10, color=SECONDARY)
    ax.text(calibrated_threshold + 0.015, calibrated["f1"] * 100 - 8, f"valid 보정\n{calibrated_threshold:.2f}", va="center", fontsize=10, color=PRIMARY)
    ax.set_xlabel("INT8 악플/욕설 임계값")
    ax.set_ylabel("점수 (%)")
    ax.set_ylim(0, 105)
    ax.grid(color=GRID, linewidth=0.8)
    ax.legend(frameon=False, loc="lower left")
    ax.set_title("INT8 임계값 민감도", fontweight="bold")
    save(fig, "threshold_sweep_ko")


def main() -> None:
    configure_fonts()
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    plot_dashboard_ko(report)
    plot_confusion_ko(report)
    plot_per_label_ko()
    plot_threshold_ko(report)
    print("saved Korean quantization figures to", RESULTS)


if __name__ == "__main__":
    main()
