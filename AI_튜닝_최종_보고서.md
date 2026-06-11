# EchoForest AI 튜닝 최종 보고서

이 문서는 게임 음성채팅 기반 욕설/부정 발언 탐지 모델의 **데이터 수집 → 보정 → 파인튜닝 → 모델 선정 → 압축 최적화** 과정을 최신 결과 기준으로 정리한 최종 보고서입니다.

## 1. 기: 문제 정의

EchoForest의 저주 시스템은 플레이어의 부정 발언을 실시간으로 감지해야 합니다. 기본 후보였던 `smilegate-ai/kor_unsmile`은 한국어 혐오/악성 댓글에 특화되어 있어 출발점으로 적합했지만, 게임 음성채팅에는 다음 문제가 있었습니다.

- 게임 맥락의 은근한 비난과 불만을 놓침: "너 때문에 죽잖아", "제대로 좀 해", "발목잡지마" 계열
- threshold를 낮추면 정상 게임 오더까지 오탐할 위험 증가
- 실제 운영 목표는 단순 recall 최대화가 아니라 **가짜 저주를 줄이면서 실제 부정 발언을 충분히 잡는 균형**

Baseline 결과는 이 문제를 수치로 보여줍니다.

| 모델 | Precision | Recall | F1 | FP | FN |
|------|:---:|:---:|:---:|:---:|:---:|
| Baseline `kor_unsmile` | 96.13% | 60.08% | 73.95% | 6 | 99 |

Baseline은 오탐은 적지만 실제 abuse 248건 중 99건을 놓쳤습니다. 따라서 threshold 조정만으로 해결하기보다, 게임 도메인 데이터를 학습에 반영하는 방향이 타당합니다.

## 2. 승: 데이터와 학습 설계

데이터 설계는 잘 잡혔습니다. 특히 학습용 게임 데이터와 평가용 test_set을 분리했고, 최신 검토 기준으로 test_set과 학습 데이터 간 누수가 없습니다.

| 데이터 | 건수 | 역할 | 비고 |
|--------|:---:|------|------|
| `train_collected.tsv` | 518 | v2 학습에 추가 | 게임 STT/협력게임 발화 수집 |
| `test_set.tsv` | 482 | 최종 평가 | 학습 데이터와 overlap 0 |
| `unsmile_train_corrected.tsv` | 14,690 | v1/v2 공통 학습 기반 | clean→abuse 라벨 보정 |
| `unsmile_valid_corrected.tsv` | 3,663 | 검증/threshold 보정 | INT8 threshold calibration에도 사용 |

학습 조합도 실험 설계 관점에서 균형이 좋습니다.

- 방식: LoRA vs Full fine-tuning
- 데이터: v1(보정 unSmile만) vs v2(보정 unSmile + 게임 수집 518건)
- base: KcELECTRA vs kcbert
- 비교 대상: baseline + 파인튜닝 8개 = 총 9개

이 구조 덕분에 "모델을 바꿔서 좋아졌는지", "게임 데이터를 넣어서 좋아졌는지", "LoRA와 Full 중 무엇이 나은지"를 분리해서 설명할 수 있습니다.

## 3. 전: 모델 비교와 최종 선정

최종 비교는 `test_set` 482건 기준으로 재정리되었습니다. 핵심 결론은 **소량의 게임 도메인 데이터가 가장 큰 성능 개선 요인**이라는 점입니다.

| 비교 | v1 평균 Recall | v2 평균 Recall | 차이 |
|------|:---:|:---:|:---:|
| 게임 데이터 효과 | 74.0% | 85.5% | +11.5%p |

최종 선정 모델은 **Full v2 KcELECTRA**입니다.

| 지표 | Baseline | Full v2 KcELECTRA | 변화 |
|------|:---:|:---:|:---:|
| Abuse Precision | 96.13% | 90.21% | -5.92%p |
| Abuse Recall | 60.08% | 85.48% | +25.40%p |
| Abuse F1 | 73.95% | 87.78% | +13.83%p |
| LRAP | 0.887 | 0.936 | +0.049 |

Precision이 낮아진 이유는 모델이 더 많은 문장을 abuse로 잡기 시작했기 때문입니다. Baseline은 매우 보수적으로 예측해서 TP 149 / FP 6였고, 최종 모델은 게임식 비난까지 잡으면서 TP가 212로 늘었습니다. 동시에 정상 발화를 abuse로 찍은 FP도 23으로 늘어 Precision은 96.13%에서 90.21%로 내려갔습니다. 즉 "더 잘 잡는다"는 Recall 개선이고, 그 과정에서 false positive가 일부 늘어난 trade-off입니다.

선정 기준은 타당합니다. LoRA v2 KcELECTRA가 Recall 87.90%로 1위지만, Full v2 KcELECTRA는 LRAP 1위이고 LoRA v2보다 오탐이 적으며(FP 23 vs 30), F1은 사실상 동률입니다. 게임 저주 시스템에서는 오탐이 UX에 직접 영향을 주므로, Recall 6문장 차이보다 Precision/LRAP 우위가 더 설득력 있습니다.

## 4. 결: 압축 최적화와 배포 판단

압축 단계에서 가장 중요한 결론은 **INT8을 무조건 성공으로 쓰면 안 된다**는 점입니다.

