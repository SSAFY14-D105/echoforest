# TinyBERT 테스트

가장 경량화된 BERT 변형 모델입니다.

## 모델 정보

| 항목 | 내용 |
|------|------|
| **원본 모델** | huawei-noah/TinyBERT_General_4L_312D |
| **기반** | BERT (Knowledge Distillation) |
| **파라미터** | ~14M |
| **예상 크기** | ~55MB (원본), ~15MB (양자화) |
| **한국어** | ⚠️ 영어 기반, fine-tuning 필요 |

## 설치

```bash
pip install transformers torch
```

## 테스트 코드

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_name = "huawei-noah/TinyBERT_General_4L_312D"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)
```

## 장단점

### 장점
- 매우 가벼움 (~15MB)
- 빠른 추론 속도

### 단점
- 한국어 미지원 (기본)
- 복잡한 문맥 파악 한계

## 실험 결과

> `../results/` 폴더에 결과 기록
