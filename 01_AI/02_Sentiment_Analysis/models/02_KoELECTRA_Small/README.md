# KoELECTRA Small (Sentiment)

한국어 ELECTRA 기반 경량 감정 분류 모델입니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `monologg/koelectra-small-finetuned-sentiment` |
| **기반 모델** | KoELECTRA Small |
| **학습 데이터** | NSMC (네이버 영화 리뷰) |
| **출력** | positive / negative |

## 벤치마크 결과

| 지표 | 값 |
|------|-----|
| 정확도 | 40.0% |
| 레이턴시 | 9.1ms |
| 로드시간 | 1.5s |

## 특징

- **Small 버전**: Base보다 가볍고 빠름
- **한국어 특화**: 한국어 데이터로 사전학습
- **NSMC 학습**: 영화 리뷰 감정 분류에 최적화

## 사용 예시

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis", model="monologg/koelectra-small-finetuned-sentiment")
result = classifier("이 영화 정말 재밌어요!")
print(result)  # [{'label': 'positive', 'score': 0.98}]
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/monologg/koelectra-small-finetuned-sentiment)
