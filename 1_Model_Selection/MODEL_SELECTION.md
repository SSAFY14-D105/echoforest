# 모델 선정, 근거 메모

> 수치·그래프는 [`results/MODEL_BENCHMARK.md`](./results/MODEL_BENCHMARK.md). 이 문서는 **왜 UnSmile을, 왜 F1으로 골랐나**와 그 과정의 트러블슈팅 교훈을 정리한다.

## 선정: UnSmile (`smilegate-ai/kor_unsmile`)

- **평가**: `test_set.tsv`(482, 학습에 안 쓴 평가셋) · 5개 모델 비교(모두 분류 헤드 실제 로드)
- **선정 기준**: **AP(평균정밀도, 임계값 무관)**. UnSmile **AP 91.9% 1위** (2위 Korean Sentiment 79.2%, **+12.7%p**)
- **왜 0.5가 아니라 AP인가**: 멀티라벨·불균형 모델을 0.5 한 점 F1로 고르면 임계값에 휘둘린다. AP는 모든 임계값을 평균한 랭킹 품질이라 선정이 임계값과 무관해진다(6단계 LRAP와 같은 원칙). 운영점 F1은 참고용 — **0.2에서 81.3%**(2위 +11.6%p), 0.5에서 74.0%(2위 +2.6%p)로, 0.5는 오히려 UnSmile에 가장 불리한 비교점이었다
- **abuse 판정**: not-clean(clean이 아니면 부정어, 9개 라벨 max > 0.5), Step 2·Step 6·배포와 동일 정의
- 한국어 혐오발언 전용 모델(Smilegate AI), 댓글/채팅으로 학습 → 게임 대화 도메인에 가장 근접

## 왜 Recall이 아니라 AP인가 (핵심)

게임에선 "부정어를 놓치는 것(FN)"보다 **"멀쩡한 말을 부정어로 오탐(FP)"이 더 치명적**, 오탐은 곧 *욕 안 했는데 저주 발동*(최악의 UX).

- **Korean Sentiment**: Recall 94.0%(1위)지만 clean 234건 중 **172건 오탐**(Precision 57.5%) → 실사용 불가
- **UnSmile**: Recall 60.1%로 낮아 보여도 오탐 **6건**(Precision 96.1%) → 균형(F1) 1위

⇒ Recall만 보면 과탐 모델을 잘못 고른다. Precision까지 함께 보는 임계값-무관 지표 **AP로 선정**(UnSmile 91.9%로 압도적 1위, 2위 +12.7%p). (시각적 근거 = `results/selection_threshold_free_ko.png`, 좌: AP 랭킹 / 우: 임계값 sweep)

## 트러블슈팅 교훈

1. **모델별 '부정' 라벨이 제각각**, 매핑을 안 맞추면 전 모델이 F1 50% 근처로 고정됨(초기 증상).
   UnSmile `악플/욕설`(+혐오 8종) · Korean Sentiment `LABEL_0` · KoELECTRA `negative` · Multilingual `1~2 stars` → `MODEL_NEGATIVE_LABELS`로 통일.
2. **모델 비교는 임계값 0.5 고정(공정 비교)**, 모델마다 다른 임계값은 비교를 왜곡하므로 벤치마크·파인튜닝 비교를 0.5로 통일. 실제 배포 임계값은 멀티라벨 불균형을 반영해 더 낮게(~0.1~0.28) 별도 캘리브레이션(8단계).
3. **저장 헤드 형식 불일치 → 수동 로드로 해결**, KoELECTRA 감정모델 2종은 저장된 분류 헤드가 구 형식(단일 Linear)이라 현 transformers 표준 로더가 헤드를 **랜덤 초기화**해버린다(수치=noise). → 인코더(`ElectraModel`)+단일 Linear를 [CLS]에 **수동으로 붙여 학습된 헤드를 로드**(`load_koelectra_sentiment`). `씨발`→negative 0.99 등 정상 확인 후 실수치 산출.
4. **헤드 없는 base는 제외**, `beomi/KcELECTRA-base-v2022`는 `ElectraForPreTraining`(분류 헤드 없음). 불러올 머리가 없어 off-the-shelf 분류 불가 → 후보 제외(게임 데이터로 헤드를 학습시키는 4·5단계에서 사용).
5. **감정 ≠ 부정어**, 제대로 로드해도 범용 감정모델 4종은 "부정 감정"을 "부정어"로 간주해 과탐(Precision 52~58%). 도메인 전용(UnSmile)이나 도메인 fine-tuning이 필요하다는 결론 → UnSmile 채택 후 fine-tuning(4·5단계).

## 제외/비채택 모델

| 모델 | 사유 |
| :--- | :--- |
| KcELECTRA-base-v2022 | 분류 헤드 없는 base LM → 후보 제외 (4·5단계 fine-tuning 대상) |
| Korean Sentiment · KoELECTRA Base/Small · Multilingual | 범용 감정모델 → 부정감정을 부정어로 과탐(Precision 52~58%, clean 158~174건 오탐), 실사용 부적합 |

## 다음 단계

UnSmile을 게임 STT 데이터로 fine-tuning → [`../4_LoRA_Fine_Tuning`](../4_LoRA_Fine_Tuning) · [`../5_Full_Fine_Tuning`](../5_Full_Fine_Tuning)
