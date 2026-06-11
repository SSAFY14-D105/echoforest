# AI 파이프라인 개요, EchoForest 욕설 탐지

게임 음성채팅의 부정 발언을 실시간 탐지해 저주 시스템에 연결하기 위한 AI 파이프라인입니다. 이 문서는 전체 흐름을 빠르게 찾기 위한 네비게이션이고, 상세 수치와 최종 판단은 [`AI_튜닝_최종_보고서.md`](AI_튜닝_최종_보고서.md)에 정리했습니다.

## 런타임 흐름

```
[브라우저] Web Speech API (음성→텍스트)
        ↓ 5초 배치
[Spring] WebSocket
        ↓ HTTP
[FastAPI] Full v2 KcELECTRA / FP16 압축 모델
        ↓ abuse score
[게임] 저주 스택 반영
```

## 핵심 문제: threshold 딜레마

기본 `smilegate-ai/kor_unsmile`은 오탐은 적지만 게임 맥락의 은근한 비난을 많이 놓쳤습니다.

| 모델 | Precision | Recall | F1 | FP | FN |
|------|:---:|:---:|:---:|:---:|:---:|
| Baseline | 96.13% | 60.08% | 73.95% | 6 | 99 |

Recall을 올리려고 threshold를 낮추면 정상 게임 오더까지 과탐할 수 있습니다. 그래서 threshold 조정이 아니라 **게임 도메인 데이터 fine-tuning**으로 해결했습니다.

## 단계별 흐름

| 단계 | 폴더 | 하는 일 | 최신 상태 |
|:---:|------|---------|----------|
| 0 | [`0_Data_Collection`](0_Data_Collection) | 게임 STT 수집·정제·라벨링 | `train_collected` 518 / `test_set` 482 |
| 1 | [`1_Model_Selection`](1_Model_Selection) | base 모델과 STT 엔진 후보 선정 | UnSmile + Web Speech API |
| 2 | [`2_Baseline_Test`](2_Baseline_Test) | 파인튜닝 전 baseline 측정 | Recall 60.08%, F1 73.95% |
| 3 | [`3_UnSmile_Correction`](3_UnSmile_Correction) | 공식 unSmile 라벨 보정 | train 14,690 / valid 3,663 |
| 4 | [`4_LoRA_Fine_Tuning`](4_LoRA_Fine_Tuning) | LoRA 4개 학습 | v1/v2 × KcELECTRA/kcbert |
| 5 | [`5_Full_Fine_Tuning`](5_Full_Fine_Tuning) | Full FT 4개 학습 | v1/v2 × KcELECTRA/kcbert |
| 6 | [`6_Model_Comparison`](6_Model_Comparison) | baseline + 8개 모델 비교 | Full v2 KcELECTRA 선정 근거 |
| 7 | [`7_Best_Model_Selection`](7_Best_Model_Selection) | 최종 모델 확정 | **Full v2 KcELECTRA** |
| 8 | [`8_Quantization`](8_Quantization) | 압축/배포 최적화 | **FP16 권장**, INT8 보정 필요 |

## 같은 UnSmile 숫자가 다르게 보이는 이유

세 단계 모두 같은 `smilegate-ai/kor_unsmile`과 같은 `test_set`(482)을 보지만, **재는 지표가 다릅니다.**

| 위치 | 표시 숫자 | 의미 |
|------|:---:|------|
| Step 1 모델 선정 | AP 91.94 | 5개 후보를 고르기 위한 이진 abuse 랭킹 지표. threshold와 무관 |
| Step 2 baseline | Recall 60.08 / F1 73.95 | 실제 배포 규칙과 같은 `not-clean > 0.5` 고정 판정 결과 |
| Step 6 모델 비교 | LRAP 0.8869 | 10개 라벨 전체 확률 순위를 보는 다중라벨 랭킹 지표. threshold와 무관 |

즉 Step 1의 AP 91.94와 Step 6의 LRAP 0.8869는 둘 다 threshold-free 지표지만 **같은 계산식이 아닙니다**. Step 2의 Recall/F1은 threshold 0.5를 실제로 잘라서 만든 운영점 성능이고, Step 1 표의 F1@0.5·Step 6 baseline 행과 같은 값입니다.

## 데이터

| 데이터 | 건수 | 역할 |
|--------|:---:|------|
| `0_Data_Collection/datasets/train_collected.tsv` | 518 | v2 학습에 추가한 게임 도메인 데이터 |
| `0_Data_Collection/datasets/test_set.tsv` | 482 | 최종 평가용 학습에 쓰지 않은 평가 데이터 |
| `3_UnSmile_Correction/unsmile_train_corrected.tsv` | 14,690 | v1/v2 공통 학습 기반 |
| `3_UnSmile_Correction/unsmile_valid_corrected.tsv` | 3,663 | 검증 및 INT8 threshold 보정 |

검토 결과, 최신 `test_set`은 학습용 `train_collected`, `unsmile_train_corrected`, `unsmile_valid_corrected`와 문장 overlap이 없습니다.

## 최종 모델

| 항목 | 값 |
|------|----|
| 표시명 | **Full v2 KcELECTRA** |
| 내부 폴더명 | `full_game_kcelectra_v2` |
| 모델 경로 | `5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model` |
| 학습 데이터 | 보정 unSmile 14,690 + 게임 수집 518 |
| 선정 이유 | LRAP 1위, 상위 v2 후보 중 낮은 오탐(FP 23), F1 사실상 동률 |

| 지표 | Baseline | Full v2 KcELECTRA | 변화 |
|------|:---:|:---:|:---:|
| Abuse Precision | 96.13% | 90.21% | -5.92%p |
| Abuse Recall | 60.08% | 85.48% | +25.40%p |
| Abuse F1 | 73.95% | 87.78% | +13.83%p |
| LRAP | 0.887 | 0.936 | +0.049 |

## 압축/배포 판단

| 모델 | 크기 | 지연시간 | Abuse F1 | 판단 |
|------|:---:|:---:|:---:|------|
| 원본 | 487.48 MiB | 34.04 ms | 87.78% | 기준 |
| INT8 Dynamic | 242.88 MiB | 14.01 ms | 81.50% | fixed 0.5 배포 비권장 |
| FP16 | 243.75 MiB | 13.90 ms | 87.78% | **권장 압축 산출물** |

INT8은 속도/크기는 좋아졌지만 fixed threshold에서 Recall이 70.16%로 하락합니다. FP16은 크기를 약 50% 줄이면서 원본 성능을 그대로 보존하므로 배포 후보로 더 안전합니다.

## 주요 문서

| 문서 | 목적 |
|------|------|
| [`AI_튜닝_최종_보고서.md`](AI_튜닝_최종_보고서.md) | 최신 기승전결/최종 판단 |
| [`Setting/AI 모델 고도화 기획서.md`](<Setting/AI 모델 고도화 기획서.md>) | 발표·기획서형 상세 정리 |
| [`6_Model_Comparison/results/README.md`](6_Model_Comparison/results/README.md) | 모델 비교 수치와 선정 근거 |
| [`7_Best_Model_Selection/README.md`](7_Best_Model_Selection/README.md) | 최종 모델 로드/선정 이유 |
| [`8_Quantization/README.md`](8_Quantization/README.md) | 양자화/FP16 결과와 배포 판단 |
