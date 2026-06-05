# 🎮 EchoForest AI 모델 고도화 기획서 (v2)

## 📌 프로젝트 개요

### 목표
게임 음성 채팅에서 **부정적 발언(욕설, 비난, 분노 표현)**을 더 정확하게 탐지하기 위해 기존 Smilegate unSmile 모델을 **게임 도메인에 맞게 Fine-tuning**

### 현재 문제점
- unSmile 모델은 일반 댓글 데이터로 학습됨
- 게임 특유 표현 인식 부족: "빡치다", "빡대가리", "열받다" 등
- 게임 상황 오탐: "죽어 죽어"(몬스터에게), "피해 피해" 등을 욕설로 오인
- **Baseline 악플/욕설 Recall: 0.6466** (개선 필요!)

### 핵심 전략
```
┌─────────────────────────────────────────────────────────────────┐
│                    EchoForest AI 고도화 파이프라인               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: 데이터 수집 및 라벨링                                   │
│          - 게임 STT 데이터 v1 수집 (518건) - Baseline 테스트용   │
│          - 게임 STT 데이터 v2 수집 (187건) - 최종 테스트용       │
│                    │                                             │
│                    ▼                                             │
│  Step 2: Baseline 테스트 (현재 모델 성능 파악)                   │
│          - 기존 unSmile 모델에 v1 데이터 테스트                  │
│          - 인식률 떨어지는 표현 목록화 (시각화)                  │
│          - False Negative 분석 (악플인데 놓친 표현)              │
│                    │                                             │
│                    ▼                                             │
│  Step 3: unSmile 데이터셋 보정                                   │
│          - Baseline에서 발견된 인식률 저하 표현 수정             │
│          - 예: "빡친다" clean → 악플/욕설 재라벨링               │
│          - 개인지칭 라벨 제거 (14,690건)                         │
│                    │                                             │
│                    ▼                                             │
│  ┌─────────────────┴─────────────────┐                          │
│  │                                   │                          │
│  ▼                                   ▼                          │
│  Step 4-1: LoRA            Step 4-2: Full Fine-tuning           │
│  Fine-tuning               (전체 가중치 학습)                    │
│  - v1: unSmile 보정 데이터  - v1: unSmile 보정 데이터            │
│  - v2: + 게임 STT 518건    - v2: + 게임 STT 518건               │
│  │                                   │                          │
│  └─────────────────┬─────────────────┘                          │
│                    │                                             │
│                    ▼                                             │
│  Step 5: 최종 테스트 (v2 데이터 187건)                           │
│          - 9개 모델 비교 (Baseline + 8개 Fine-tuned)             │
│                    │                                             │
│                    ▼                                             │
│  Step 6: 최적 모델 선택 → Full v2 Tutorial ✅                    │
│                    │                                             │
│                    ▼                                             │
│  Step 7: INT8 양자화 (CPU 추론 최적화)                           │
│                    │                                             │
│                    ▼                                             │
│  Step 8: AI 서버 (FastAPI)에 이식/배포                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ 프로젝트 결과 (완료)

### 🏆 최종 성과

| 지표 | Before (Baseline) | After (Best) | After (양자화) | 개선 |
|------|:-----------------:|:------------:|:-------------:|:----:|
| **Abuse Recall** | 64.66% | **87.93%** | **87.93%** | **+36.0%** |
| **Abuse F1** | 77.72% | **90.67%** | **90.67%** | **+16.7%** |
| **모델 크기** | - | 415.53 MB | **88.93 MB** | **4.67x 압축** |

### 🏆 최종 배포 모델: **Full v2 Tutorial (kcbert) - INT8 Quantized**

### 전체 모델 순위
| 순위 | 모델 | Abuse Recall | Baseline 대비 |
|:---:|------|:---:|:---:|
| **1** | Full v2 Tutorial ✅ | **0.8793** | **+36.0%** |
| **1** | LoRA v2 Game | **0.8793** | **+36.0%** |
| **1** | LoRA v2 Tutorial | **0.8793** | **+36.0%** |
| 4 | Full v2 Game | 0.8707 | +34.7% |
| 5 | LoRA v1 Game | 0.7759 | +20.0% |
| 6 | LoRA v1 Tutorial | 0.7414 | +14.7% |
| 6 | Full v1 Game | 0.7414 | +14.7% |
| 8 | Full v1 Tutorial | 0.6983 | +8.0% |
| 9 | Baseline (kor_unsmile) | 0.6466 | - |

---

## 📊 데이터 구성

### 수집 데이터 (게임 STT)
| 데이터셋 | 건수 | 파일 경로 | 용도 |
|---------|:----:|----------|------|
| **v1 (Keywords)** | 518건 | `2_Baseline_Test/keywords_unsmile_format.tsv` | Baseline 테스트 + v2 학습 |
| **v2 (Test)** | 187건 | `5_Model_Comparison/data/game_test.tsv` | **최종 모델 테스트** |

> 두 데이터셋 모두 직접 게임 STT + 유튜브 협력게임 STT에서 수집

### 학습 데이터
| 버전 | 학습 데이터 | 설명 |
|------|------------|------|
| **v1** | UnSmile 보정 (14,690건) | 라벨 오류 보정만 적용 |
| **v2** | UnSmile 보정 + v1 Keywords (518건) | 게임 도메인 데이터 추가 |

### 데이터 흐름 요약
```
┌─────────────────────────────────────────────────────────────────┐
│  v1: keywords_unsmile_format.tsv (518건)                         │
│  └→ Baseline 테스트 (기존 모델 문제점 파악)                      │
│  └→ v2 학습 데이터로 사용 (도메인 특화)                          │
├─────────────────────────────────────────────────────────────────┤
│  v2: game_test.tsv (187건) - 별도 수집                           │
│  └→ 최종 테스트용 (9개 모델 비교)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 세부 실행 일정

