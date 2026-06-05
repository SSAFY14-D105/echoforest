# 1_Model_Selection — STT·욕설탐지 모델 선정

게임 음성채팅 파이프라인의 **두 모델**을 고르는 단계입니다.
1. **STT 엔진** (음성→텍스트, 런타임): `00_STT_Engine_Selection/`
2. **욕설/혐오 탐지 모델** (텍스트→abuse/clean): 이 폴더 루트의 벤치마크

## 📂 구조

| 경로 | 내용 |
| :--- | :--- |
| `00_STT_Engine_Selection/` | 런타임 STT 엔진 선정(Web Speech API) — 근거 `STT_COMPARISON.md` + 실측·테스트 `web_speech_api/` |
| `benchmark_game_stt.py` / `.ipynb` | 6개 욕설탐지 모델을 `test_set.tsv`로 벤치마크 (아래 표 수치는 구 688판 기준) |
| `results/` | 벤치마크 산출물: `MODEL_BENCHMARK.md`·`benchmark_results.csv/.json`·비교 그래프 2종 |
| `MODEL_SELECTION.md` | 선정 요약 메모 |

## 🏆 선정 결과 — UnSmile

`test_set.tsv`(held-out) 기준 **Abuse F1**로 선정. (상세: [`results/MODEL_BENCHMARK.md`](./results/MODEL_BENCHMARK.md))

> ⚠️ 아래 수치는 **구 `test_set`(688) 기준**(2026-06-03 측정). 현 `test_set`은 482로 재정제됨 → **482 재평가 대기**(재실행 시 수치 변동, 모델 선정 결론은 유지).

| 모델 | Abuse F1 | 선정 |
| :--- | :---: | :---: |
| **UnSmile** (`smilegate-ai/kor_unsmile`) | **74.87%** | ✅ |
| Multilingual / KoELECTRA / KcELECTRA | ≤ 43.79% | |

> ⚠️ 선정 기준은 Recall이 아니라 **F1**. Recall만 최대인 모델(KoELECTRA Small 86.98%)은 거의 모든 문장을 욕설로 분류해 Precision이 무너져 실사용 불가 → 균형 지표로 선정.

## 🚀 실행

```bash
python benchmark_game_stt.py   # ../0_Data_Collection/datasets/test_set.tsv 로 평가 → results/ 갱신
```

## 📖 관련 문서

- 프로젝트 기술 개요(스택·아키텍처): [`../CONTEXT.md`](../CONTEXT.md)
- 게임 기획서: [`../게임전체기획서.md`](../게임전체기획서.md)
- 데이터셋 출처·라벨 정책: [`../0_Data_Collection/`](../0_Data_Collection/)
- 선정한 UnSmile 파인튜닝: [`../4_LoRA_Fine_Tuning/`](../4_LoRA_Fine_Tuning/) · [`../5_Full_Fine_Tuning/`](../5_Full_Fine_Tuning/)
