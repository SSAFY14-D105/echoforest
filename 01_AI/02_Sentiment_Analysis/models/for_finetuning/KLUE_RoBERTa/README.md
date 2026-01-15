# KLUE RoBERTa (Base Model)

KLUE 벤치마크 표준 한국어 RoBERTa 모델입니다. Fine-tuning용.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `klue/roberta-base` |
| **프로젝트** | KLUE (Korean Language Understanding Evaluation) |
| **학습 데이터** | 다양한 한국어 코퍼스 |
| **크기** | ~450MB |
| **상태** | ⚠️ Base 모델 (감정분류 학습 필요) |

## 특징

- **표준 모델**: 한국어 NLU 벤치마크의 표준
- **균형잡힌 학습**: 다양한 도메인 데이터
- **Small 버전 있음**: `klue/roberta-small` (더 가벼움)

## KLUE 벤치마크란?

한국어 자연어 이해 평가를 위한 표준 벤치마크.
다양한 태스크에서 모델 성능을 비교할 수 있음.

## Fine-tuning 예시

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "klue/roberta-base"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

# 이후 감정 데이터로 fine-tuning 진행
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/klue/roberta-base)
- [KLUE 공식 사이트](https://klue-benchmark.com/)