| 단계 | 작업 | 상세 내용 | 상태 |
|------|------|-----------|:----:|
| **1** | 데이터 수집 | v1(518건) + v2(187건) 수집 및 라벨링 | ✅ |
| **2** | Baseline 테스트 | v1 데이터로 기존 unSmile 모델 테스트 | ✅ |
| **3** | unSmile 데이터 보정 | 인식률 저하 표현 재라벨링 (14,690건) | ✅ |
| **4-1** | LoRA Fine-tuning | v1/v2 × Game/Tutorial (4개 모델) | ✅ |
| **4-2** | Full Fine-tuning | v1/v2 × Game/Tutorial (4개 모델) | ✅ |
| **5** | 최종 테스트 | v2 데이터로 9개 모델 비교 | ✅ |
| **6** | 모델 선택 | Full v2 Tutorial 선정 | ✅ |
| **7** | INT8 양자화 | 4.67x 압축, 성능 손실 0% | ✅ |
| **8** | 서버 배포 | FastAPI 서버에 배포 | ⏳ |

---

## 🔬 핵심 인사이트

### 1. 도메인 데이터가 핵심 (가장 중요한 발견)

| 비교 | v1 (일반 데이터만) | v2 (게임 데이터 추가) | 차이 |
|------|:------------------:|:--------------------:|:----:|
| 평균 Abuse Recall | 73.93% | **87.60%** | **+13.67%p** |

> **518건의 게임 데이터**만으로 **+13%p 이상** 성능 향상!

### 2. LoRA ≈ Full Fine-tuning

| 방법론 | 평균 Recall | 학습 시간 | GPU 메모리 |
|--------|:-----------:|:---------:|:---------:|
| LoRA | 83.44% | ~30분 | ~8GB |
| Full FT | 83.00% | ~2시간 | ~16GB |

> 성능 차이 미미 → **효율성 면에서 LoRA 권장**

### 3. 베이스 모델 차이 미미

| 베이스 모델 | v2 평균 Recall |
|------------|:--------------:|
| KcELECTRA (Game) | 87.50% |
| kcbert (Tutorial) | 87.93% |

> **어떤 모델을 쓰든 데이터가 더 중요**

---

## 📚 기반 지식: unSmile 데이터셋/모델

### 데이터셋 구조
| 항목 | 내용 |
|------|------|
| **출처** | Smilegate AI |
| **규모** | Train 15,005건 + Valid 3,737건 = 18,742건 |
| **모델** | BERT 기반 (BertForSequenceClassification) |
| **분류 유형** | Multi-label Classification |

### 10개 카테고리
| # | 카테고리 | 설명 | 게임 관련성 |
|---|----------|------|:-----------:|
| 8 | **악플/욕설** | 비하/욕설 🎯 **핵심!** | ⭐⭐⭐ |
| 9 | clean | 정상 문장 | ⭐⭐⭐ |
| 0-7 | 혐오 카테고리 | 여성/남성/성소수자/인종/연령/지역/종교/기타 | ⭐ |

---

## 📁 산출물

### 데이터
| 파일 | 설명 |
|------|------|
| `game_stt_v1.tsv` | 게임 STT 데이터 v1 (518건) - 학습용 |
| `game_test.tsv` | 게임 STT 데이터 v2 (187건) - 테스트용 |
| `unsmile_train_corrected.tsv` | 보정된 UnSmile 데이터 (14,690건) |

