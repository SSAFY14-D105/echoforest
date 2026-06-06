# 🔁 클린 테스트셋 재평가 실행 가이드

> ✅ **완료(2026-06)**: `compare_models.py`로 9개 모델을 `test_set`(482)·index-8로 재평가 끝. 결과·그래프·인사이트는 **[`results/README.md`](results/README.md)**. 아래 노트북 절차는 *참고용(구 방식)* — 실제 재평가는 `python compare_models.py` → `python plot_comparison.py`로 수행.

> 🔄 **갱신(2026-06)**: 통합 단일 테스트셋이 `0_Data_Collection/datasets/test_set.tsv`(**482**)로 확정됨. 아래 181/187 서술과 옛 폴더명(`5_Model_Comparison`·`7_Quantization`)은 당시 계획 기록 — **실제 재평가는 482로, 현재 폴더(`6_Model_Comparison`·`8_Quantization`)에서** 수행. 배경: [`../AI_파이프라인_개요.md`](../AI_파이프라인_개요.md).

> **왜?** 기존 테스트셋 `game_test.tsv`(187건) 중 **6문장(전부 욕설)이 v2 학습 데이터(수집 518)와 겹쳐** 누수가 있었음. 이를 제거한 `game_test_clean.tsv`(181건)로 다시 평가해 무결성을 확보한다.
> **재학습은 불필요** — 이미 학습된 8개 모델을 클린셋으로 **재평가(추론)만** 하면 됨.

---

## 0. 사전 준비 — 노트북 conda 가상환경

```bash
# 가상환경 생성 & 활성화
conda create -n echoforest_ft python=3.12 -y
conda activate echoforest_ft

# torch (CUDA 빌드 — 노트북 GeForce 사용). 드라이버가 CUDA 12.1+ 지원 가정:
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cu121

# 나머지 의존성
pip install -r 5_Model_Comparison/requirements_reeval.txt

# 모델 가중치(LFS 포인터 → 실파일, ~3.6GB) 받기
git lfs pull
```

> conda는 **패키지만 격리**하고 GPU는 노트북 GeForce를 native로 사용합니다. (GPU 드라이버는 OS에 이미 설치돼 있어야 함 — GeForce 노트북은 대부분 OK.)
> 재평가는 **181문장 추론**이라 VRAM·시간 부담이 거의 없음(수 분).

---

## 1. 테스트 경로를 클린셋으로 변경 후 재실행

| 노트북 | 바꿀 부분 | 산출물(자동 갱신) |
| :--- | :--- | :--- |
| `5_Model_Comparison/test_all_models.ipynb` | 테스트 파일 `game_test.tsv` → **`game_test_clean.tsv`** | `results/game_test_results.csv`, `improvement_analysis.csv`, 그래프 4종(before_after / v1_vs_v2 / metrics_heatmap / lora_vs_full) |
| `7_Quantization/quantize_model.ipynb` | `TEST_DATA_PATH = "../5_Model_Comparison/data/game_test_clean.tsv"` | `results/quantization_report.json`, per_label_metrics, 그래프 2종 |

> **baseline(`kor_unsmile`)도 비교 대상 9개에 포함**돼 있어, 위 재실행만으로 baseline까지 클린셋 재평가됨(별도 작업 X).

### (선택) 02-1 모델 선정도 181로 통일하려면
- `feature/ai/stt-model-test` 브랜치의 `01_AI/02_Sentiment_Analysis/data/`에 동일한 `game_test_clean.tsv`(181)를 두고, `benchmark_game_stt.py`의 테스트 경로를 clean으로 변경해 재실행.
- ※ 02-1의 6개 모델은 수집 518을 학습한 적이 없어 **누수는 없음** — 순전히 "테스트셋 통일" 목적.

---

## 2. 평가 방식 (참고 — 기존 노트북 로직 그대로)
- 멀티라벨 sigmoid 출력에 `preds = probs > 0.5`
- `악플/욕설`(idx 8) 라벨로 `precision_recall_fscore_support(... average='binary')` → abuse_recall/precision/f1
- LRAP은 threshold 무관(랭킹 품질)

---

## 3. 재평가 후 할 일
- 새 `game_test_results.csv` 확인 → **수치 변화는 6문장(3.2%) 제거라 미미**, 결론(unSmile 선정·FT 우세·개선폭)은 그대로 유지될 것.
- 새 CSV를 공유하면 **velog · portfolio · PPT 수치를 181 기준으로 일괄 갱신** 가능.

---

## 평가 대상 8개 모델 경로 (재학습 시 참고용)
```
4_1_LoRA_Fine_Tuning/v1_corrected_only/output/{lora_game_kcelectra, lora_tutorial_kcbert}/merged_model
4_1_LoRA_Fine_Tuning/v2_corrected_plus_collected/output/{lora_game_kcelectra_v2, lora_tutorial_kcbert_v2}/merged_model
4_2_Full_Fine_Tuning/v1_corrected_only/output/{full_game_kcelectra, full_tutorial_kcbert}/best_model
4_2_Full_Fine_Tuning/v2_corrected_plus_collected/output/{full_game_kcelectra_v2, full_tutorial_kcbert_v2}/best_model
+ Baseline: smilegate-ai/kor_unsmile
```
