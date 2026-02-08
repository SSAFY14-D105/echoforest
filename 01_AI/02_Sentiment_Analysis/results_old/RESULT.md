🎭 감정 분석 모델 벤치마크 시작!
📋 테스트 모델 수: 6
📝 테스트 문장 수: 10
🔄 반복 횟수: 3
============================================================

============================================================
🧪 테스트: Korean Sentiment (matthewburke)
   모델: matthewburke/korean_sentiment
============================================================
📥 모델 로딩 중...
Device set to use cuda:0
✅ 로드 완료! (1.93초)
🔥 워밍업...

📊 반복 1/3
You seem to be using the pipelines sequentially on GPU. In order to maximize efficiency please use a dataset

📊 반복 2/3

📊 반복 3/3
  ❌ [ 13.8ms] "야 진짜 뭐하냐"
      예측: LABEL_0 (90.47%) | 정답: NEGATIVE
  ❌ [  9.6ms] "아 ㅅㅂ"
      예측: LABEL_0 (93.15%) | 정답: NEGATIVE
  ❌ [ 12.3ms] "하... 진짜 못하네"
      예측: LABEL_0 (95.58%) | 정답: NEGATIVE
  ✅ [  7.5ms] "야 진짜 잘하네~"
      예측: LABEL_1 (96.63%) | 정답: NEGATIVE
  ✅ [  7.6ms] "와 대단하다 진짜"
      예측: LABEL_1 (95.08%) | 정답: NEGATIVE
  ❌ [  8.8ms] "사랑해"
      예측: LABEL_1 (94.39%) | 정답: POSITIVE
  ✅ [  8.5ms] "뽀뽀 쪽"
      예측: LABEL_0 (66.23%) | 정답: POSITIVE
  ❌ [  8.6ms] "잘했어!"
      예측: LABEL_1 (94.78%) | 정답: POSITIVE
  ❌ [  7.5ms] "고마워"
      예측: LABEL_1 (93.77%) | 정답: POSITIVE
  ❌ [  9.7ms] "최고야"
      예측: LABEL_1 (96.84%) | 정답: POSITIVE

📈 결과 요약:
   정확도: 30.0% (3/10)
   평균 레이턴시: 11.4ms
   TP=2 TN=1 FP=4 FN=3
   Precision: 33.3% | Recall: 40.0% | F1: 36.4%
🧹 메모리 정리 중...

============================================================
🧪 테스트: KoELECTRA Small Sentiment
   모델: monologg/koelectra-small-finetuned-sentiment
============================================================
📥 모델 로딩 중...
Some weights of the model checkpoint at monologg/koelectra-small-finetuned-sentiment were not used when initializing ElectraForSequenceClassification: ['classifier.bias', 'classifier.weight']
- This IS expected if you are initializing ElectraForSequenceClassification from the checkpoint of a model trained on another task or with another architecture (e.g. initializing a BertForSequenceClassification model from a BertForPreTraining model).
- This IS NOT expected if you are initializing ElectraForSequenceClassification from the checkpoint of a model that you expect to be exactly identical (initializing a BertForSequenceClassification model from a BertForSequenceClassification model).
Some weights of ElectraForSequenceClassification were not initialized from the model checkpoint at monologg/koelectra-small-finetuned-sentiment and are newly initialized: ['classifier.dense.bias', 'classifier.dense.weight', 'classifier.out_proj.bias', 'classifier.out_proj.weight'] 
You should probably TRAIN this model on a down-stream task to be able to use it for predictions and inference.
Device set to use cuda:0
✅ 로드 완료! (1.27초)
🔥 워밍업...

📊 반복 1/3

📊 반복 2/3

