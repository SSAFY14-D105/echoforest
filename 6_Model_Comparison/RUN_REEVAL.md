# 6_Model_Comparison 재평가 기록

이 문서는 예전 `game_test` 기준 결과를 최신 단일 `test_set.tsv` 기준으로 다시 정리한 기록입니다.

## 재평가 결론

- 현재 최종 평가 데이터는 `0_Data_Collection/datasets/test_set.tsv` (**482건**)입니다.
- 모델 비교, 최종 선정, 압축 평가는 모두 이 482건 기준으로 최신화했습니다.
- 예전 181/187건 기준 결과는 `_archive/`에 보관하며, 현재 결론에는 사용하지 않습니다.

## 최신 실행 기준

| 항목 | 현재 값 |
|------|---------|
| 평가 데이터 | `0_Data_Collection/datasets/test_set.tsv` |
| 모델 비교 폴더 | `6_Model_Comparison` |
| 최종 선정 폴더 | `7_Best_Model_Selection` |
| 압축 평가 폴더 | `8_Quantization` |
| 최종 모델 | `full_game_kcelectra_v2` |
| 권장 압축 산출물 | `8_Quantization/fp16_model/` |

## 현재 모델 경로

```text
4_LoRA_Fine_Tuning/v1_corrected_only/output/{lora_game_kcelectra,lora_tutorial_kcbert}/merged_model
4_LoRA_Fine_Tuning/v2_corrected_plus_collected/output/{lora_game_kcelectra_v2,lora_tutorial_kcbert_v2}/merged_model
5_Full_Fine_Tuning/v1_corrected_only/output/{full_game_kcelectra,full_tutorial_kcbert}/best_model
5_Full_Fine_Tuning/v2_corrected_plus_collected/output/{full_game_kcelectra_v2,full_tutorial_kcbert_v2}/best_model
```

## 재평가 후 핵심 수치

| 지표 | Baseline | Full v2 KcELECTRA | 변화 |
|------|:---:|:---:|:---:|
| Abuse Precision | 97.30% | 90.13% | -7.17%p |
| Abuse Recall | 58.06% | 84.68% | +26.62%p |
| Abuse F1 | 72.73% | 87.32% | +14.59%p |
| LRAP | 0.887 | 0.936 | +0.049 |

## 관련 문서

| 문서 | 내용 |
|------|------|
| `results/README.md` | 9개 모델 비교와 선정 근거 |
| `../7_Best_Model_Selection/README.md` | 최종 모델 확정 |
| `../8_Quantization/README.md` | 압축/배포 최적화 결과 |
| `../AI_튜닝_최종_보고서.md` | 전체 기승전결과 그래프 검토 |
