# 6_Model_Comparison, 9개 모델 비교 결과 (test_set 482)

baseline(파인튜닝 전) + 파인튜닝 8개를 **학습에 쓰지 않은 `test_set`(482)** 으로 비교한 **메인 헤드라인**입니다.

- **abuse 판정**: not-clean(clean이 아니면 부정어, 9개 라벨 max > 0.5), 배포와 Step 8 동일 정의, **비교 임계값 0.5**
- **지표**: Abuse/Clean Precision·Recall·F1(운영점 0.5) + **AP·AUROC**(임계값 무관 공정 비교) · LRAP(참고: 이 test_set은 활성 라벨 1개라 사실상 이진)
- 생성: `python compare_models.py` → `comparison_results.csv/.json` · 포트폴리오 차트 `python plot_comparison.py` · 논문용 PNG/PDF `python plot_paper_figures.py`

> **UnSmile 숫자 주의**: Step 1의 UnSmile **AP 91.94**는 5개 후보를 고르기 위한 이진 abuse 랭킹 지표이고, Step 2의 **Recall 60.08 / F1 73.95**는 threshold 0.5로 실제 판정한 운영점 성능입니다. 이 문서의 baseline **LRAP 0.8869**는 10개 라벨 확률 순위 기반이라 AP와 계산식이 다릅니다(단 이 test_set은 활성 라벨이 1개뿐이라 LRAP가 사실상 이진으로 동작 → 선정 변별은 AP·AUROC를 주로 봄).

## 📛 모델 이름 읽는 법

모델 이름은 **`[방식] [데이터] [base]`** 3축의 조합입니다 (예: `Full v2 Game`).

| 축 | 값 | 뜻 |
| :--- | :--- | :--- |
| **방식** | `LoRA` / `Full` | 파인튜닝 방식 (LoRA=경량 어댑터 / Full=전체 가중치 학습) |
| **데이터** | `v1` / `v2` | 학습 데이터 (v1 = 보정 unSmile만 / **v2 = + 게임 수집 518건**) |
| **base** ⚠️ | `Game` / `Tutorial` | **베이스 모델**, `Game`=**KcELECTRA-base-v2022**, `Tutorial`=**kcbert-base** *(데이터가 아니라 base 모델임에 주의!)* |

> 예: **`Full v2 Game`** = **Full** 파인튜닝 · **게임데이터 포함(v2)** · base **KcELECTRA**.
> 폴더명(`full_game_kcelectra` 등)에서 온 내부 명칭이라, **차트에는 혼동 방지를 위해 base 모델명을 직접 표기**합니다 → `Full v2 KcELECTRA`, `LoRA v2 kcbert` …

## 🏆 헤드라인, 파인튜닝으로 Abuse Recall 60 → 86%

![before/after](./abuse_recall_before_after.png)
한국어판: [`abuse_recall_before_after_ko.png`](./abuse_recall_before_after_ko.png)

> 이 그래프는 **Recall만 보는 헤드라인 그래프**입니다. baseline 60.08%에서 파인튜닝 8개가 전부 기준선(점선)을 넘겼고, **Recall 1위는 LoRA v2 KcELECTRA 87.90%**, **최종 선정은 LoRA v2보다 오탐이 적고(FP 23 vs 30) LRAP 1위인 Full v2 KcELECTRA 85.48%**입니다(F1은 사실상 동률).

## 🎯 결정타, 공짜가 아니다: 정밀도를 내주고 재현율을 얻었다 (F1이 순이득 확인)

![trade-off](./tradeoff_baseline_vs_best.png)
한국어판: [`tradeoff_baseline_vs_best_ko.png`](./tradeoff_baseline_vs_best_ko.png)

Recall만 보면 선정 기준이 헷갈릴 수 있습니다. **같이 봐야 정직합니다**:

| | Precision | Recall | **F1** |
|---|:---:|:---:|:---:|
| Baseline | 96.1% | 60.1% | 74.0% |
| **Full v2 KcELECTRA (선정)** | 90.2% | 85.5% | **87.8%** |
| 변화 | **−6p** | **+25p** | **+14p** |

