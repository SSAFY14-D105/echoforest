# Multilingual Sentiment (별점 예측)

다국어 별점 예측 모델입니다. 1-5 별점으로 분류합니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `nlptown/bert-base-multilingual-uncased-sentiment` |
| **기반 모델** | mBERT (Multilingual BERT) |
| **학습 데이터** | 다국어 리뷰 데이터 |
| **출력** | 1 star ~ 5 stars |

## 벤치마크 결과

| 지표 | 값 |
|------|-----|
| 정확도 | 50.0% |
| 레이턴시 | 10.4ms |
| 로드시간 | 1.7s |

## 특징

- **5단계 별점**: 세분화된 감정 분류
- **다국어 지원**: 6개 언어 (영어, 독일어, 프랑스어, 스페인어, 이탈리아어, 네덜란드어)
- **리뷰 특화**: 제품/서비스 리뷰에 적합

## 출력 형식

```python
# 부정적: 1 star, 2 stars
# 중립: 3 stars
# 긍정적: 4 stars, 5 stars
```

## 사용 예시

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis", model="nlptown/bert-base-multilingual-uncased-sentiment")
result = classifier("This product is amazing!")
print(result)  # [{'label': '5 stars', 'score': 0.85}]
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/nlptown/bert-base-multilingual-uncased-sentiment)
