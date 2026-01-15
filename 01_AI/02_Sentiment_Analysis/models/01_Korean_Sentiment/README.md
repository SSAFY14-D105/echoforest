# Korean Sentiment (matthewburke)

한국어 감정 분류 모델입니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `matthewburke/korean_sentiment` |
| **학습 데이터** | 한국어 감정 데이터 |
| **출력** | POSITIVE / NEGATIVE |

## 벤치마크 결과

| 지표 | 값 |
|------|-----|
| 정확도 | 30.0% |
| 레이턴시 | 9.9ms |
| 로드시간 | 2.0s |

## 사용 예시

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis", model="matthewburke/korean_sentiment")
result = classifier("사랑해")
print(result)  # [{'label': 'POSITIVE', 'score': 0.95}]
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/matthewburke/korean_sentiment)
