"""
8_Quantization -- INT8 dynamic quantization for the selected model.

Selected model:
    Full v2 KcELECTRA
    5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model

Evaluation:
    0_Data_Collection/datasets/test_set.tsv
    abuse = not-clean (clean 제외 9개 라벨 max > 0.5)

Outputs:
    quantized_model/model_int8.pt
    results/quantization_report.json
    results/quantization_results.csv
    results/per_label_metrics.csv
    results/*.png and *.pdf publication-ready figures
"""

from __future__ import annotations

import json
import platform
import time
import warnings
from glob import glob
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
from matplotlib.colors import LinearSegmentedColormap
from matplotlib import font_manager
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
from transformers import AutoModelForSequenceClassification, AutoTokenizer

warnings.filterwarnings("ignore")


ROOT = Path(__file__).resolve().parents[1]
HERE = Path(__file__).resolve().parent
MODEL_PATH = (
    ROOT
    / "5_Full_Fine_Tuning"
    / "v2_corrected_plus_collected"
    / "output"
    / "full_game_kcelectra_v2"
    / "best_model"
)
TEST_PATH = ROOT / "0_Data_Collection" / "datasets" / "test_set.tsv"
VALID_PATH = ROOT / "3_UnSmile_Correction" / "unsmile_valid_corrected.tsv"
OUT_DIR = HERE / "quantized_model"
FP16_DIR = HERE / "fp16_model"
RESULTS_DIR = HERE / "results"

LABELS = [
    "여성/가족",
    "남성",
    "성소수자",
    "인종/국적",
    "연령",
    "지역",
    "종교",
    "기타 혐오",
    "악플/욕설",
    "clean",
]
ABUSE_IDX = 8
CLEAN_IDX = 9
THRESHOLD = 0.5
MAX_LENGTH = 128
BATCH_SIZE = 32

PRIMARY = "#2F9D91"
PRIMARY_LIGHT = "#D8ECE8"
SECONDARY = "#C2CAD2"
ACCENT = "#5E7E9E"
GRID = "#EBEEF1"
TEXT = "#3C4650"
CONFUSION_CMAP = LinearSegmentedColormap.from_list(
    "echoforest_teal_gray",
    ["#F7F9FA", "#D8ECE8", "#88C7C0", "#2F9D91", "#2E5E68"],
)


def configure_fonts() -> None:
    """Use a Korean-capable font when available, while staying portable."""
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
            "axes.edgecolor": "#DDE3E8",
            "axes.labelcolor": TEXT,
            "xtick.color": TEXT,
            "ytick.color": TEXT,
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "font.size": 12,
            "axes.titlesize": 15,
            "axes.labelsize": 12,
            "legend.fontsize": 11,
        }
    )


def pick_quantized_engine() -> str:
    supported = list(torch.backends.quantized.supported_engines)
    machine = platform.machine().lower()
    preferred = ["qnnpack", "fbgemm", "x86", "onednn"] if "arm" in machine or "aarch" in machine else ["fbgemm", "x86", "qnnpack", "onednn"]

    for engine in preferred:
        if engine in supported:
            torch.backends.quantized.engine = engine
            return engine

    if supported:
        torch.backends.quantized.engine = supported[0]
        return supported[0]

    raise RuntimeError("No quantized backend is available in this PyTorch build.")


def model_size_mb(model: torch.nn.Module) -> float:
    params = sum(p.numel() * p.element_size() for p in model.parameters())
    buffers = sum(b.numel() * b.element_size() for b in model.buffers())
    return (params + buffers) / 1024 / 1024


def file_size_mb(path: Path) -> float:
    return path.stat().st_size / 1024 / 1024


def predict_probs(model: torch.nn.Module, tokenizer: AutoTokenizer, texts: list[str]) -> np.ndarray:
    batches: list[np.ndarray] = []
    model.eval()
    with torch.no_grad():
        for start in range(0, len(texts), BATCH_SIZE):
            batch_texts = texts[start : start + BATCH_SIZE]
            encoded = tokenizer(
                batch_texts,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=MAX_LENGTH,
            )
            logits = model(**encoded).logits.float()
            batches.append(torch.sigmoid(logits).cpu().numpy())

    return np.vstack(batches)


