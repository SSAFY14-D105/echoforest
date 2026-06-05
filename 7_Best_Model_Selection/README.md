# 6. Best Model Selection

> ⚠️ 아래 수치는 **옛 `game_test`(187건) 기준**(2026-02). 통합 `test_set`(482) 재평가 대기. 배경: [`AI_파이프라인_개요.md`](../AI_파이프라인_개요.md).

## 🏆 최종 선정 모델

### Full v2 Tutorial (kcbert-base)

| 항목 | 값 |
|------|:---:|
| **모델명** | full_tutorial_kcbert_v2 |
| **베이스 모델** | beomi/kcbert-base |
| **Fine-tuning 방식** | Full Fine-tuning |
| **학습 데이터** | UnSmile 보정 (14,690건) + v1 Keywords (518건) |

---

## 📊 성능 지표

### Baseline 대비 개선

| 지표 | Baseline | **Best Model** | 개선 |
|------|:--------:|:--------------:|:----:|
| **Abuse Recall** | 0.6466 | **0.8793** | **+36.0%** |
| **Abuse F1** | 0.7772 | **0.9067** | **+16.7%** |
| **LRAP** | 0.8868 | **0.9434** | **+6.4%** |
| **Clean F1** | 0.7753 | **0.8784** | **+13.3%** |

### 전체 메트릭

| 메트릭 | 값 |
|--------|:---:|
| LRAP | 0.9434 |
| Abuse Precision | 0.9358 |
| Abuse Recall | 0.8793 |
| Abuse F1 | 0.9067 |
| Clean Precision | 0.8442 |
| Clean Recall | 0.9155 |
| Clean F1 | 0.8784 |

---

## 📁 모델 경로

```
4_2_Full_Fine_Tuning/
└── v2_corrected_plus_collected/
    └── output/
        └── full_tutorial_kcbert_v2/
            └── best_model/          ← 최종 선정 모델
                ├── config.json
                ├── model.safetensors
                ├── special_tokens_map.json
                ├── tokenizer_config.json
                └── vocab.txt
```

### 모델 로드 방법

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = "../4_2_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_tutorial_kcbert_v2/best_model"

tokenizer = AutoTokenizer.from_pretrained("beomi/kcbert-base")
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()
```

---

## 🎯 선정 이유

### 1. 최고 F1 Score (0.9067)
- 9개 모델 중 Abuse F1 최고
- Precision과 Recall의 균형이 가장 좋음

### 2. 최고 LRAP (0.9434)
- 전체 라벨 순위 정확도 최고
- 모든 카테고리에서 안정적인 성능

### 3. 동일 Recall 대비 우수한 Precision
| 모델 | Abuse Recall | Abuse Precision | Abuse F1 |
|------|:------------:|:---------------:|:--------:|
| Full v2 Tutorial | 0.8793 | **0.9358** | **0.9067** |
| LoRA v2 Game | 0.8793 | 0.8793 | 0.8793 |
| LoRA v2 Tutorial | 0.8793 | 0.8947 | 0.8870 |

> Recall이 동일한 모델 중 Precision이 가장 높아 F1 최고

---

## 🔄 다음 단계

| 단계 | 작업 | 상태 |
|------|------|:----:|
| Step 7 | INT8 양자화 (추론 최적화) | ⏳ |
| Step 8 | FastAPI 서버 배포 | ⏳ |

### 양자화 예상 효과
| 항목 | Before | After (예상) |
|------|:------:|:------------:|
| 모델 크기 | ~420MB | ~150MB |
| 추론 속도 | ~50ms | ~30ms |
| 메모리 | ~2GB | ~500MB |

---

## 📋 요약

> **Full v2 Tutorial (kcbert-base)**를 최종 운영 모델로 선정
> - Abuse Recall: **87.93%** (Baseline 대비 +36%)
> - Abuse F1: **90.67%** (9개 모델 중 최고)
> - LRAP: **94.34%** (전체 정확도 최고)
