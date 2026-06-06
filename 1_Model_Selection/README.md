# 1_Model_Selection — STT·욕설탐지 모델 선정

게임 음성채팅 파이프라인의 **두 모델**을 고르는 단계입니다.
1. **STT 엔진** (음성→텍스트, 런타임): `00_STT_Engine_Selection/`
2. **욕설/혐오 탐지 모델** (텍스트→abuse/clean): 이 폴더 루트의 벤치마크

## 📂 구조

| 경로 | 내용 |
| :--- | :--- |
| `00_STT_Engine_Selection/` | 런타임 STT 엔진 선정(Web Speech API) — 근거 `STT_COMPARISON.md` + 실측 `web_speech_api/` |
| `benchmark_game_stt.py` | 6개 욕설탐지 모델을 `test_set.tsv`(482)로 추론·평가 → `results/` 갱신 |
| `plot_benchmark.py` | 결과 CSV로 **포트폴리오용 차트**(영어/한국어) 렌더 — 추론과 분리(재추론 불필요) |
| `benchmark_game_stt.ipynb` | 노트북 버전(참고) |
| `results/` | 산출물: `MODEL_BENCHMARK.md`(상세+그래프 설명)·`benchmark_results.csv/.json`·그래프 4종(en/ko)·`_archive/`(구 결과) |
| `MODEL_SELECTION.md` | 선정 근거 메모(기준·트러블슈팅 교훈) |

## 🏆 선정 결과 — UnSmile

`test_set.tsv`(482, held-out) · **임계값 0.5** · **Abuse F1** 기준 선정. (수치·그래프 상세 → [`results/MODEL_BENCHMARK.md`](./results/MODEL_BENCHMARK.md))

| 모델 | Abuse Recall | **Abuse F1** | 비고 |
| :--- | :---: | :---: | :--- |
| **UnSmile** (`smilegate-ai/kor_unsmile`) | 60.1% | **74.0%** | ✅ 선정 (Precision 96.1%) |
| Korean Sentiment | 94.0% | 71.4% | recall 1위지만 과탐(Precision 57.5%) |
| Multilingual | 70.2% | 60.0% | 범용 감정모델 |
| KoELECTRA Small/Base · KcELECTRA v2 | — | 8.7~65.1% | † 헤드 미로딩(noise) |

> **선정 기준은 Recall이 아니라 F1.** Korean Sentiment는 Recall 94%로 최고지만 clean 234건 중 **172건을 욕설로 오탐**(Precision 57.5%) → 게임에 쓰면 멀쩡한 말에 저주 발동. UnSmile은 오탐 **단 6건**(Precision 96.1%)이라 F1 1위. (KoELECTRA/KcELECTRA류는 현 transformers에서 분류 헤드가 안 실려 수치가 noise — 대조군)

## 🚀 실행

```bash
cd 1_Model_Selection
python benchmark_game_stt.py   # test_set.tsv(482) 추론·평가 → results/ (CSV·JSON·MD·그래프 en/ko)
python plot_benchmark.py       # (선택) 차트만 다시 그리기 — 재추론 없이 CSV로 렌더
```

## 📖 관련 문서

- 선정 상세 + **그래프 읽는 법**: [`results/MODEL_BENCHMARK.md`](./results/MODEL_BENCHMARK.md)
- 선정 근거·트러블슈팅 교훈: [`MODEL_SELECTION.md`](./MODEL_SELECTION.md)
- STT 엔진 결정: [`00_STT_Engine_Selection/STT_COMPARISON.md`](./00_STT_Engine_Selection/STT_COMPARISON.md)
- 프로젝트 개요·데이터: [`../AI_파이프라인_개요.md`](../AI_파이프라인_개요.md) · [`../0_Data_Collection/`](../0_Data_Collection/)
- 선정한 UnSmile 파인튜닝: [`../4_LoRA_Fine_Tuning/`](../4_LoRA_Fine_Tuning/) · [`../5_Full_Fine_Tuning/`](../5_Full_Fine_Tuning/)
