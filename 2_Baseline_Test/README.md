# 2_Baseline_Test — 파인튜닝 전 base unSmile 성능 (공식 "before")

선정한 **base unSmile**(파인튜닝 전)을 **held-out `test_set`(482)** 으로 측정하는 단계입니다.
이 수치가 4~7단계 파인튜닝의 **출발점("before")** 이고, Step 6의 baseline과 동일합니다.

> 📖 전체 흐름·동기(threshold 딜레마): [`../AI_파이프라인_개요.md`](../AI_파이프라인_개요.md) · 모델 선정: [`../1_Model_Selection`](../1_Model_Selection)

## ⚙️ 설정
- **모델**: `smilegate-ai/kor_unsmile` (파인튜닝 전 원본)
- **데이터**: `../0_Data_Collection/datasets/test_set.tsv` (482 · abuse 248 / clean 234)
- **abuse 판정**: `악플/욕설`(index 8) sigmoid > **0.5** — 배포(FastAPI `probs[8]`)·Step 1·Step 6과 **동일 정의**
- ※ multi-label(sigmoid)이라 각 라벨이 독립 → 임계값은 `1/10`이 아니라 **0.5**가 표준(라벨별 Yes/No)

## 📊 결과 — base unSmile on test_set(482)

| 지표 | 악플/욕설 | Clean |
|------|:---:|:---:|
| Precision | **0.9730** | 0.7028 |
| **Recall** | **0.5806** | 0.9701 |
| F1 | 0.7273 | 0.8151 |

**Confusion Matrix (악플/욕설)**

| | Pred Non-Abuse | Pred Abuse |
|---|:---:|:---:|
| **Actual Non-Abuse** | 230 (TN) | **4 (FP)** |
| **Actual Abuse** | **104 (FN)** | 144 (TP) |

> Step 1의 UnSmile 행과 **정확히 동일**(R 58.06 / P 97.30 / F1 72.73 / FP 4 / FN 104) — 같은 모델·데이터·정의.

## 🎯 핵심 — "before"이자 파인튜닝의 동기

base unSmile은 **Precision 97.3%(오탐 4건)** 로 매우 보수적이지만, **Recall 58.1% — 실제 욕설 248건 중 104건(42%)을 놓친다.**

- **놓치는 건 직접적 욕설이 아니라 "게임 맥락의 은근한 비난·불만"** → 확률이 0.5 *아래*로 새어나감(아래 FN 예시, 확률 0.43~0.48).
- 임계값을 낮춰 더 잡으려 하면? → 멀쩡한 게임 오더(`제발 가만히 좀 침착해`)까지 과탐(*threshold 딜레마*).
- ⇒ 임계값 한 개로는 못 푼다. **게임 데이터 fine-tuning(3~7단계)** 으로 *학습*해서 Recall↑ & Precision 유지.

| 지표 | 현재(baseline) | 파인튜닝 목표 |
|------|:---:|:---:|
| 악플/욕설 Recall | **0.5806** | ≥ 0.75 |
| 악플/욕설 F1 | 0.7273 | ≥ 0.80 |

## ❌ 인식 실패 진단

**놓친 욕설 (False Negative) — 104건** *(게임 맥락 비난, 확률이 0.5 미달)*
```
"개아쉽다 너희들"            (0.483)   "아니 왜 밀어 멍청아"        (0.465)
"니네랑 하면 영원히 못할듯"   (0.475)   "형 말을 귓등으로도 안쳐듣네"  (0.459)
"아니 비켜 너 때문에 죽잖아"  (0.443)   "때려치자"                  (0.433)
```
→ 직접 욕설("씨발")은 잘 잡지만, **은근한 비난·게임 불만은 0.5 문턱을 못 넘음** = 파인튜닝 1순위.

**오탐 (False Positive) — 단 4건** *(거친 단어에 반응)*
```
"그 쓰레기가 아니라 해봐"  (0.679)   "제발 가만히 좀 침착해"  (0.672)
```
→ `쓰레기`·`추악한` 같은 단어로 오탐. 매우 적음(precision 97%)이라 fine-tuning은 **Recall 개선에 집중**.

## 📈 그래프 (`baseline_accuracy.png`)

4-panel 진단:
1. **Abuse Confusion Matrix** — FN 104(놓친 욕설)가 핵심 문제.
2. **Clean Confusion Matrix** — clean은 양호(Recall 97%).
3. **Abuse probability 분포** ⭐ — 실제 욕설(틸)의 확률 질량이 **0.5 왼쪽으로 새어나감**(= 놓침). 파인튜닝이 이걸 오른쪽으로 밀어야 함.
4. **Abuse 지표 + 목표선** — Precision은 높고 **Recall이 격차**(0.58 vs 목표 0.75).

## 📁 파일 / 실행
| 파일 | 내용 |
| :--- | :--- |
| `baseline_test.py` | base unSmile을 test_set(482)으로 평가 → CSV·PNG |
| `baseline_test_results.csv` | 문장별 확률·정답여부 |
| `baseline_accuracy.png` | 4-panel 진단 시각화 |
| `keywords_unsmile_format.tsv` | (참고) 초기 진단에 썼던 수집 키워드셋(518). 현재는 `train_collected`로 학습에 쓰임 |

```bash
cd 2_Baseline_Test
python baseline_test.py   # ../0_Data_Collection/datasets/test_set.tsv 평가
```

## ▶️ 다음 단계
base의 한계(Recall 58%, 게임 비난 놓침)를 보정 + 학습으로 푼다:
[`../3_UnSmile_Correction`](../3_UnSmile_Correction)(라벨 보정) → [`../4_LoRA_Fine_Tuning`](../4_LoRA_Fine_Tuning) · [`../5_Full_Fine_Tuning`](../5_Full_Fine_Tuning)