def evaluate(probs: np.ndarray, labels: np.ndarray, threshold: float = THRESHOLD) -> dict:
    preds = (probs > threshold).astype(int)
    summary: dict[str, float | int | list[list[int]]] = {}

    # abuse = not-clean (clean 제외 9개 라벨 max > threshold), 배포·Step 2·Step 6과 동일 정의
    hate_idx = list(range(CLEAN_IDX))  # 0..8 = 9개 혐오 라벨
    abuse_gt = (labels[:, hate_idx].sum(axis=1) > 0).astype(int)
    abuse_pred = (preds[:, hate_idx].sum(axis=1) > 0).astype(int)
    for key, gt, pred in [("abuse", abuse_gt, abuse_pred), ("clean", labels[:, CLEAN_IDX], preds[:, CLEAN_IDX])]:
        precision, recall, f1, _ = precision_recall_fscore_support(
            gt,
            pred,
            average="binary",
            zero_division=0,
        )
        summary[f"{key}_precision"] = round(float(precision), 4)
        summary[f"{key}_recall"] = round(float(recall), 4)
        summary[f"{key}_f1"] = round(float(f1), 4)

    tn, fp, fn, tp = confusion_matrix(abuse_gt, abuse_pred).ravel()
    summary.update(tp=int(tp), tn=int(tn), fp=int(fp), fn=int(fn))
    summary["confusion_matrix"] = [[int(tn), int(fp)], [int(fn), int(tp)]]
    summary["threshold"] = round(float(threshold), 4)
    return summary


def per_label_metrics(prob_sets: list[tuple[str, np.ndarray]], labels: np.ndarray) -> pd.DataFrame:
    rows = []
    for idx, label in enumerate(LABELS):
        for version, probs in prob_sets:
            pred = (probs[:, idx] > THRESHOLD).astype(int)
            precision, recall, f1, support = precision_recall_fscore_support(
                labels[:, idx],
                pred,
                average="binary",
                zero_division=0,
            )
            rows.append(
                {
                    "label": label,
                    "version": version,
                    "precision": round(float(precision), 4),
                    "recall": round(float(recall), 4),
                    "f1": round(float(f1), 4),
                    "support": int(labels[:, idx].sum()),
                }
            )
    return pd.DataFrame(rows)


def benchmark_latency(model: torch.nn.Module, tokenizer: AutoTokenizer, texts: list[str], repeats: int = 120) -> tuple[float, float]:
    latencies = []
    for text in texts:
        encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=MAX_LENGTH)
        for _ in range(10):
            with torch.no_grad():
                model(**encoded)

        start = time.perf_counter()
        for _ in range(repeats):
            with torch.no_grad():
                model(**encoded)
        elapsed = (time.perf_counter() - start) / repeats * 1000
        latencies.append(elapsed)

    return float(np.mean(latencies)), float(np.std(latencies))


def save_figure(fig: plt.Figure, stem: str) -> None:
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / f"{stem}.png", dpi=300, bbox_inches="tight")
    fig.savefig(RESULTS_DIR / f"{stem}.pdf", bbox_inches="tight")
    plt.close(fig)


def annotate_bars(ax: plt.Axes, values: list[float], fmt: str, offset: float = 0.02) -> None:
    for patch, value in zip(ax.patches, values):
        height = patch.get_height()
        ax.text(
            patch.get_x() + patch.get_width() / 2,
            height + offset,
            fmt.format(value),
            ha="center",
            va="bottom",
            fontsize=10,
            color=TEXT,
        )


def plot_confusion_matrices(original: dict, quantized: dict) -> None:
    matrices = [
        ("Original", np.array(original["confusion_matrix"])),
        ("INT8 Quantized", np.array(quantized["confusion_matrix"])),
    ]
    fig, axes = plt.subplots(1, 2, figsize=(9.5, 4.2))
    vmax = max(int(m.max()) for _, m in matrices)

    for ax, (title, matrix) in zip(axes, matrices):
        ax.imshow(matrix, cmap=CONFUSION_CMAP, vmin=0, vmax=vmax)
        ax.set_title(title, pad=10, fontweight="bold")
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_xticks([0, 1], ["Non-abuse", "Abuse"])
        ax.set_yticks([0, 1], ["Non-abuse", "Abuse"])
        for row in range(2):
            for col in range(2):
                ax.text(
                    col,
                    row,
                    f"{matrix[row, col]}",
                    ha="center",
                    va="center",
                    color="white" if matrix[row, col] > vmax * 0.55 else TEXT,
                    fontsize=16,
                    fontweight="bold",
                )
    save_figure(fig, "confusion_matrices")