- 파인튜닝은 **정밀도를 96→90%로 6p 내주는 대신**(오탐 6→23건) **재현율을 25p 끌어올렸다.**
- 게임에선 오탐 = 가짜 저주라 정밀도가 중요한데(Step 1), **F1이 74.0→87.8로 +14%p** 오른 게 *"이 트레이드는 순이득"* 이라는 증거다. → 그래서 균형 지표(F1·LRAP)로 판단(Step 1의 임계값-무관 선정과 동일 철학).

## 📊 전체 순위 (Abuse Recall 순)

> 이름의 `Game`=KcELECTRA base, `Tutorial`=kcbert base (위 명명 규칙). 아래는 **base 모델명으로 표기**.

| 모델 (방식·데이터·base) | Recall | F1 | Precision | LRAP | baseline 대비 |
|------|:---:|:---:|:---:|:---:|:---:|
| LoRA · v2 · KcELECTRA | **87.90%** | 87.90% | 87.90% | 0.932 | +27.8p |
| LoRA · v2 · kcbert | 86.29% | 83.27% | 80.45% | 0.908 | +26.2p |
| **Full · v2 · KcELECTRA** ✅ | 85.48% | **87.78%** | **90.21%** | **0.936** | +25.4p |
| Full · v2 · kcbert | 82.26% | 84.82% | 87.55% | 0.915 | +22.2p |
| LoRA · v1 · KcELECTRA | 80.24% | 85.41% | 91.28% | 0.924 | +20.2p |
| LoRA · v1 · kcbert | 74.60% | 80.96% | 88.52% | 0.903 | +14.5p |
| Full · v1 · KcELECTRA | 73.39% | 81.80% | 92.39% | 0.911 | +13.3p |
| Full · v1 · kcbert | 67.74% | 77.42% | 90.32% | 0.892 | +7.7p |
| Baseline (kor_unsmile) | 60.08% | 73.95% | 96.13% | 0.887 | 기준 |

![AP·AUROC 임계값 무관 비교](./threshold_free_ap_auroc_ko.png)

> **임계값 무관 교차검증 + 유의성** (`threshold_free_significance.py` → `results/threshold_free_significance.json`, 캐시 점수 기준)
>
> | 모델 | AP | AUROC |
> |------|:---:|:---:|
> | **Full v2 KcELECTRA** ✅ | **96.21** | **95.22** |
> | LoRA v2 KcELECTRA | 96.04 | 94.80 |
> | Full v2 kcbert | 94.80 | 93.82 |
> | Baseline | 91.94 | 89.37 |
>
> AP·AUROC 두 임계값-무관 지표 모두 **Full v2 KcELECTRA가 1위** → 선정은 0.5에 의존하지 않습니다. (LRAP는 이 셋에서 활성 라벨 1개라 사실상 이진이므로 보조로만 사용)
> **상위 2개는 통계적 동률**: McNemar p=1.000, F1 차이 부트스트랩 95%CI [-2.54, +2.27]%p(0 포함). 변별은 오탐(FP)에서 나며, FP 차이 95%CI [-16, +1]로 Full v2가 오탐이 더 적은 쪽 → 게임 UX(낮은 오탐) 기준으로 Full v2 선정.

## 🔬 핵심 인사이트

### 1. 게임 데이터(v2)가 결정적
![v1 vs v2](./v1_vs_v2.png) · 한국어판: [`v1_vs_v2_ko.png`](./v1_vs_v2_ko.png)

| | v1 (보정 unSmile만) | v2 (+ 게임 수집 518) | 차이 |
|---|:---:|:---:|:---:|
| 평균 Abuse Recall | 74.0% | **85.5%** | **+11.5%p** |

**모든 조합**에서 v2 > v1. 단 **518건의 게임 채팅**으로 +11.5%p. (v1도 Step 3 보정으로 게임 키워드 44건이 들어가 있어, 도메인 적응의 *대부분*은 v2의 수집 데이터가 만든 것)