📊 반복 3/3
  ❌ [ 41.8ms] "야 진짜 뭐하냐"
      예측: positive (50.87%) | 정답: NEGATIVE
  ✅ [ 38.7ms] "아 ㅅㅂ"
      예측: negative (50.10%) | 정답: NEGATIVE
  ❌ [ 74.2ms] "하... 진짜 못하네"
      예측: positive (50.75%) | 정답: NEGATIVE
  ✅ [ 68.3ms] "야 진짜 잘하네~"
      예측: negative (50.76%) | 정답: NEGATIVE
  ✅ [ 59.3ms] "와 대단하다 진짜"
      예측: negative (51.22%) | 정답: NEGATIVE
  ❌ [ 41.5ms] "사랑해"
      예측: negative (51.52%) | 정답: POSITIVE
  ✅ [ 55.8ms] "뽀뽀 쪽"
      예측: positive (50.80%) | 정답: POSITIVE
  ❌ [ 38.9ms] "잘했어!"
      예측: negative (50.92%) | 정답: POSITIVE
  ❌ [ 57.7ms] "고마워"
      예측: negative (51.82%) | 정답: POSITIVE
  ❌ [ 57.2ms] "최고야"
      예측: negative (50.53%) | 정답: POSITIVE

📈 결과 요약:
   정확도: 40.0% (4/10)
   평균 레이턴시: 25.5ms
   TP=3 TN=1 FP=4 FN=2
   Precision: 42.9% | Recall: 60.0% | F1: 50.0%
🧹 메모리 정리 중...

============================================================
🧪 테스트: KoELECTRA Base Sentiment
   모델: monologg/koelectra-base-finetuned-sentiment
============================================================
📥 모델 로딩 중...
Some weights of the model checkpoint at monologg/koelectra-base-finetuned-sentiment were not used when initializing ElectraForSequenceClassification: ['classifier.bias', 'classifier.weight']
- This IS expected if you are initializing ElectraForSequenceClassification from the checkpoint of a model trained on another task or with another architecture (e.g. initializing a BertForSequenceClassification model from a BertForPreTraining model).
- This IS NOT expected if you are initializing ElectraForSequenceClassification from the checkpoint of a model that you expect to be exactly identical (initializing a BertForSequenceClassification model from a BertForSequenceClassification model).
Some weights of ElectraForSequenceClassification were not initialized from the model checkpoint at monologg/koelectra-base-finetuned-sentiment and are newly initialized: ['classifier.dense.bias', 'classifier.dense.weight', 'classifier.out_proj.bias', 'classifier.out_proj.weight']  
You should probably TRAIN this model on a down-stream task to be able to use it for predictions and inference.
Device set to use cuda:0
✅ 로드 완료! (2.18초)
🔥 워밍업...

📊 반복 1/3

📊 반복 2/3

📊 반복 3/3
  ❌ [  8.8ms] "야 진짜 뭐하냐"
      예측: positive (50.35%) | 정답: NEGATIVE
  ❌ [ 11.6ms] "아 ㅅㅂ"
      예측: positive (51.01%) | 정답: NEGATIVE
  ❌ [ 10.0ms] "하... 진짜 못하네"
      예측: positive (51.39%) | 정답: NEGATIVE
  ❌ [  9.7ms] "야 진짜 잘하네~"
      예측: positive (51.61%) | 정답: NEGATIVE
  ❌ [ 15.2ms] "와 대단하다 진짜"
      예측: positive (52.21%) | 정답: NEGATIVE
  ✅ [  8.9ms] "사랑해"
      예측: positive (53.88%) | 정답: POSITIVE
  ✅ [ 12.4ms] "뽀뽀 쪽"
      예측: positive (53.60%) | 정답: POSITIVE
  ✅ [ 14.2ms] "잘했어!"
      예측: positive (54.42%) | 정답: POSITIVE
  ✅ [  8.7ms] "고마워"
      예측: positive (54.08%) | 정답: POSITIVE
  ✅ [  8.0ms] "최고야"
      예측: positive (54.33%) | 정답: POSITIVE

📈 결과 요약:
   정확도: 50.0% (5/10)
   평균 레이턴시: 9.5ms
   TP=0 TN=5 FP=0 FN=5
   Precision: 0.0% | Recall: 0.0% | F1: 0.0%