### 모델 (8개)
| 경로 | 설명 |
|------|------|
| `4_1_LoRA_Fine_Tuning/v1.../lora_game_kcelectra/merged_model` | LoRA v1 Game |
| `4_1_LoRA_Fine_Tuning/v1.../lora_tutorial_kcbert/merged_model` | LoRA v1 Tutorial |
| `4_1_LoRA_Fine_Tuning/v2.../lora_game_kcelectra_v2/merged_model` | LoRA v2 Game |
| `4_1_LoRA_Fine_Tuning/v2.../lora_tutorial_kcbert_v2/merged_model` | LoRA v2 Tutorial |
| `4_2_Full_Fine_Tuning/v1.../full_game_kcelectra/best_model` | Full v1 Game |
| `4_2_Full_Fine_Tuning/v1.../full_tutorial_kcbert/best_model` | Full v1 Tutorial |
| `4_2_Full_Fine_Tuning/v2.../full_game_kcelectra_v2/best_model` | Full v2 Game |
| `4_2_Full_Fine_Tuning/v2.../full_tutorial_kcbert_v2/best_model` | **Full v2 Tutorial ✅** |

### 분석 결과
| 파일 | 설명 |
|------|------|
| `5_Model_Comparison/results/game_test_results.csv` | 9개 모델 비교 결과 |
| `5_Model_Comparison/results/before_after_comparison.png` | Before/After 비교 차트 |
| `5_Model_Comparison/results/v1_vs_v2_comparison.png` | v1 vs v2 비교 차트 |
| `5_Model_Comparison/results/metrics_heatmap.png` | 전체 메트릭 히트맵 |

---

## ✅ 성공 기준 달성 여부

| 지표 | 목표 | 실제 결과 | 달성 |
|------|:----:|:--------:|:----:|
| 악플/욕설 Recall | ≥ 0.75 | **0.8793** | ✅ **초과 달성** |
| Abuse F1 Score | ≥ 0.80 | **0.9067** | ✅ **초과 달성** |
| LRAP | ≥ 0.90 | **0.9434** | ✅ **초과 달성** |

---

## Step 7: INT8 양자화 ✅ (완료)

### 7.1 양자화 결과: **SUCCESS**

| 항목 | Original | Quantized | 변화 |
|------|:--------:|:---------:|:----:|
| **모델 크기** | 415.53 MB | 88.93 MB | **4.67x 압축** |
| **추론 속도** | 8.55 ms | 8.47 ms | 1.01x 빠름 |
| **Abuse Recall** | 0.8793 | 0.8793 | **0% 손실** |
| **Abuse F1** | 0.9067 | 0.9067 | 0% 손실 |

> **결론**: 모델 크기 78.6% 감소, 성능 손실 없음 - 양자화 성공!

### 7.2 Confusion Matrix (동일)
| | Pred Non-Abuse | Pred Abuse |
|---|:---:|:---:|
| **Actual Non-Abuse** | 64 | 7 |
| **Actual Abuse** | 14 | 102 |

### 7.3 양자화 산출물
| 파일 | 설명 |
|------|------|
| `7_Quantization/results/quantization_dashboard.png` | 메인 대시보드 (6-panel) |
| `7_Quantization/results/confusion_matrices.png` | Confusion Matrix 비교 |
| `7_Quantization/results/quantization_results.csv` | 주요 메트릭 요약 |
| `7_Quantization/results/quantization_report.json` | JSON 리포트 |

---

## Step 8: AI 서버 배포 (예정)

### 8.1 FastAPI 서버 구성
```python
from fastapi import FastAPI
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = FastAPI()

MODEL_PATH = "./quantized_model"
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

@app.post("/analyze")
async def analyze_text(text: str):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.sigmoid(outputs.logits[0])
    
    is_negative = probs[8] > 0.5  # 악플/욕설
    
    return {
        "text": text,
        "is_negative": bool(is_negative),
        "abuse_score": float(probs[8]),
    }
```

---

## 🎯 결론

### 핵심 한 줄 요약
> **518건의 게임 데이터로 욕설 탐지율 65% → 88% (+36%), 양자화로 모델 크기 5분의 1 축소 🎉**

### 프로젝트 성공 요인
1. **도메인 특화 데이터 확보** - 직접 게임/유튜브 STT 데이터 수집
2. **체계적 실험 설계** - LoRA vs Full FT, v1 vs v2 비교
3. **Baseline 분석** - 기존 모델의 한계점 정확히 파악 후 개선
4. **INT8 양자화** - 성능 손실 없이 모델 크기 4.67배 압축

### 최종 산출물
| 항목 | 경로 |
|------|------|
| **양자화 모델** | `7_Quantization/quantized_model/` |
| **분석 결과** | `7_Quantization/results/` |

### 다음 단계
| 단계 | 작업 | 예상 시간 |
|------|------|:---------:|
| Step 8 | FastAPI 서버 배포 | 30분 |
