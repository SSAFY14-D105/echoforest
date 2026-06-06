# 🎮 6개 모델 벤치마크 결과

## 📊 테스트 환경
- **테스트 데이터**: `test_set.tsv` (482건, held-out · abuse 248 / clean 234)
- **테스트 일시**: 2026-06-06 17:06
- **데이터 출처**: 협동 게임 STT + 유튜브 협동게임 STT
- **모델 수**: 6개 (Korean Sentiment 복귀) · **선정 기준**: Abuse F1 · **임계값**: 0.5(argmax)
- ⚠️ **유효 비교 모델은 UnSmile·Korean Sentiment·Multilingual 3종**. KoELECTRA Small/Base·KcELECTRA v2는 현 transformers에서 분류 헤드가 로드되지 않아(랜덤 초기화) 수치가 비결정적(noise) — off-the-shelf로는 못 씀을 보여주는 대조군.

---

## 🏆 결과 요약

| 모델 | Abuse Recall | Abuse F1 | 선정 |
|------|:------------:|:--------:|:----:|
| UnSmile | **60.08%** | 73.95% | ✅ |
| Korean Sentiment | **93.95%** | 71.36% |  |
| KoELECTRA Small | **92.34%** | 65.06% |  |
| Multilingual | **70.16%** | 60.00% |  |
| KcELECTRA v2 | **39.52%** | 47.57% |  |
| KoELECTRA Base | **5.24%** | 8.70% |  |

---

## 🔁 구 688판 대비 (재정제 전후, UnSmile)

| 지표 | 구 test_set (688) | 현 test_set (482) | 변화 |
|------|:---:|:---:|:---:|
| Abuse Recall | 66.51% | 60.08% | -6.4%p |
| Abuse F1 | 74.87% | **73.95%** | -0.9%p |

> 482는 더 어렵고(긴 완결문장) 균형 잡힌(abuse 51%) 셋이라 Recall은 다소 내려갔지만 **F1은 거의 동일**. **선정 결론(UnSmile 1위)은 그대로 유지**. (구 결과 백업: [`_archive/`](./_archive/))

---

## 🎯 UnSmile 선정 이유

### 1. 최고 성능 (선정 기준: Abuse F1)
- **Abuse F1**: 73.95% (모델 중 1위)
- **Abuse Precision**: 96.13% · **Recall**: 60.08%
- **Accuracy**: 78.22% · **Clean F1**: 81.28%

> ⚠️ 선정은 Recall이 아니라 **F1 기준**. 단순 Recall 최대 모델은 거의 모든 문장을 욕설로 분류해(Precision↓·오탐↑) 실사용 불가 → 균형 지표로 선정.

### 2. 한국어 혐오 발언 전용
- Smilegate AI의 **한국어 혐오 발언 탐지** 전용 모델, 댓글/채팅 학습 → 게임 대화에 적합

