# KcBERT (Base Model)

한국어 댓글 데이터로 학습된 BERT 모델입니다. Fine-tuning용.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **Hugging Face** | `beomi/kcbert-base` |
| **개발자** | beomi (이준범) |
| **학습 데이터** | 네이버 뉴스 댓글 ~9천만개 |
| **크기** | ~400MB |
| **상태** | ⚠️ Base 모델 (감정분류 학습 필요) |

## 특징

- **댓글 특화**: 온라인 댓글로 학습 → 비속어, 신조어에 강함
- **게임 적합**: 게임 채팅과 유사한 데이터
- **Large 버전 있음**: `beomi/kcbert-large` (더 정확)

## 왜 게임에 적합한가?

1. 짧은 텍스트에 최적화
2. 비속어, 신조어 많이 학습
3. 온라인 커뮤니케이션 패턴 이해

## Fine-tuning 예시

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "beomi/kcbert-base"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

# 이후 욕설/혐오 데이터로 fine-tuning 진행
```

## 링크

- [Hugging Face 페이지](https://huggingface.co/beomi/kcbert-base)
- [GitHub](https://github.com/Beomi/KcBERT)