🧹 메모리 정리 중...

============================================================
🧪 테스트: Multilingual Sentiment
   모델: nlptown/bert-base-multilingual-uncased-sentiment
============================================================
📥 모델 로딩 중...
Device set to use cuda:0
✅ 로드 완료! (1.69초)
🔥 워밍업...

📊 반복 1/3

📊 반복 2/3

📊 반복 3/3
  ❌ [  6.3ms] "야 진짜 뭐하냐"
      예측: 3 stars (29.98%) | 정답: NEGATIVE
  ❌ [  9.1ms] "아 ㅅㅂ"
      예측: 3 stars (29.20%) | 정답: NEGATIVE
  ❌ [  9.7ms] "하... 진짜 못하네"
      예측: 1 star (39.78%) | 정답: NEGATIVE
  ❌ [ 10.2ms] "야 진짜 잘하네~"
      예측: 5 stars (35.24%) | 정답: NEGATIVE
  ❌ [ 15.7ms] "와 대단하다 진짜"
      예측: 3 stars (39.45%) | 정답: NEGATIVE
  ✅ [ 10.3ms] "사랑해"
      예측: 5 stars (67.74%) | 정답: POSITIVE
  ✅ [ 10.0ms] "뽀뽀 쪽"
      예측: 3 stars (32.38%) | 정답: POSITIVE
  ✅ [  9.2ms] "잘했어!"
      예측: 5 stars (58.35%) | 정답: POSITIVE
  ✅ [ 10.9ms] "고마워"
      예측: 3 stars (24.62%) | 정답: POSITIVE
  ✅ [  9.1ms] "최고야"
      예측: 5 stars (84.18%) | 정답: POSITIVE

📈 결과 요약:
   정확도: 50.0% (5/10)
   평균 레이턴시: 12.0ms
   TP=0 TN=5 FP=0 FN=5
   Precision: 0.0% | Recall: 0.0% | F1: 0.0%
🧹 메모리 정리 중...

============================================================
🧪 테스트: UnSmile (Smilegate)
   모델: smilegate-ai/kor_unsmile
============================================================
📥 모델 로딩 중...
Device set to use cuda:0
✅ 로드 완료! (1.56초)
🔥 워밍업...

📊 반복 1/3

📊 반복 2/3

📊 반복 3/3
  ❌ [  5.9ms] "야 진짜 뭐하냐"
      예측: clean (62.29%) | 정답: NEGATIVE
  ❌ [  8.2ms] "아 ㅅㅂ"
      예측: 악플/욕설 (90.78%) | 정답: NEGATIVE
  ❌ [  8.1ms] "하... 진짜 못하네"
      예측: 악플/욕설 (66.51%) | 정답: NEGATIVE
  ❌ [  6.5ms] "야 진짜 잘하네~"
      예측: clean (91.91%) | 정답: NEGATIVE
  ❌ [  8.6ms] "와 대단하다 진짜"
      예측: clean (86.64%) | 정답: NEGATIVE
  ✅ [  7.5ms] "사랑해"
      예측: clean (91.78%) | 정답: POSITIVE
  ✅ [  7.0ms] "뽀뽀 쪽"
      예측: clean (85.70%) | 정답: POSITIVE
  ✅ [  8.0ms] "잘했어!"
      예측: clean (92.73%) | 정답: POSITIVE
  ✅ [ 10.1ms] "고마워"
      예측: clean (90.38%) | 정답: POSITIVE
  ✅ [  9.3ms] "최고야"
      예측: clean (92.64%) | 정답: POSITIVE

📈 결과 요약:
   정확도: 50.0% (5/10)
   평균 레이턴시: 7.2ms
   TP=0 TN=5 FP=0 FN=5
   Precision: 0.0% | Recall: 0.0% | F1: 0.0%
🧹 메모리 정리 중...

============================================================
🧪 테스트: KcELECTRA v2 (댓글특화)
   모델: beomi/KcELECTRA-base-v2022