### 3. 다른 모델 한계
- **Korean Sentiment** (실제 #2): Recall 93.95%로 최고지만 clean 234건 중 **172건을 욕설로 오탐**(Precision 57.5%) → over-flagging, 게임에 쓰면 멀쩡한 말에도 저주 발동 → 실사용 불가
- **KoELECTRA Small/Base · KcELECTRA v2**: 현 transformers에서 분류 헤드 미로딩(랜덤) → Small 92% vs Base 5%로 갈리는 것 자체가 noise 증거 → 후보 제외
- **Multilingual**: 범용 별점 감정모델 → F1 60% 중위권, 게임 욕설 특화 부족

> 💡 **핵심 대비**: UnSmile은 clean 234건 중 오탐이 **단 6건**(Precision 96.1%)인데 Korean Sentiment는 **172건** 오탐. Recall만 보면 Korean Sentiment(94%)가 높지만, F1로 보면 UnSmile이 1위 — 그래서 **F1 기준 선정**.

---

## 📈 그래프 자세히 보기

> 영어판 + 한국어판(`_ko`) 제공. 생성: `python plot_benchmark.py` (CSV 기반, 재추론 불필요).
> 두 그래프는 **한 쌍**으로 읽는다 — ①은 *"누가 1등인가"*, ②는 *"왜 그 기준(F1)으로 뽑았나"*.

### ① 선정 — Abuse F1 랭킹
![Best Model Selection](./best_model_selection.png)
한국어판: [`best_model_selection_ko.png`](./best_model_selection_ko.png)

**무엇을 보여주나**: 6개 모델을 **Abuse F1**(욕설 탐지의 Precision·Recall 조화평균)으로 줄세운 가로 막대. 위로 갈수록 높음.

**읽는 법 (요소별)**
- **x축** = Abuse F1 (%), 0~100. 막대 끝 숫자 = F1 값.
- 🟩 **틸(녹색) 막대 + `선정` 알약** = 선정된 **UnSmile**(74.0).
- ◾ **진회색 막대** = 유효 후보(Korean Sentiment 71.4, Multilingual 60.0).
- ▫️ **흐린 회색 + 모델명 옆 `†`** = KoELECTRA Small/Base·KcELECTRA v2. 분류 헤드 미로딩으로 **점수가 noise** → 색을 흐리게 해 "신뢰 비교 대상이 아님"을 시각적으로 분리(각주 참고).

**읽어내는 것**: 신뢰할 수 있는 비교는 **위 3개(틸+진회색)** 뿐이고, 그중 UnSmile이 1위. KoELECTRA Small이 65.1로 높아 보여도 흐린 처리 = 참고용(대조군).

> **결론**: F1 1위 = **UnSmile 선정**.

### ② 왜 F1으로 뽑았나 — Precision vs Recall (덤벨)
![Model Comparison](./6_model_comparison.png)
한국어판: [`6_model_comparison_ko.png`](./6_model_comparison_ko.png)

**무엇을 보여주나**: 유효 후보 **3종**에 대해, 각 모델의 **Precision(정밀도)** 과 **Recall(재현율)** 을 한 행에 두 점으로 찍고 선으로 이은 *덤벨* 차트. (noise 3종은 의미가 없어 제외)

**먼저 용어**
- **Precision(정밀도)** = *"욕설이라 판정한 것 중 진짜 욕설 비율"* → 높을수록 **오탐(FP)이 적다**(= 멀쩡한 말을 욕설로 안 잡음).
- **Recall(재현율)** = *"실제 욕설 중 잡아낸 비율"* → 높을수록 **놓침(FN)이 적다**.

**읽는 법 (요소별)**
- 🟢 **녹색 점** = Precision · ⬤ **슬레이트 점** = Recall · 두 점을 잇는 **선 = 둘의 간격(불균형)**.
- 오른쪽 **`F1 xx.x`** = 그 모델의 F1(두 지표의 균형).

**행별 해석**
- **UnSmile** — 녹색(P) **96**이 우측 끝, 슬레이트(R) 60. → *신중형*: 욕설을 60% 잡고, **오탐은 거의 없음**(clean 234건 중 6건).
- **Korean Sentiment** — 녹색(P) **58**이 왼쪽으로 처지고 슬레이트(R) **94**. → *과탐형*: 거의 다 잡지만 clean 234건 중 **172건을 욕설로 오탐**.
- **Multilingual** — P 52 / R 70, 둘 다 낮음.

**왜 이 그래프가 결정적인가**: Recall(슬레이트)만 보면 Korean Sentiment(94)가 UnSmile(60)보다 좋아 보인다. 하지만 **녹색 점(Precision)의 위치**를 보면 Korean Sentiment는 한참 왼쪽(58) = 과탐이 명백하고, UnSmile은 우측 끝(96) = 게임에 안전하다. 게임에선 *오탐 = 욕 안 했는데 저주 발동*이라 Precision이 중요 → **두 지표를 함께 보는 F1으로 골라야** 하고, F1은 UnSmile이 1위. 이 한 장이 "①의 선정 기준이 왜 F1인지"를 증명한다.

---

## 📋 상세 결과

| 모델 | TP | TN | FP | FN | Precision | Recall |
|------|:--:|:--:|:--:|:--:|:---------:|:------:|
| KoELECTRA Small | 229 | 7 | 227 | 19 | 50.2% | 92.3% |
| KoELECTRA Base | 13 | 196 | 38 | 235 | 25.5% | 5.2% |
| Multilingual | 174 | 76 | 158 | 74 | 52.4% | 70.2% |
| Korean Sentiment | 233 | 62 | 172 | 15 | 57.5% | 94.0% |
| UnSmile | 149 | 228 | 6 | 99 | 96.1% | 60.1% |
| KcELECTRA v2 | 98 | 168 | 66 | 150 | 59.8% | 39.5% |

---

## 🚀 다음 단계
1. UnSmile 기반으로 **게임 STT 데이터로 Fine-tuning**
2. LoRA vs Full Fine-tuning 비교
3. 최적 모델 INT8 양자화