def plot_quantization_dashboard(report: dict) -> None:
    size = report["size"]
    speed = report["speed"]
    original = report["performance"]["original"]
    int8 = report["performance"]["int8_dynamic"]
    fp16 = report["performance"]["fp16"]

    fig, axes = plt.subplots(2, 2, figsize=(11, 8.2))

    ax = axes[0, 0]
    size_values = [size["original_safetensors_mb"], size["int8_dynamic_mb"], size["fp16_safetensors_mb"]]
    ax.bar(["Original", "INT8", "FP16"], size_values, color=[SECONDARY, ACCENT, PRIMARY], width=0.58)
    ax.set_ylabel("Model size (MiB)")
    ax.set_title("Model Footprint", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    annotate_bars(ax, size_values, "{:.1f}", offset=max(size_values) * 0.025)
    ax.text(
        0.5,
        max(size_values) * 0.82,
        f"INT8 {size['int8_compression']:.2f}x\nFP16 {size['fp16_compression']:.2f}x",
        ha="center",
        va="center",
        fontsize=12,
        color=PRIMARY,
        fontweight="bold",
    )

    ax = axes[0, 1]
    speed_values = [speed["original_ms"], speed["int8_dynamic_ms"], speed["fp16_ms"]]
    ax.bar(["Original", "INT8", "FP16"], speed_values, color=[SECONDARY, ACCENT, PRIMARY], width=0.58)
    ax.set_ylabel("Latency per sentence (ms)")
    ax.set_title("CPU Inference Latency", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    annotate_bars(ax, speed_values, "{:.2f}", offset=max(speed_values) * 0.025)
    ax.text(
        0.5,
        max(speed_values) * 0.82,
        f"INT8 {speed['int8_speedup']:.2f}x",
        ha="center",
        va="center",
        fontsize=13,
        color=ACCENT if speed["int8_speedup"] >= 1 else SECONDARY,
        fontweight="bold",
    )

    ax = axes[1, 0]
    metric_names = ["Precision", "Recall", "F1"]
    original_metrics = [
        original["abuse_precision"] * 100,
        original["abuse_recall"] * 100,
        original["abuse_f1"] * 100,
    ]
    int8_metrics = [
        int8["abuse_precision"] * 100,
        int8["abuse_recall"] * 100,
        int8["abuse_f1"] * 100,
    ]
    fp16_metrics = [
        fp16["abuse_precision"] * 100,
        fp16["abuse_recall"] * 100,
        fp16["abuse_f1"] * 100,
    ]
    x = np.arange(len(metric_names))
    width = 0.26
    ax.bar(x - width, original_metrics, width, label="Original", color=SECONDARY)
    ax.bar(x, int8_metrics, width, label="INT8", color=ACCENT)
    ax.bar(x + width, fp16_metrics, width, label="FP16", color=PRIMARY)
    ax.set_xticks(x, metric_names)
    ax.set_ylim(0, 100)
    ax.set_ylabel("Abuse detection score (%)")
    ax.set_title("Abuse Metric Preservation", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.legend(frameon=False, loc="lower left")

    ax = axes[1, 1]
    cm = np.array(int8["confusion_matrix"])
    im = ax.imshow(cm, cmap=CONFUSION_CMAP)
    ax.set_title("INT8 Confusion Matrix (quality drift)", fontweight="bold")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_xticks([0, 1], ["Non-abuse", "Abuse"])
    ax.set_yticks([0, 1], ["Non-abuse", "Abuse"])
    for row in range(2):
        for col in range(2):
            ax.text(
                col,
                row,
                str(cm[row, col]),
                ha="center",
                va="center",
                color="white" if cm[row, col] > cm.max() * 0.55 else TEXT,
                fontsize=16,
                fontweight="bold",
            )
    fig.colorbar(im, ax=ax, shrink=0.8, label="Count")

    save_figure(fig, "quantization_dashboard")


def plot_per_label_f1(metrics_df: pd.DataFrame) -> None:
    supported_labels = (
        metrics_df.groupby("label")["support"]
        .max()
        .reindex(LABELS)
        .loc[lambda support: support > 0]
        .index
        .tolist()
    )
    pivot = metrics_df.pivot(index="label", columns="version", values="f1").loc[supported_labels]
    original = pivot["Original"].to_numpy() * 100
    int8 = pivot["INT8 Dynamic"].to_numpy() * 100
    fp16 = pivot["FP16"].to_numpy() * 100

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    x = np.arange(len(supported_labels))
    width = 0.26
    ax.bar(x - width, original, width, label="Original", color=SECONDARY)
    ax.bar(x, int8, width, label="INT8", color=ACCENT)
    ax.bar(x + width, fp16, width, label="FP16", color=PRIMARY)
    for offset, values in [(-width, original), (0, int8), (width, fp16)]:
        for xpos, value in zip(x + offset, values):
            ax.text(xpos, value + 1.2, f"{value:.1f}", ha="center", va="bottom", fontsize=10, color=TEXT)
    ax.set_ylabel("F1 score (%)")
    ax.set_ylim(0, 100)
    ax.set_xticks(x, supported_labels)
    ax.set_title("Per-label F1 Preservation", fontweight="bold")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.legend(frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.10), ncols=3)
    save_figure(fig, "per_label_f1")


def plot_threshold_sweep(int8_probs: np.ndarray, labels: np.ndarray, calibrated_threshold: float) -> pd.DataFrame:
    rows = []
    for threshold in np.round(np.arange(0.1, 0.91, 0.02), 2):
        pred = (int8_probs[:, ABUSE_IDX] > threshold).astype(int)
        precision, recall, f1, _ = precision_recall_fscore_support(
            labels[:, ABUSE_IDX],
            pred,
            average="binary",
            zero_division=0,
        )
        rows.append(
            {
                "threshold": float(threshold),
                "precision": round(float(precision), 4),
                "recall": round(float(recall), 4),
                "f1": round(float(f1), 4),
            }
        )

    sweep = pd.DataFrame(rows)
    plot_threshold_sweep_dataframe(sweep, calibrated_threshold)
    return sweep


def plot_threshold_sweep_dataframe(sweep: pd.DataFrame, calibrated_threshold: float) -> None:
    best = sweep.iloc[sweep["f1"].idxmax()]
    fixed = sweep.iloc[(sweep["threshold"] - THRESHOLD).abs().idxmin()]
    calibrated = sweep.iloc[(sweep["threshold"] - calibrated_threshold).abs().idxmin()]

    fig, ax = plt.subplots(figsize=(8.0, 4.8))
    ax.plot(sweep["threshold"], sweep["precision"] * 100, label="Precision", color=SECONDARY, linewidth=2)
    ax.plot(sweep["threshold"], sweep["recall"] * 100, label="Recall", color=ACCENT, linewidth=2)
    ax.plot(sweep["threshold"], sweep["f1"] * 100, label="F1", color=PRIMARY, linewidth=2.4)
    ax.axvline(THRESHOLD, color=SECONDARY, linestyle="--", linewidth=1.2, alpha=0.7)
    ax.axvline(calibrated_threshold, color=PRIMARY, linestyle=":", linewidth=1.8, alpha=0.85)
    ax.scatter([best["threshold"]], [best["f1"] * 100], color=PRIMARY, s=60, zorder=5)
    ax.text(
        best["threshold"] + 0.015,
        best["f1"] * 100,
        f"best F1 {best['f1'] * 100:.1f}%\n@ {best['threshold']:.2f}",
        va="center",
        fontsize=10,
        color=PRIMARY,
    )
    ax.text(
        THRESHOLD + 0.015,
        fixed["recall"] * 100 - 9,
        "fixed\n0.50",
        va="center",
        fontsize=10,
        color=SECONDARY,
    )
    ax.text(
        calibrated_threshold + 0.015,
        calibrated["f1"] * 100 - 8,
        f"valid-calibrated\n{calibrated_threshold:.2f}",
        va="center",
        fontsize=10,
        color=PRIMARY,
    )
    ax.set_xlabel("INT8 abuse threshold")
    ax.set_ylabel("Score (%)")
    ax.set_ylim(0, 105)
    ax.grid(color=GRID, linewidth=0.8)
    ax.legend(frameon=False, loc="lower left")
    ax.set_title("INT8 threshold sensitivity on test_set", fontweight="bold")
    save_figure(fig, "threshold_sweep")


def calibrate_threshold(probs: np.ndarray, labels: np.ndarray) -> pd.DataFrame:
    rows = []
    for threshold in np.round(np.arange(0.1, 0.91, 0.01), 2):
        result = evaluate(probs, labels, threshold=float(threshold))
        rows.append(
            {
                "threshold": float(threshold),
                "precision": result["abuse_precision"],
                "recall": result["abuse_recall"],
                "f1": result["abuse_f1"],
                "tp": result["tp"],
                "tn": result["tn"],
                "fp": result["fp"],
                "fn": result["fn"],
            }
        )
    return pd.DataFrame(rows)


def write_load_guide(engine: str, report: dict) -> None:
    int8_status = "recommended" if report["conclusion"]["int8_success"] else "not recommended for deployment"
    guide = f"""# Quantized Model Loading Guide

This directory stores the INT8 dynamic-quantized state dict for **Full v2 KcELECTRA**.

Current INT8 status: **{int8_status}**.

- Fixed threshold: not-clean (clean 제외 9개 라벨 max) > 0.5
- Original Abuse Recall/F1: {report["performance"]["original"]["abuse_recall"]:.4f} / {report["performance"]["original"]["abuse_f1"]:.4f}
- INT8 Abuse Recall/F1: {report["performance"]["int8_dynamic"]["abuse_recall"]:.4f} / {report["performance"]["int8_dynamic"]["abuse_f1"]:.4f}
- INT8 calibrated threshold: {report["threshold_calibration"]["selected_threshold"]:.2f}
- INT8 calibrated test Recall/F1: {report["threshold_calibration"]["test_recall"]:.4f} / {report["threshold_calibration"]["test_f1"]:.4f}
- FP16 Abuse Recall/F1: {report["performance"]["fp16"]["abuse_recall"]:.4f} / {report["performance"]["fp16"]["abuse_f1"]:.4f}

The FP16 artifact in `../fp16_model/` is the recommended compressed artifact when metric
preservation is more important than INT8 CPU speed.

Dynamic quantization changes module classes at runtime, so `model_int8.pt` is not loaded with
`AutoModelForSequenceClassification.from_pretrained()` directly. Recreate the original model,
apply the same dynamic quantization, then load this state dict.

```python
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_PATH = "../5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model"
INT8_STATE = "model_int8.pt"

torch.backends.quantized.engine = "{engine}"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH).eval()
quantized_model = torch.ao.quantization.quantize_dynamic(
    model,
    {{torch.nn.Linear}},
    dtype=torch.qint8,
).eval()
quantized_model.load_state_dict(torch.load(INT8_STATE, map_location="cpu"))

# abuse = sigmoid(logits)[:9].max() > 0.5  (not-clean)
```
"""
    (OUT_DIR / "README.md").write_text(guide, encoding="utf-8")


def main() -> None:
    configure_fonts()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FP16_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    engine = pick_quantized_engine()
    print(f"[backend] quantized.engine = {engine}")
    print(f"[1/6] Load selected model: {MODEL_PATH.relative_to(ROOT)}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH).eval()
    params = sum(p.numel() for p in model.parameters())
    original_memory_mb = model_size_mb(model)
    print(f"  params={params:,} memory≈{original_memory_mb:.1f} MiB")

    print("[2/6] Apply INT8 dynamic quantization to Linear layers")
    quantized_model = torch.ao.quantization.quantize_dynamic(
        model,
        {torch.nn.Linear},
        dtype=torch.qint8,
    ).eval()

    print("[3/7] Prepare FP16 compressed artifact")
    fp16_model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH).half().eval()
    fp16_model.save_pretrained(FP16_DIR, safe_serialization=True)
    tokenizer.save_pretrained(FP16_DIR)

    print("[4/7] Benchmark CPU latency")
    sample_texts = [
        "진짜 너 때문에 졌잖아 빡치네",
        "잘했어 다음에 또 하자",
        "아 답답해 좀 빨리 가",
    ]
    original_ms, original_sd = benchmark_latency(model, tokenizer, sample_texts)
    quantized_ms, quantized_sd = benchmark_latency(quantized_model, tokenizer, sample_texts)
    fp16_ms, fp16_sd = benchmark_latency(fp16_model, tokenizer, sample_texts)
    print(f"  original={original_ms:.2f}±{original_sd:.2f} ms")
    print(f"  int8={quantized_ms:.2f}±{quantized_sd:.2f} ms")
    print(f"  fp16={fp16_ms:.2f}±{fp16_sd:.2f} ms")

    print("[5/7] Evaluate on test_set 482")
    test = pd.read_csv(TEST_PATH, sep="\t")
    for column in LABELS:
        test[column] = pd.to_numeric(test[column], errors="coerce").fillna(0).astype(int)
    valid = pd.read_csv(VALID_PATH, sep="\t")
    for column in LABELS:
        valid[column] = pd.to_numeric(valid[column], errors="coerce").fillna(0).astype(int)

    texts = test["문장"].astype(str).tolist()
    labels = test[LABELS].to_numpy()
    valid_texts = valid["문장"].astype(str).tolist()
    valid_labels = valid[LABELS].to_numpy()
    original_probs = predict_probs(model, tokenizer, texts)
    quantized_probs = predict_probs(quantized_model, tokenizer, texts)
    fp16_probs = predict_probs(fp16_model, tokenizer, texts)
    valid_quantized_probs = predict_probs(quantized_model, tokenizer, valid_texts)
    original_result = evaluate(original_probs, labels)
    quantized_result = evaluate(quantized_probs, labels)
    fp16_result = evaluate(fp16_probs, labels)
    calibration_sweep = calibrate_threshold(valid_quantized_probs, valid_labels)
    calibration_best = calibration_sweep.iloc[calibration_sweep["f1"].idxmax()]
    calibrated_threshold = float(calibration_best["threshold"])
    quantized_calibrated_result = evaluate(quantized_probs, labels, threshold=calibrated_threshold)
    label_metrics = per_label_metrics(
        [
            ("Original", original_probs),
            ("INT8 Dynamic", quantized_probs),
            ("FP16", fp16_probs),
        ],
        labels,
    )

    print("[6/7] Save model and tabular outputs")
    torch.save(quantized_model.state_dict(), OUT_DIR / "model_int8.pt")
    tokenizer.save_pretrained(OUT_DIR)
    model.config.save_pretrained(OUT_DIR)

    original_file_mb = file_size_mb(MODEL_PATH / "model.safetensors")
    quantized_file_mb = file_size_mb(OUT_DIR / "model_int8.pt")
    fp16_file_mb = file_size_mb(FP16_DIR / "model.safetensors")
    int8_reduction_pct = (1 - quantized_file_mb / original_file_mb) * 100
    fp16_reduction_pct = (1 - fp16_file_mb / original_file_mb) * 100
    int8_speedup = original_ms / quantized_ms if quantized_ms else float("nan")
    fp16_speedup = original_ms / fp16_ms if fp16_ms else float("nan")

    int8_recall_diff = quantized_result["abuse_recall"] - original_result["abuse_recall"]
    int8_f1_diff = quantized_result["abuse_f1"] - original_result["abuse_f1"]
    int8_precision_diff = quantized_result["abuse_precision"] - original_result["abuse_precision"]
    fp16_recall_diff = fp16_result["abuse_recall"] - original_result["abuse_recall"]
    fp16_f1_diff = fp16_result["abuse_f1"] - original_result["abuse_f1"]
    fp16_precision_diff = fp16_result["abuse_precision"] - original_result["abuse_precision"]

    report = {
        "selected_model": "Full v2 KcELECTRA (full_game_kcelectra_v2)",
        "model_path": str(MODEL_PATH.relative_to(ROOT)),
        "test_path": str(TEST_PATH.relative_to(ROOT)),
        "calibration_path": str(VALID_PATH.relative_to(ROOT)),
        "test_n": int(len(test)),
        "abuse_definition": "not-clean (max of 9 hate labels > 0.5)",
        "compression_methods": {
            "int8_dynamic": {
                "method": "INT8 dynamic quantization",
                "target_layers": "torch.nn.Linear",
                "backend_engine": engine,
                "artifact": "quantized_model/model_int8.pt",
            },
            "fp16": {
                "method": "FP16 half-precision weights",
                "artifact": "fp16_model/model.safetensors",
            },
        },
        "size": {
            "original_safetensors_mb": round(original_file_mb, 2),
            "int8_dynamic_mb": round(quantized_file_mb, 2),
            "fp16_safetensors_mb": round(fp16_file_mb, 2),
            "int8_compression": round(original_file_mb / quantized_file_mb, 2),
            "fp16_compression": round(original_file_mb / fp16_file_mb, 2),
            "int8_reduction_pct": round(int8_reduction_pct, 1),
            "fp16_reduction_pct": round(fp16_reduction_pct, 1),
            "params": int(params),
        },
        "speed": {
            "original_ms": round(original_ms, 2),
            "original_sd_ms": round(original_sd, 2),
            "int8_dynamic_ms": round(quantized_ms, 2),
            "int8_dynamic_sd_ms": round(quantized_sd, 2),
            "fp16_ms": round(fp16_ms, 2),
            "fp16_sd_ms": round(fp16_sd, 2),
            "int8_speedup": round(int8_speedup, 2),
            "fp16_speedup": round(fp16_speedup, 2),
        },
        "performance": {
            "original": original_result,
            "int8_dynamic": quantized_result,
            "int8_dynamic_calibrated": quantized_calibrated_result,
            "fp16": fp16_result,
        },
        "threshold_calibration": {
            "source": str(VALID_PATH.relative_to(ROOT)),
            "selected_threshold": round(calibrated_threshold, 2),
            "validation_precision": float(calibration_best["precision"]),
            "validation_recall": float(calibration_best["recall"]),
            "validation_f1": float(calibration_best["f1"]),
            "test_precision": quantized_calibrated_result["abuse_precision"],
            "test_recall": quantized_calibrated_result["abuse_recall"],
            "test_f1": quantized_calibrated_result["abuse_f1"],
            "note": "Calibration is diagnostic; FP16 remains the safer compressed deployment artifact because it preserves the original fixed-threshold behavior.",
        },
        "conclusion": {
            "int8_abuse_precision_diff": round(float(int8_precision_diff), 4),
            "int8_abuse_recall_diff": round(float(int8_recall_diff), 4),
            "int8_abuse_f1_diff": round(float(int8_f1_diff), 4),
            "fp16_abuse_precision_diff": round(float(fp16_precision_diff), 4),
            "fp16_abuse_recall_diff": round(float(fp16_recall_diff), 4),
            "fp16_abuse_f1_diff": round(float(fp16_f1_diff), 4),
            "int8_success": abs(float(int8_recall_diff)) <= 0.01 and abs(float(int8_f1_diff)) <= 0.01,
            "fp16_success": abs(float(fp16_recall_diff)) <= 0.001 and abs(float(fp16_f1_diff)) <= 0.001,
            "recommendation": "Use FP16 compressed artifact for deployment. INT8 dynamic is not acceptable at fixed threshold 0.5; it can be considered only with threshold calibration and explicit false-positive trade-off review.",
        },
    }
    write_load_guide(engine, report)

    (RESULTS_DIR / "quantization_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    pd.DataFrame(
        [
            {
                "Metric": "Model size (MiB)",
                "Original": f"{original_file_mb:.2f}",
                "INT8 Dynamic": f"{quantized_file_mb:.2f}",
                "FP16": f"{fp16_file_mb:.2f}",
                "INT8 Diff": f"{int8_reduction_pct:.1f}% smaller",
                "FP16 Diff": f"{fp16_reduction_pct:.1f}% smaller",
            },
            {
                "Metric": "Inference latency (ms, CPU)",
                "Original": f"{original_ms:.2f}",
                "INT8 Dynamic": f"{quantized_ms:.2f}",
                "FP16": f"{fp16_ms:.2f}",
                "INT8 Diff": f"{int8_speedup:.2f}x",
                "FP16 Diff": f"{fp16_speedup:.2f}x",
            },
            {
                "Metric": "Abuse Precision",
                "Original": f"{original_result['abuse_precision']:.4f}",
                "INT8 Dynamic": f"{quantized_result['abuse_precision']:.4f}",
                "FP16": f"{fp16_result['abuse_precision']:.4f}",
                "INT8 Diff": f"{int8_precision_diff:+.4f}",
                "FP16 Diff": f"{fp16_precision_diff:+.4f}",
            },
            {
                "Metric": "Abuse Recall",
                "Original": f"{original_result['abuse_recall']:.4f}",
                "INT8 Dynamic": f"{quantized_result['abuse_recall']:.4f}",
                "FP16": f"{fp16_result['abuse_recall']:.4f}",
                "INT8 Diff": f"{int8_recall_diff:+.4f}",
                "FP16 Diff": f"{fp16_recall_diff:+.4f}",
            },
            {
                "Metric": "Abuse F1",
                "Original": f"{original_result['abuse_f1']:.4f}",
                "INT8 Dynamic": f"{quantized_result['abuse_f1']:.4f}",
                "FP16": f"{fp16_result['abuse_f1']:.4f}",
                "INT8 Diff": f"{int8_f1_diff:+.4f}",
                "FP16 Diff": f"{fp16_f1_diff:+.4f}",
            },
            {
                "Metric": "Clean F1",
                "Original": f"{original_result['clean_f1']:.4f}",
                "INT8 Dynamic": f"{quantized_result['clean_f1']:.4f}",
                "FP16": f"{fp16_result['clean_f1']:.4f}",
                "INT8 Diff": f"{quantized_result['clean_f1'] - original_result['clean_f1']:+.4f}",
                "FP16 Diff": f"{fp16_result['clean_f1'] - original_result['clean_f1']:+.4f}",
            },
        ]
    ).to_csv(RESULTS_DIR / "quantization_results.csv", index=False, encoding="utf-8-sig")
    label_metrics.to_csv(RESULTS_DIR / "per_label_metrics.csv", index=False, encoding="utf-8-sig")
    calibration_sweep.to_csv(RESULTS_DIR / "threshold_calibration_valid.csv", index=False, encoding="utf-8-sig")
    threshold_sweep = plot_threshold_sweep(quantized_probs, labels, calibrated_threshold)
    threshold_sweep.to_csv(RESULTS_DIR / "threshold_sweep.csv", index=False, encoding="utf-8-sig")

    print("[7/7] Save publication-ready figures")
    plot_quantization_dashboard(report)
    plot_confusion_matrices(original_result, quantized_result)
    plot_per_label_f1(label_metrics)

    print("=" * 72)
    print(
        f"Size INT8: {original_file_mb:.2f} -> {quantized_file_mb:.2f} MiB "
        f"({report['size']['int8_compression']:.2f}x, {int8_reduction_pct:.1f}% smaller)"
    )
    print(
        f"Size FP16: {original_file_mb:.2f} -> {fp16_file_mb:.2f} MiB "
        f"({report['size']['fp16_compression']:.2f}x, {fp16_reduction_pct:.1f}% smaller)"
    )
    print(f"Latency INT8: {original_ms:.2f} -> {quantized_ms:.2f} ms ({int8_speedup:.2f}x)")
    print(f"Latency FP16: {original_ms:.2f} -> {fp16_ms:.2f} ms ({fp16_speedup:.2f}x)")
    print(
        "Abuse INT8: "
        f"P {original_result['abuse_precision']:.4f}->{quantized_result['abuse_precision']:.4f}, "
        f"R {original_result['abuse_recall']:.4f}->{quantized_result['abuse_recall']:.4f}, "
        f"F1 {original_result['abuse_f1']:.4f}->{quantized_result['abuse_f1']:.4f}"
    )
    print(
        "Abuse FP16: "
        f"P {original_result['abuse_precision']:.4f}->{fp16_result['abuse_precision']:.4f}, "
        f"R {original_result['abuse_recall']:.4f}->{fp16_result['abuse_recall']:.4f}, "
        f"F1 {original_result['abuse_f1']:.4f}->{fp16_result['abuse_f1']:.4f}"
    )
    print("INT8:", "SUCCESS -- metric preserved" if report["conclusion"]["int8_success"] else "WARNING -- metric drift detected")
    print("FP16:", "SUCCESS -- metric preserved" if report["conclusion"]["fp16_success"] else "WARNING -- metric drift detected")


if __name__ == "__main__":
    main()
