# _archive, 보관용 (미사용)

파이프라인에서 더 이상 쓰지 않지만 이력 보존을 위해 옮겨둔 산출물입니다. **현재 결과·문서·코드는 이 파일들을 참조하지 않습니다.**

| 파일 | 원위치 | 보관 이유 |
|------|--------|----------|
| `2_Baseline_Test/keywords_unsmile_format.tsv` | `2_Baseline_Test/` | 초기 진단에 쓰던 키워드셋(518행). 현재 baseline은 `0_Data_Collection/datasets/test_set.tsv`(482)로 측정하므로 미사용. |
| `6_Model_Comparison/test_all_models.ipynb` | `6_Model_Comparison/` | 옛 평가 노트북. abuse를 단일 라벨(`index-8`)로 계산하고(현재 정의는 9개 라벨 max>0.5), 존재하지 않는 경로(`4_2_Full_Fine_Tuning` 등)·옛 `game_test.tsv`를 참조하며, 실행 시 `results/README.md`를 재현율 기준으로 덮어써 최신 선정과 충돌. 현재 평가는 `compare_models.py` + `threshold_free_significance.py`. |
| `1_Model_Selection/benchmark_game_stt.ipynb` | `1_Model_Selection/` | 옛 벤치마크 노트북("6개 모델", 분류 헤드 없는 KcELECTRA 포함). 정식은 `benchmark_game_stt.py`(5모델). |
| `8_Quantization/quantize_model.ipynb` | `8_Quantization/` | 옛 양자화 노트북(존재하지 않는 `4_2_Full_Fine_Tuning` 경로·옛 187 샘플 참조). 정식은 `quantize_model.py` + `quant_not_clean.py`. |

> 되돌리려면 `git mv ai-tuning/_archive/<경로> ai-tuning/<원위치>` 로 복원하면 됩니다(이력 보존됨).
