# 🔧 Fine-tuning용 Base 모델

감정 분류 학습에 사용할 수 있는 base 모델들입니다.
이 모델들은 **아직 감정 분류 학습이 안 된** 상태이며, 직접 fine-tuning해서 사용합니다.

## 포함된 모델

| 폴더 | 모델 | 특징 |
|------|------|------|
| DistilKoBERT | `monologg/distilkobert` | 경량 한국어 BERT |
| KcBERT | `beomi/kcbert-base` | 한국어 댓글로 학습 |
| KLUE_RoBERTa | `klue/roberta-base` | KLUE 벤치마크 표준 |

## 사용법

1. Base 모델 선택
2. 감정/혐오 데이터셋 준비
3. Fine-tuning 진행
4. 학습된 모델로 벤치마크 테스트