> ⚠️ **학습 설정 한 가지 주의**: 최종 모델인 Full KcELECTRA 한 쌍은 v2에만 `gradient_accumulation_steps=2`(실효 배치 32)와 조기 종료 인내값 3이 적용돼, v1과 학습 설정이 완전히 같지는 않습니다. 평균 +11.5%p 효과는 설정이 동일한 나머지 세 쌍(LoRA KcELECTRA·LoRA kcbert·Full kcbert)에서도 일관되게 재현되므로 결론은 유지되지만, 이 한 쌍의 절대 상승폭은 순수 데이터 효과로만 읽지 않는 것이 정확합니다.

### 2. LoRA ≈ Full · Game(KcELECTRA) > Tutorial(kcbert)
평균 Recall: LoRA 82.3% vs Full 77.2% / Game base 81.8% vs Tutorial 77.7%. **LoRA가 Full에 동등 이상(게다가 가벼움)**, base는 Game(KcELECTRA)이 우세.

## ✅ 선정, Full v2 KcELECTRA (Step 7)

> **상위 2개(LoRA v2 KcELECTRA · Full v2 KcELECTRA)는 통계적 동률**(McNemar p=1.000), LoRA v2 KcELECTRA 87.90 vs Full v2 KcELECTRA 85.48은 **abuse 248문장 중 6문장 차이**입니다. (Recall 3위 LoRA v2 kcbert 86.29까지 상위권 Recall은 6문장 이내로 근접하나, 통계 검정은 상위 2개에 한합니다.) 즉 "Recall 1등"만으로는 부족하고, 변별은 **Precision·F1·LRAP**에서 납니다.

**Full v2 KcELECTRA 선정** (내부 폴더명 `full_game_kcelectra_v2`), **LRAP 0.936 1위 · LoRA v2 대비 낮은 오탐(FP 23 vs 30) · F1 87.78(사실상 동률) · Precision 90.21**. Step 1에서 정한 *"오탐이 치명적이라 정밀도로 고른다"* 기준과 일관.
- *대안*: **LoRA v2 KcELECTRA**, Recall 1등 + LoRA(경량). 효율을 최우선하면 이쪽도 동급. (정밀도 88 vs 90으로 Full v2 KcELECTRA가 가짜저주에 약간 더 안전 → 선정)

⚠️ 옛 문서의 best **Full v2 kcbert**(`full_tutorial_kcbert_v2`, 구 187 기준)은 482에선 **4위(82.26%)** 로 밀림 → 최신 선정·압축 대상은 **Full v2 KcELECTRA**로 갱신 완료.

## 📈 그래프 읽는 법
- **① before/after**, Recall 전용 그래프. muted gray=baseline 60.1%(점선 기준), `Recall 1위`=LoRA v2 KcELECTRA, teal `최종 선정`=Full v2 KcELECTRA.
- **② trade-off**, Precision만 막대가 내려가고(−6p, 작은 비용), Recall과 F1은 크게 오름(+25p, +14p). "F1 순이득"을 한 장으로.
- **③ v1 vs v2**, soft gray(v1)→teal(v2) 화살표, 4조합 전부 상승 = 게임 데이터 효과. 색만으로 구분하지 않도록 점·화살표·수치 라벨을 함께 사용.

## 📁 파일
| 파일 | 내용 |
| :--- | :--- |
| `compare_models.py` | 9모델 평가(not-clean + LRAP) → CSV/JSON |
| `plot_comparison.py` | 포트폴리오 차트 3종 en/ko, CSV 기반, 재추론 불필요 |
| `plot_paper_figures.py` | 논문 삽입용 PNG/PDF 그래프 3종 en/ko |
| `comparison_results.csv` · `.json` | 전체 수치(TP/TN/FP/FN 포함) |

## ▶️ 다음 단계
[`../../7_Best_Model_Selection`](../../7_Best_Model_Selection)(Full v2 KcELECTRA 확정) → [`../../8_Quantization`](../../8_Quantization)(FP16 권장, INT8 보정 필요)
