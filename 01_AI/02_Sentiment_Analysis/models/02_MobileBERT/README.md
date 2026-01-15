# MobileBERT 테스트

모바일 환경 최적화 경량 BERT 모델입니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **원본 모델** | google/mobilebert-uncased |
| **기반** | BERT (Google) |
| **파라미터** | ~25M |
| **예상 크기** | ~95MB (원본), ~25MB (양자화) |
| **한국어** | ⚠️ 기본적으로 영어, 다국어 fine-tuning 필요 |

## 설치

```bash
pip install transformers torch
```

## 테스트 코드

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "google/mobilebert-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)
```

## 실험 결과

> `../results/` 폴더에 결과 기록
