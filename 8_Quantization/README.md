# 8_Quantization — 압축/배포 최적화 최신 결과

Step 7에서 선정한 **Full v2 KcELECTRA**를 배포 관점에서 다시 압축하고 평가한 단계입니다.

- 평가 데이터: `0_Data_Collection/datasets/test_set.tsv` (**482건**, abuse 248 / clean 234)
- 판정 기준: `악플/욕설` index 8 sigmoid > **0.5**
- 원본 모델: `5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model`
- 실행 스크립트: `python 8_Quantization/quantize_model.py`

## 결론

**FP16 압축 모델을 배포 후보로 권장합니다.**

INT8 Dynamic Quantization은 모델 크기와 CPU 지연시간을 줄였지만, 고정 threshold 0.5에서 abuse Recall이 크게 떨어져 바로 배포하기 어렵습니다. FP16은 원본 성능을 그대로 보존하면서 모델 크기를 약 50% 줄이고 CPU 지연시간도 개선했습니다.

| 항목 | 원본 | INT8 Dynamic | FP16 | 판단 |
|------|:---:|:---:|:---:|------|
| 모델 크기 | 487.48 MiB | 242.88 MiB | 243.75 MiB | 둘 다 약 2배 압축 |
| CPU 지연시간 | 34.04 ms | 14.01 ms | 13.90 ms | 둘 다 약 2.4배 개선 |
| Abuse Precision | 90.13% | 97.21% | 90.13% | INT8은 너무 보수화 |
| Abuse Recall | 84.68% | 70.16% | 84.68% | INT8 fixed 0.5 실패 |
| Abuse F1 | 87.32% | 81.50% | 87.32% | FP16 성능 보존 |
| 배포 판단 | 기준 | 보정 없이는 비권장 | **권장** | FP16 우선 |

## 왜 INT8을 그대로 쓰면 안 되나

INT8은 정밀도가 97.21%까지 올라가지만, 그 대가로 실제 abuse 248건 중 **74건을 놓칩니다**. 원본/FP16은 38건을 놓치므로, INT8 fixed 0.5는 미탐이 **36건 증가**합니다.

| 모델 | TN | FP | FN | TP |
|------|:--:|:--:|:--:|:--:|
| 원본 | 211 | 23 | 38 | 210 |
| INT8 0.5 | 229 | 5 | 74 | 174 |
| FP16 | 211 | 23 | 38 | 210 |

즉 INT8은 "오탐을 줄이는 대신 미탐이 급증"한 상태입니다. 게임 저주 시스템에서는 오탐도 문제지만, 욕설 탐지 모델의 목표 지표였던 Recall/F1이 깨졌기 때문에 배포용 성공으로 쓰면 안 됩니다.

## INT8 threshold 보정 결과

검증셋(`3_UnSmile_Correction/unsmile_valid_corrected.tsv`)에서 INT8 threshold를 탐색하면 **0.21**이 선택됩니다. 이 threshold를 test_set에 적용하면 F1은 거의 회복되지만, 원본 대비 false positive가 늘어납니다.

| INT8 기준 | Precision | Recall | F1 | FP | FN |
|-----------|:---:|:---:|:---:|:---:|:---:|
| fixed 0.50 | 97.21% | 70.16% | 81.50% | 5 | 74 |
| valid 보정 0.21 | 88.07% | 86.29% | 87.17% | 29 | 34 |
| 원본/FP16 0.50 | 90.13% | 84.68% | 87.32% | 23 | 38 |

보정 threshold 0.21은 연구/실험 대안으로는 의미가 있지만, 운영에서는 "오탐 23 → 29"라는 UX 비용을 별도로 검토해야 합니다. 그래서 최종 압축 산출물은 **FP16 우선**, INT8은 **threshold 보정과 운영 로그 검증 후 재검토**가 맞습니다.

## 산출물

| 경로 | 내용 |
|------|------|
| `fp16_model/` | 권장 압축 모델. `AutoModelForSequenceClassification.from_pretrained()`로 로드 가능 |
| `quantized_model/model_int8.pt` | INT8 Dynamic state dict. 고정 threshold 배포 비권장 |
| `quantized_model/README.md` | INT8 로드 방법과 현재 상태 |
| `results/quantization_report.json` | 전체 수치 JSON |
| `results/quantization_results.csv` | 원본/INT8/FP16 요약 수치 |
| `results/per_label_metrics.csv` | 라벨별 precision/recall/F1 |
| `results/threshold_calibration_valid.csv` | valid 기준 threshold 탐색 |
| `results/threshold_sweep.csv` | test 기준 INT8 threshold 민감도 |

## 논문/발표용 그래프

모든 핵심 그래프는 **PNG(300dpi) + PDF**로 저장했습니다. 한글 버전은 `_ko` suffix입니다.

| 그래프 | 영어 | 한국어 | 용도 |
|--------|------|--------|------|
| 양자화 대시보드 | `results/quantization_dashboard.png` | `results/quantization_dashboard_ko.png` | 크기·속도·성능 보존 요약 |
| 혼동행렬 | `results/confusion_matrices.png` | `results/confusion_matrices_ko.png` | INT8 미탐 증가 설명 |
| 라벨별 F1 | `results/per_label_f1.png` | `results/per_label_f1_ko.png` | FP16 보존/INT8 하락 확인 |
| threshold sweep | `results/threshold_sweep.png` | `results/threshold_sweep_ko.png` | INT8 보정 가능성 설명 |

## 실행 방법

```bash
cd /Users/sondahyun/S14P11D105
python 8_Quantization/quantize_model.py
python 8_Quantization/plot_quantization_figures_ko.py
```

> 현재 macOS/Apple Silicon 환경에서는 PyTorch quantized backend가 `qnnpack`으로 선택됩니다. 다른 CPU/backend에서는 지연시간 수치가 달라질 수 있으므로, 배포 서버에서 한 번 더 latency를 확인하는 것이 좋습니다.
