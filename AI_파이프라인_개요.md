# 🧠 AI 파이프라인 전체 흐름 — 메아리의 숲 욕설탐지

게임 음성채팅의 **부정적 발언(욕설·비난·분노)** 을 실시간 탐지해 *저주 시스템*을 작동시키는 AI의 전체 흐름입니다.

> 이 문서 = **흐름·네비게이션**(왜 / 무엇을 / 어디서). **상세 수치·모델 순위**는 [기획서](<Setting/AI 모델 고도화 기획서.md>)에서.

## 런타임 한 줄

```
[브라우저] Web Speech API (음성→텍스트) ──5초 배치──▶ [Spring] WS ──HTTP──▶ [FastAPI] 파인튜닝 분류모델 → 저주 스택
```

- STT를 왜 브라우저 Web Speech로? (서버 부하·실시간) → [`1_Model_Selection/00_STT_Engine_Selection`](1_Model_Selection/00_STT_Engine_Selection)

## 🎯 왜 파인튜닝하나 — threshold 딜레마 (핵심 동기)

- 공식 unSmile은 **게임 특유 부정어**("손가락에 살쪘냐", "빡세네", "발목잡지마")를 **놓침**(Recall↓).
- 잡으려고 **threshold를 낮추면** → "가만히 있어라 좀", "냅다 갈겨버리네" 같은 **멀쩡한 게임 오더까지 과탐** → **욕 안 했는데 저주 발동**(최악의 UX).
- > **딜레마**: threshold 하나로는 *"게임 부정어 잡기 + 멀쩡한 말 놔두기"* 를 **동시에 못 한다.**
- → 그래서 **게임 도메인 데이터로 fine-tuning** — threshold로 안 되는 걸 *학습*으로 푼다(Recall↑ & 과탐↓ 동시).

## 단계별 흐름

| 단계 | 폴더 | 하는 일 |
| :---: | :--- | :--- |
| **0** | [0_Data_Collection](0_Data_Collection) | 게임 STT 수집·정제·라벨링 → `train_collected`(518) · `test_set`(482) |
| **1** | [1_Model_Selection](1_Model_Selection) | 6개 모델 벤치마크(test_set) → **UnSmile 선정** + 런타임 STT 엔진(Web Speech) 선정 |
| **2** | [2_Baseline_Test](2_Baseline_Test) | base(파인튜닝 전) 성능 baseline 측정 |
| **3** | [3_UnSmile_Correction](3_UnSmile_Correction) | 공식 unSmile 학습데이터 **오류 보정** (train ≈14,690 / valid ≈3,663) |
| **4** | [4_LoRA_Fine_Tuning](4_LoRA_Fine_Tuning) | **LoRA**(경량) 파인튜닝 — v1(보정만)/v2(보정+게임수집) × 2 base |
| **5** | [5_Full_Fine_Tuning](5_Full_Fine_Tuning) | **Full** 파인튜닝 — 동일 v1/v2 × 2 base (4+5 합쳐 **8개 모델**) |
| **6** | [6_Model_Comparison](6_Model_Comparison) | 8개 모델 test_set 비교 |
| **7** | [7_Best_Model_Selection](7_Best_Model_Selection) | 최종 **best 모델 선정** |
| **8** | [8_Quantization](8_Quantization) | INT8 **양자화**(경량화, 배포용) |

## 데이터 (핵심)

- **학습**: 보정 unSmile(≈14,690) + 게임 수집 `train_collected`(518, v2에서 추가) — **손수 수집·라벨**.
- **평가**: `test_set`(482, held-out, 학습과 **누수 0**). 1·6·8 모든 평가가 이 파일을 씀.
- **라벨**: unSmile 10라벨 포맷 유지, 실사용은 **abuse vs clean 이진**. (라벨 정책: [`0_Data_Collection/README.md`](0_Data_Collection/README.md))

## 결과 (요약)

- 파인튜닝으로 **Abuse Recall 대폭 개선** — 과탐은 억제하면서 게임 부정어를 잡도록 (기획서 기준 **64.66% → 87.93%, +36%p**).
- **양자화 후에도 성능 유지** + 모델 경량화.
- → 상세 수치·모델 순위·LoRA vs Full·베이스모델별 비교: **[기획서](<Setting/AI 모델 고도화 기획서.md>)**.

> ⚠️ **공개 수치는 모두 482 이전 테스트셋 기준** — 출처가 둘로 나뉩니다.
> - **1_Model_Selection**(UnSmile 선정 F1 등): 구 `test_set`(**688**) 기준(2026-06-03).
> - **6_비교·7_Best·8_양자화**(Recall 64.66→**87.93**, F1 90.67 등): 기획서의 옛 `game_test`(**187**) 기준(2026-02). 통합 `test_set`으로는 **재평가된 적 없음**.
>
> `test_set`을 **482로 재정제(2026-06)** 했고 **482 통합 재평가는 대기 중**(6·7·8) — 재실행 전까지 위 숫자를 현재 `test_set`(482)과 직접 비교하지 말 것. (구 688 백업: `0_Data_Collection/datasets/_archive/test_set_688_backup.tsv`)
