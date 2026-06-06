# _archive — 구 모델선정 벤치마크 결과 (평가에는 사용 안 함)

상위 `results/`가 **현재(482 기준) 결과**입니다. 이 폴더는 **재정제 이전 옛 결과** 백업입니다.

| 항목 | 내용 |
| :--- | :--- |
| 테스트셋 | 구 `test_set` **688건** (현재는 482로 재정제됨) |
| 측정일 | 2026-06-03 16:12 |
| 모델 수 | **실제 5개** (`UnSmile`·`KoELECTRA Small/Base`·`Multilingual`·`KcELECTRA v2`) — 생성 MD 제목은 "6개"였으나 **Korean Sentiment 누락**이었음 |
| 옛 선정 | UnSmile (Abuse Recall 66.51% / F1 74.87%) |

> 이번 재실행에서 **Korean Sentiment를 복귀시켜 6개로 통일**하고, **test_set(482)** 기준으로 다시 측정했습니다. 새 수치·그래프·MD는 상위 `results/`를 보세요.

## 파일
- `MODEL_BENCHMARK.md` — 구 결과 요약(688/5모델)
- `benchmark_results.csv` · `benchmark_results.json` — 구 수치
- `6_model_comparison.png` · `best_model_selection.png` — 구 그래프
