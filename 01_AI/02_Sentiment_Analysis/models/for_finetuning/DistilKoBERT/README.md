# DistilKoBERT (Base Model)

한국어 경량 BERT 모델입니다. Fine-tuning용.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `monologg/distilkobert` |
| **기반** | KoBERT (SKT) |
| **파라미터** | ~65M |
| **크기** | ~250MB (원본), ~65MB (양자화) |
| **상태** | ⚠️ Base 모델 (감정분류 학습 필요) |

## 특징

- **경량화**: KoBERT를 distillation으로 경량화
- **한국어 특화**: 한국어 코퍼스로 사전학습
- **빠른 추론**: 작은 크기로 빠른 속도

## Fine-tuning 예시

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "monologg/distilkobert"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

# 이후 학습 데이터로 fine-tuning 진행
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/monologg/distilkobert)
