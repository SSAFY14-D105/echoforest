# KoELECTRA Base (Sentiment)

한국어 ELECTRA 기반 감정 분류 모델입니다. Small보다 정확도 높음.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `monologg/koelectra-base-finetuned-sentiment` |
| **기반 모델** | KoELECTRA Base |
| **학습 데이터** | NSMC (네이버 영화 리뷰) |
| **출력** | positive / negative |

## 벤치마크 결과

| 지표 | 값 |
|------|-----|
| 정확도 | **50.0%** 🏆 최고 |
| 레이턴시 | 9.1ms |
| 로드시간 | 2.1s |

## 특징

- **Base 버전**: Small보다 크지만 정확도 높음
- **한국어 특화**: 한국어 데이터로 사전학습
- **최고 정확도**: 현재 벤치마크에서 가장 높은 정확도

## Small vs Base

| 버전 | 크기 | 속도 | 정확도 |
|------|------|------|--------|
| Small | 작음 | 빠름 | 40% |
| **Base** | 큼 | 보통 | **50%** |

## 사용 예시

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis", model="monologg/koelectra-base-finetuned-sentiment")
result = classifier("정말 최고의 영화였어요")
print(result)
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/monologg/koelectra-base-finetuned-sentiment)
