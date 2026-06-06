# 모델 선정 — 근거 메모

> 수치·그래프는 [`results/MODEL_BENCHMARK.md`](./results/MODEL_BENCHMARK.md). 이 문서는 **왜 UnSmile을, 왜 F1으로 골랐나**와 그 과정의 트러블슈팅 교훈을 정리한다.

## 선정: UnSmile (`smilegate-ai/kor_unsmile`)

- **평가**: `test_set.tsv`(482, held-out) · 임계값 0.5 · 6개 모델 비교
- **기준**: Abuse F1(Precision·Recall 조화평균). UnSmile **F1 74.0% 1위** (Precision 96.1% / Recall 60.1%)
- 한국어 혐오발언 전용 모델(Smilegate AI), 댓글/채팅으로 학습 → 게임 대화 도메인에 가장 근접

## 왜 Recall이 아니라 F1인가 (핵심)

게임에선 "욕설을 놓치는 것(FN)"보다 **"멀쩡한 말을 욕설로 오탐(FP)"이 더 치명적** — 오탐은 곧 *욕 안 했는데 저주 발동*(최악의 UX).

- **Korean Sentiment**: Recall 94.0%(1위)지만 clean 234건 중 **172건 오탐**(Precision 57.5%) → 실사용 불가
- **UnSmile**: Recall 60.1%로 낮아 보여도 오탐 **단 6건**(Precision 96.1%) → 균형(F1) 1위

⇒ Recall만 보면 과탐 모델을 잘못 고른다. 그래서 **F1으로 선정**. (시각적 근거 = `6_model_comparison.png` 덤벨 그래프)

## 트러블슈팅 교훈

1. **모델별 '부정' 라벨이 제각각** — 매핑을 안 맞추면 전 모델이 F1 50% 근처로 고정됨(초기 증상).
   UnSmile `악플/욕설`(+혐오 8종) · Korean Sentiment `LABEL_0` · KoELECTRA `negative` · Multilingual `1~2 stars` → `MODEL_NEGATIVE_LABELS`로 통일.
2. **임계값은 0.5 고정(공정 비교)** — 초기엔 모델별 threshold 튜닝도 탐색했으나, 모델마다 다른 임계값은 비교를 왜곡한다. 최종 벤치마크·파인튜닝·배포 모두 **0.5**로 통일.
3. **튜닝 안 된 모델은 못 쓴다** — KoELECTRA/KcELECTRA는 분류 헤드가 (현 transformers에선 아예) 로드되지 않아 출력이 noise. base·범용 감정모델이 아니라 **도메인 학습된 모델**이 필요하다는 결론 → UnSmile 채택 후 게임 데이터로 fine-tuning(4·5단계).

## 제외/비채택 모델

| 모델 | 사유 |
| :--- | :--- |
| KoELECTRA Small/Base · KcELECTRA v2 | 분류 헤드 미로딩 → 수치 noise (off-the-shelf 대조군) |
| Multilingual | 범용 별점 감정모델 → F1 60% 중위권 |
| Korean Sentiment | 과탐(Precision 57.5%) — 대안이나 실사용 부적합 |

## 다음 단계

UnSmile을 게임 STT 데이터로 fine-tuning → [`../4_LoRA_Fine_Tuning`](../4_LoRA_Fine_Tuning) · [`../5_Full_Fine_Tuning`](../5_Full_Fine_Tuning)
