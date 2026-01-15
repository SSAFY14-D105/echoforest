# DistilKoBERT 테스트

한국어 특화 경량 BERT 모델입니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **원본 모델** | monologg/distilkobert |
| **기반** | KoBERT (SKT) |
| **파라미터** | ~65M |
| **예상 크기** | ~250MB (원본), ~65MB (양자화) |

## 설치

```bash
pip install transformers torch
```

## 테스트 코드

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "monologg/distilkobert"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

# 예시 추론
inputs = tokenizer("테스트 문장", return_tensors="pt")
outputs = model(**inputs)
```

## 실험 결과

> `../results/` 폴더에 결과 기록