| 모델 | 크기 | CPU 지연시간 | Precision | Recall | F1 | 판단 |
|------|:---:|:---:|:---:|:---:|:---:|------|
| 원본 | 487.48 MiB | 34.04 ms | 90.21% | 85.48% | 87.78% | 기준 |
| INT8 Dynamic | 242.88 MiB | 14.01 ms | 97.21% | 70.16% | 81.50% | fixed 0.5 배포 비권장 |
| FP16 | 243.75 MiB | 13.90 ms | 90.21% | 85.48% | 87.78% | **권장** |

INT8은 크기와 속도는 좋아졌지만, fixed threshold 0.5에서 abuse Recall이 15.32%p 하락했습니다. 이는 "성능 손실 없는 양자화"가 아닙니다. 반면 FP16은 크기를 약 50% 줄이면서 원본 성능을 그대로 유지했습니다.

INT8은 threshold를 0.26으로 보정하면 F1을 88.94%까지 회복합니다(원본 0.5의 87.78%보다 오히려 높고 오탐도 18건으로 더 적음).

| INT8 기준 | Precision | Recall | F1 | FP | FN |
|-----------|:---:|:---:|:---:|:---:|:---:|
| fixed 0.50 | 97.21% | 70.16% | 81.50% | 5 | 74 |
| INT8 보정 후보 0.26 | 92.21% | 85.89% | 88.94% | 18 | 35 |

다만 INT8은 고정 0.5에서 Recall이 무너지고, 위 회복도 **임계값 재보정**을 거쳐야 가능합니다(FP16은 보정 없이 drop-in). 따라서 운영 우선순위는 **FP16 배포 → 운영 로그 수집 → INT8 threshold 보정 재검토**가 좋습니다.

## 최종 산출물

| 목적 | 경로 |
|------|------|
| 최종 모델 | `5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model` |
| 권장 압축 모델 | `8_Quantization/fp16_model/` |
| INT8 실험 모델 | `8_Quantization/quantized_model/model_int8.pt` |
| 모델 비교 결과 | `6_Model_Comparison/results/comparison_results.csv` |
| 양자화 결과 | `8_Quantization/results/quantization_report.json` |
| 최종 선정 설명 | `7_Best_Model_Selection/README.md` |
| 압축/배포 설명 | `8_Quantization/README.md` |

## 논문/발표용 그래프 검토

그래프는 PNG 300dpi와 PDF를 모두 생성했습니다. 한글 버전은 `/Users/sondahyun/Pretendard-1.3.9`의 Pretendard를 우선 사용하고, 없을 때만 macOS 기본 한글 폰트로 fallback하도록 렌더링했습니다.

| 단계 | 그래프 | 경로 |
|------|--------|------|
| 모델 비교 | 모델 순위 | `6_Model_Comparison/results/paper_model_ranking.png`, `_ko.png` |
| 모델 비교 | Precision/Recall/F1 trade-off | `6_Model_Comparison/results/paper_selected_tradeoff.png`, `_ko.png` |
| 모델 비교 | v1→v2 도메인 데이터 효과 | `6_Model_Comparison/results/paper_domain_data_effect.png`, `_ko.png` |
| 압축 | 대시보드 | `8_Quantization/results/quantization_dashboard_ko.png` |
| 압축 | 혼동행렬 | `8_Quantization/results/confusion_matrices_ko.png` |
| 압축 | 라벨별 F1 | `8_Quantization/results/per_label_f1_ko.png` |
| 압축 | INT8 threshold sweep | `8_Quantization/results/threshold_sweep_ko.png` |

검토 결과:

- 한글 그래프는 Pretendard 기준으로 폰트 깨짐 없이 정상 렌더링됨
- 포트폴리오 활용을 위해 과하게 어두운 색과 과하게 밝은 색을 모두 피하고, muted teal/soft gray 중심 팔레트로 조정함
- 색만으로 구분하지 않도록 수치 라벨, 마커, 화살표, 직접 주석을 같이 사용함
- 혼동행렬은 색상바 겹침을 제거해 셀 숫자가 선명함
- 라벨별 F1 그래프는 support가 있는 `악플/욕설`, `clean`만 표시해 빈 라벨 공간을 제거함
- 막대 위 수치 라벨을 추가해 발표/논문 캡처에서 값을 바로 읽을 수 있음
- INT8 그래프는 "압축 성공"만 강조하지 않고, Recall 하락과 threshold 보정 필요성을 같이 보여줌

## 전문가 관점 최종 판단

전체 기승전결은 잘 나왔습니다. 특히 "threshold 딜레마"를 문제로 잡고, 그 해결책을 데이터 보정과 게임 도메인 수집으로 연결한 점이 강합니다. 최신 결과 기준으로는 결론을 이렇게 가져가면 가장 정직하고 설득력 있습니다.

> 게임 도메인 fine-tuning으로 baseline의 낮은 Recall 문제를 해결했고, Full v2 KcELECTRA가 LRAP 1위·상위 v2 후보 중 낮은 오탐(FP 23) 기준 최종 모델로 타당하다. 압축 단계에서는 INT8 fixed threshold가 성능을 훼손하므로 즉시 배포하지 않고, FP16 압축 모델을 우선 배포 후보로 삼는 것이 안전하다.
