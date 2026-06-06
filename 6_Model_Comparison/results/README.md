# 6_Model_Comparison — 9개 모델 비교 결과 (test_set 482)

baseline(파인튜닝 전) + 파인튜닝 8개를 **held-out `test_set`(482)** 으로 비교한 **메인 헤드라인**입니다.

- **abuse 판정**: `악플/욕설`(index 8) > 0.5 — 배포·Step 1·Step 2와 동일 정의
- **지표**: Abuse/Clean Precision·Recall·F1 + LRAP · **임계값 0.5**
- 생성: `python compare_models.py` → `comparison_results.csv/.json` · 차트는 `python plot_comparison.py`

## 🏆 헤드라인 — 파인튜닝으로 Abuse Recall +27.8%p

> **baseline 58.06% → 최고 85.89% (LoRA v2 Game)** · F1 기준 최고는 **Full v2 Game 87.32%**

![before/after](./abuse_recall_before_after.png)
한국어판: [`abuse_recall_before_after_ko.png`](./abuse_recall_before_after_ko.png)

## 📊 전체 순위 (Abuse Recall 순)

| 모델 | Recall | F1 | Precision | LRAP | baseline 대비 |
|------|:---:|:---:|:---:|:---:|:---:|
| **LoRA v2 Game** | **85.89%** | 86.94% | 88.02% | 0.932 | **+27.8p** |
| **Full v2 Game** | 84.68% | **87.32%** | 90.13% | **0.936** | +26.6p |
| LoRA v2 Tutorial | 84.27% | 82.45% | 80.69% | 0.908 | +26.2p |
| Full v2 Tutorial | 80.24% | 83.79% | 87.67% | 0.915 | +22.2p |
| LoRA v1 Game | 78.63% | 84.42% | 91.12% | 0.924 | +20.6p |
| LoRA v1 Tutorial | 72.18% | 79.91% | 89.50% | 0.902 | +14.1p |
| Full v1 Game | 72.18% | 81.00% | 92.27% | 0.911 | +14.1p |
| Full v1 Tutorial | 65.32% | 76.06% | 91.01% | 0.892 | +7.3p |
| Baseline (kor_unsmile) | 58.06% | 72.73% | 97.30% | 0.887 | — |

> baseline은 Precision 97.3%로 가장 높지만 Recall 58%(욕설 42% 놓침). 파인튜닝은 **Precision을 80~92%로 약간 내주는 대신 Recall을 크게 끌어올림** → F1·LRAP 상승.

## 🔬 핵심 인사이트

### 1. 게임 데이터(v2)가 결정적
![v1 vs v2](./v1_vs_v2.png) · 한국어판: [`v1_vs_v2_ko.png`](./v1_vs_v2_ko.png)

| | v1 (보정 unSmile만) | v2 (+ 게임 수집 518) | 차이 |
|---|:---:|:---:|:---:|
| 평균 Abuse Recall | 72.1% | **83.8%** | **+11.7%p** |

**모든 조합**에서 v2 > v1. 단 **518건의 게임 채팅**으로 +11.7%p — 도메인 데이터의 위력.

### 2. LoRA ≈ Full
평균 Recall: LoRA **80.2%** vs Full 75.6%. 성능 유사(이 셋에선 LoRA가 약간 우위) → **효율(메모리·속도) 면에서 LoRA 권장**.

### 3. base 모델: Game(KcELECTRA) > Tutorial(kcbert)
평균 Recall: Game base **80.4%** vs Tutorial 75.5%. 상위 4개 중 Game이 3개.

## ⚠️ best 모델이 바뀜 (Step 7 재선정 필요)

> 옛 문서의 best **`Full v2 Tutorial`**(구 game_test 187 기준 Recall 87.93%)은 **test_set(482)에선 4위(80.24%)** 로 밀림.
> 482 기준 후보:
> - **Recall 최우선** → **LoRA v2 Game** (85.89%)
> - **균형(F1·LRAP)·배포 안정성** → **Full v2 Game** (F1 87.32% / LRAP 0.936 / Precision 90.13%)
>
> → [`../7_Best_Model_Selection`](../7_Best_Model_Selection)에서 재선정. **양자화(8단계) 대상도 이에 맞춰 변경 필요**(현재 Full v2 Tutorial 양자화본은 stale).

## 📈 그래프 읽는 법

**① `abuse_recall_before_after.png`** — 파인튜닝 효과(헤드라인)
- 슬레이트(맨 아래) = **baseline 58.1%**(점선 = 그 기준선). 그 위 8개는 전부 파인튜닝 → 기준선을 넘김.
- 틸 + `best` 알약 = **LoRA v2 Game 85.9%**. 막대가 점선에서 얼마나 오른쪽인지 = 개선폭.

**② `v1_vs_v2.png`** — 게임 데이터 효과
- 회색 점 = v1(게임 데이터 없이), 틸 점 = v2(+게임 518), 화살표 = v1→v2 상승.
- 4개 조합 전부 오른쪽(상승)으로 화살표 → "게임 데이터가 핵심"을 한 장으로.

## 📁 파일
| 파일 | 내용 |
| :--- | :--- |
| `compare_models.py` | 9모델 평가(index-8 + LRAP) → CSV/JSON |
| `plot_comparison.py` | 포트폴리오 차트(en/ko) — CSV 기반, 재추론 불필요 |
| `comparison_results.csv` · `.json` | 전체 수치(TP/TN/FP/FN 포함) |
| `_archive/` | 옛 game_test(187) 결과 백업 |

## ▶️ 다음 단계
[`../7_Best_Model_Selection`](../7_Best_Model_Selection)(482 기준 best 재선정) → [`../8_Quantization`](../8_Quantization)(선정 모델 INT8 양자화)
