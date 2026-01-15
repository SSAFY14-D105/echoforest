# XLM-RoBERTa (Twitter Sentiment)

트위터 데이터로 학습된 다국어 감정 분류 모델입니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `cardiffnlp/twitter-xlm-roberta-base-sentiment` |
| **기반 모델** | XLM-RoBERTa Base |
| **학습 데이터** | 다국어 트위터 데이터 |
| **출력** | positive / neutral / negative |

## 벤치마크 결과

| 지표 | 값 |
|------|-----|
| 정확도 | ❌ 에러 발생 |
| 레이턴시 | - |
| 로드시간 | - |

> ⚠️ 현재 transformers 버전 호환성 문제로 에러 발생

## 특징

- **다국어 지원**: 100+ 언어 지원
- **트위터 학습**: SNS 짧은 텍스트에 강함
- **3-class 분류**: 중립(neutral) 포함

## 사용 예시

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis", model="cardiffnlp/twitter-xlm-roberta-base-sentiment")
result = classifier("I love this!")
print(result)
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/cardiffnlp/twitter-xlm-roberta-base-sentiment)