============================================================
📥 모델 로딩 중...
Some weights of ElectraForSequenceClassification were not initialized from the model checkpoint at beomi/KcELECTRA-base-v2022 and are newly initialized: ['classifier.dense.bias', 'classifier.dense.weight', 'classifier.out_proj.bias', 'classifier.out_proj.weight']
You should probably TRAIN this model on a down-stream task to be able to use it for predictions and inference.
Device set to use cuda:0
✅ 로드 완료! (1.99초)
🔥 워밍업...

📊 반복 1/3

📊 반복 2/3

📊 반복 3/3
  ✅ [  8.1ms] "야 진짜 뭐하냐"
      예측: LABEL_1 (50.05%) | 정답: NEGATIVE
  ✅ [  8.5ms] "아 ㅅㅂ"
      예측: LABEL_1 (50.39%) | 정답: NEGATIVE
  ✅ [  9.2ms] "하... 진짜 못하네"
      예측: LABEL_1 (50.12%) | 정답: NEGATIVE
  ✅ [ 12.1ms] "야 진짜 잘하네~"
      예측: LABEL_1 (50.41%) | 정답: NEGATIVE
  ✅ [ 10.7ms] "와 대단하다 진짜"
      예측: LABEL_1 (51.32%) | 정답: NEGATIVE
  ❌ [ 18.0ms] "사랑해"
      예측: LABEL_1 (51.18%) | 정답: POSITIVE
  ❌ [ 27.3ms] "뽀뽀 쪽"
      예측: LABEL_1 (54.23%) | 정답: POSITIVE
  ❌ [ 25.8ms] "잘했어!"
      예측: LABEL_1 (50.98%) | 정답: POSITIVE
  ✅ [ 20.2ms] "고마워"
      예측: LABEL_0 (51.18%) | 정답: POSITIVE
  ❌ [ 17.8ms] "최고야"
      예측: LABEL_1 (51.67%) | 정답: POSITIVE

📈 결과 요약:
   정확도: 60.0% (6/10)
   평균 레이턴시: 12.4ms
   TP=5 TN=1 FP=4 FN=0
   Precision: 55.6% | Recall: 100.0% | F1: 71.4%
🧹 메모리 정리 중...


========================================================================================================================
📊 전체 결과 요약
========================================================================================================================
모델명                            정확도  Precision   Recall       F1       레이턴시     로드시간     상태
------------------------------------------------------------------------------------------------------------------------
Korean Sentiment (matthewburke)    30.0%      33.3%    40.0%    36.4%     11.4ms     1.9s      ✅
KoELECTRA Small Sentiment    40.0%      42.9%    60.0%    50.0%     25.5ms     1.3s      ✅
KoELECTRA Base Sentiment     50.0%       0.0%     0.0%     0.0%      9.5ms     2.2s      ✅
Multilingual Sentiment       50.0%       0.0%     0.0%     0.0%     12.0ms     1.7s      ✅
UnSmile (Smilegate)          50.0%       0.0%     0.0%     0.0%      7.2ms     1.6s      ✅
KcELECTRA v2 (댓글특화)          60.0%      55.6%   100.0%    71.4%     12.4ms     2.0s      ✅
------------------------------------------------------------------------------------------------------------------------

📋 Confusion Matrix 상세:
모델명                           TP     TN     FP     FN
------------------------------------------------------------
Korean Sentiment (matthewburke)      2      1      4      3
KoELECTRA Small Sentiment      3      1      4      2
KoELECTRA Base Sentiment       0      5      0      5
Multilingual Sentiment         0      5      0      5
UnSmile (Smilegate)            0      5      0      5
KcELECTRA v2 (댓글특화)            5      1      4      0
------------------------------------------------------------

🏆 최고 정확도: KcELECTRA v2 (댓글특화) (60.0%)
🎯 최고 F1 Score: KcELECTRA v2 (댓글특화) (71.4%)
⚡ 최저 레이턴시: UnSmile (Smilegate) (7.2ms)

✅ 벤치마크 완료!