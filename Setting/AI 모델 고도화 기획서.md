# 🎮 EchoForest AI 모델 고도화 기획서 (v2)

## 📌 프로젝트 개요

### 목표
게임 음성 채팅에서 **부정적 발언(욕설, 비난, 분노 표현)**을 더 정확하게 탐지하기 위해 기존 Smilegate unSmile 모델을 **게임 도메인에 맞게 Fine-tuning**

### 현재 문제점
- unSmile 모델은 일반 댓글 데이터로 학습됨
- 게임 특유 표현 인식 부족: "빡치다", "빡대가리", "열받다" 등
- 게임 상황 오탐: "죽어 죽어"(몬스터에게), "피해 피해" 등을 욕설로 오인
- **Baseline 악플/욕설 Recall: 0.42** (심각한 개선 필요!)

### 핵심 전략
```
┌─────────────────────────────────────────────────────────────────┐
│                    EchoForest AI 고도화 파이프라인               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: 데이터 수집 및 라벨링                                   │
│          - 게임 STT 데이터 500건 수집                            │
│          - Keywords 정리 (자주 쓰는 말 + GPT 보강)               │
│          - Clean/Negative 라벨링                                 │
│                    │                                             │
│                    ▼                                             │
│  Step 2: Baseline 테스트 (현재 모델 성능 파악)                   │
│          - 기존 unSmile 모델에 518개 Keywords 테스트             │
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
│  (어댑터만 학습)           (보정된 unSmile + 518건)              │
│  │                                   │                          │
│  └─────────────────┬─────────────────┘                          │
│                    │                                             │
│                    ▼                                             │
│  Step 5: 성능 비교 분석 (LoRA vs Full FT)                        │
│          (F1, Recall, 학습시간, 과적합 여부)                     │
│                    │                                             │
│                    ▼                                             │
│  Step 6: 더 좋은 모델 선택                                       │
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

## 📅 세부 실행 일정 (손다현)

| 단계 | 작업 | 상세 내용 | 예상 시간 | 도구 | 상태 |
|------|------|-----------|-----------|------|------|
| **1** | Keywords + STT 수집 | 자주 쓰는 말 정리 + GPT 보강, 518건 확보 | 2시간 | GPT | ✅ |
| **2** | Baseline 테스트 | 기존 unSmile에 키워드 테스트, 인식 실패 목록화 | 1시간 | Python | ✅ |
| **3** | unSmile 데이터 보정 | 인식률 저하 표현 재라벨링 + 개인지칭 제거 | 1시간 | Python | ✅ |
| **4-1** | LoRA Fine-tuning | 518건 데이터셋으로 LoRA FT | 20-30분 | Colab GPU | ⏳ |
| **4-2** | Full Fine-tuning | 보정된 unSmile + 518건으로 Full FT | 30-40분 | Colab GPU | ⏳ |
| **5** | 모델 비교 | LoRA vs Full FT 성능 비교 | 10분 | Colab | ⏳ |
| **6** | 최적 모델 선택 | 최적 모델 선택 및 저장 | 5분 | Colab | ⏳ |
| **7** | 양자화 | INT8 Dynamic Quantization | 10분 | Colab | ⏳ |
| **8** | 이식 | FastAPI 서버에 배포 | 30분 | EC2 | ⏳ |

**총 예상 소요 시간: 약 6-8시간**

---

## Step 0: Baseline 테스트 🆕

### 0.1 Keywords 준비

게임에서 자주 사용하는 표현들을 정리하고 GPT로 보강

```python
# 게임 도메인 키워드 예시
game_keywords = {
    "욕설/분노": [
        "빡치다", "빡친다", "열받다", "열받아", "짜증나", "빡대가리",
        "씨발", "시발", "병신", "개같다", "미친", "지랄"
    ],
    "게임_컨텍스트_clean": [
        "죽어 죽어", "피해 피해", "탱커 먼저", "힐 줘", "울궁 쳐",
        "한타 가자", "딜 넣어", "백스탭 해"
    ],
    "칭찬/격려": [
        "잘한다", "나이스", "캐리하네", "오져", "미쳤다"
    ]
}
```

### 0.2 기존 unSmile 모델 테스트

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

model_name = "smilegate-ai/kor_unsmile"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

def test_keywords(keywords_dict):
    results = []
    for category, expressions in keywords_dict.items():
        for expr in expressions:
            inputs = tokenizer(expr, return_tensors="pt")
            with torch.no_grad():
                outputs = model(**inputs)
                probs = torch.sigmoid(outputs.logits[0])
            
            results.append({
                "표현": expr,
                "기대_카테고리": category,
                "악플/욕설_확률": float(probs[8]),
                "clean_확률": float(probs[9]),
                "인식_결과": "욕설" if probs[8] > 0.5 else "clean"
            })
    return pd.DataFrame(results)

# 결과 시각화
df_results = test_keywords(game_keywords)
failed = df_results[df_results['기대_카테고리'].str.contains('욕설') & (df_results['인식_결과'] == 'clean')]
print(f"❌ 인식 실패 표현: {len(failed)}건")
print(failed)
```

### 0.3 인식률 시각화

```python
import matplotlib.pyplot as plt
import seaborn as sns

# 카테고리별 인식 정확도 시각화
plt.figure(figsize=(10, 6))
accuracy_by_category = df_results.groupby('기대_카테고리').apply(
    lambda x: (x['기대_카테고리'].str.contains('clean') == (x['인식_결과'] == 'clean')).mean()
)
sns.barplot(x=accuracy_by_category.index, y=accuracy_by_category.values)
plt.title('카테고리별 unSmile 인식 정확도')
plt.ylabel('정확도')
plt.savefig('baseline_accuracy.png')
```

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
| # | 카테고리 | 설명 | Baseline F1 |
|---|----------|------|-------------|
| 0 | 여성/가족 | 여성 차별, 페미니즘 혐오 | 0.76 |
| 1 | 남성 | 남성 비하, 조롱 | 0.85 |
| 2 | 성소수자 | LGBTQ+ 혐오 | 0.83 |
| 3 | 인종/국적 | 특정 인종/국가 비하 | 0.82 |
| 4 | 연령 | 세대 비하 (급식충, 틀딱) | 0.83 |
| 5 | 지역 | 특정 지역 비하 | 0.88 |
| 6 | 종교 | 종교 비하 | 0.87 |
| 7 | 기타 혐오 | 장애인, 정부 등 | 0.30 |
| 8 | **악플/욕설** | 비하/욕설 🎯 **핵심!** | **0.67** |
| 9 | clean | 정상 문장 | 0.77 |

---

## Step 1: 게임 STT 데이터 500건 수집

### 1.1 데이터 수집 전략

| 항목 | 내용 |
|------|------|
| **출처** | 유튜브 협동 게임 영상 STT |
| **목표 수량** | 500건 |
| **분할 비율** | Train 70% (350) / Valid 15% (75) / Test 15% (75) |

### 1.2 라벨링 가이드라인

| 카테고리 | 게임 상황 예시 | 라벨 |
|----------|---------------|------|
| 악플/욕설 | "빡치네", "씨발", "열받아", "빡대가리" | `[0,0,0,0,0,0,0,0,1,0]` |
| clean | "피해 피해", "죽어 죽어(몬스터)", "잘한다" | `[0,0,0,0,0,0,0,0,0,1]` |

### 1.3 CSV 파일 형식
```csv
문장,labels,split
"야 진짜 빡치네","[0,0,0,0,0,0,0,0,1,0]",train
"피해 피해","[0,0,0,0,0,0,0,0,0,1]",train
```

---

## Step 2: unSmile 데이터셋 보정 🆕

### 2.1 보정 대상 식별

Step 0에서 발견된 인식률 저하 표현들을 unSmile 원본 데이터에서 찾아 수정

```python
import pandas as pd

# unSmile 데이터 로드
unsmile_train = pd.read_csv('unsmile_train.csv')

# 잘못 라벨링된 표현 목록 (Step 0에서 발견)
fix_list = {
    "빡친다": {"from": "clean", "to": "악플/욕설"},
    "빡치네": {"from": "clean", "to": "악플/욕설"},
    "열받아": {"from": "clean", "to": "악플/욕설"},
    # ... 추가 표현들
}

# 라벨 수정
def fix_labels(row):
    for expr, fix in fix_list.items():
        if expr in row['문장']:
            # labels[8] = 1 (악플/욕설)
            labels = eval(row['labels'])
            labels[8] = 1
            labels[9] = 0  # clean 해제
            row['labels'] = str(labels)
    return row

unsmile_train_fixed = unsmile_train.apply(fix_labels, axis=1)
unsmile_train_fixed.to_csv('unsmile_train_fixed.csv', index=False)
```

---

## Step 3-1: LoRA Fine-tuning

### 3.1 LoRA 설정

```python
from peft import LoraConfig, get_peft_model, TaskType

lora_config = LoraConfig(
    task_type=TaskType.SEQ_CLS,
    r=16,
    lora_alpha=32,
    lora_dropout=0.1,
    target_modules=["query", "value"],
    bias="none",
)

model_lora = get_peft_model(base_model, lora_config)
model_lora.print_trainable_parameters()
# → trainable params: ~0.5% of total
```

### 3.2 학습 설정

```python
training_args_lora = TrainingArguments(
    output_dir="./lora_finetuned",
    num_train_epochs=5,
    learning_rate=1e-4,
    per_device_train_batch_size=16,
    metric_for_best_model="abuse_recall",
    load_best_model_at_end=True,
)
```

---

## Step 3-2: Full Fine-tuning

### 3.3 Full Fine-tuning 학습 설정

```python
from transformers import BertForSequenceClassification, TrainingArguments

model_full = BertForSequenceClassification.from_pretrained(
    "smilegate-ai/kor_unsmile",
    num_labels=10,
    problem_type="multi_label_classification"
)

training_args_full = TrainingArguments(
    output_dir="./full_finetuned",
    num_train_epochs=3,
    learning_rate=2e-5,
    per_device_train_batch_size=16,
    weight_decay=0.01,
    metric_for_best_model="abuse_recall",
    load_best_model_at_end=True,
)
```

---

## Step 4: 성능 비교 분석

### 4.1 평가 지표

| 지표 | 설명 | 중요도 |
|------|------|--------|
| **Abuse Recall** | 실제 욕설 중 탐지한 비율 🎯 | ⭐⭐⭐⭐⭐ |
| **F1 Score** | Precision과 Recall의 조화평균 | ⭐⭐⭐ |
| **학습 시간** | 모델 학습에 걸린 시간 | ⭐⭐ |

### 4.2 비교 기준

| 비교 항목 | LoRA | Full FT | 선택 기준 |
|-----------|------|---------|-----------| 
| Abuse Recall | ? | ? | **높은 쪽** |
| F1 Score | ? | ? | 높은 쪽 |
| 학습 시간 | 빠름 | 느림 | - |
| 과적합 위험 | 낮음 | 높음 | - |

---

## Step 5: 최적 모델 선택

```python
if eval_result_full['abuse_recall'] > eval_result_lora['abuse_recall']:
    best_model = model_full
    best_model_type = "Full Fine-tuning"
else:
    best_model = model_lora
    best_model_type = "LoRA Fine-tuning"

print(f"🏆 선택된 모델: {best_model_type}")
```

---

## Step 6: INT8 양자화

```python
import torch

# Dynamic Quantization (CPU용)
quantized_model = torch.quantization.quantize_dynamic(
    final_model,
    {torch.nn.Linear},
    dtype=torch.qint8
)

# 저장
torch.save(quantized_model.state_dict(), "./quantized_model/model_int8.pt")
tokenizer.save_pretrained("./quantized_model")
```

---

## Step 7: AI 서버 이식

FastAPI 서버 (`S14P11D105` AI 서버)에 최종 모델 배포

```python
from fastapi import FastAPI
from transformers import AutoTokenizer, BertForSequenceClassification
import torch

app = FastAPI()

MODEL_PATH = "./quantized_model"
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = BertForSequenceClassification.from_pretrained(MODEL_PATH)
model.load_state_dict(torch.load(f"{MODEL_PATH}/model_int8.pt"))
model.eval()

@app.post("/analyze")
async def analyze_text(text: str):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.sigmoid(outputs.logits[0])
    
    is_negative = any(probs[i] > 0.5 for i in range(9))
    
    return {
        "text": text,
        "is_negative": is_negative,
        "abuse_score": float(probs[8]),
    }
```

---

## 📁 산출물

| 파일 | 설명 |
|------|------|
| `game_keywords.txt` | 테스트용 게임 키워드 목록 |
| `baseline_accuracy.png` | Baseline 인식률 시각화 |
| `game_stt_data.csv` | 라벨링된 게임 STT 데이터 500건 |
| `unsmile_train_fixed.csv` | 보정된 unSmile 데이터셋 |
| `EchoForest_AI_Training.ipynb` | Colab 학습 노트북 |
| `./quantized_model/` | 최종 양자화 모델 |
| `comparison.png` | 성능 비교 차트 (LoRA vs Full FT) |
| `main.py` | FastAPI 서버 코드 |

---

## ✅ 성공 기준

| 지표 | Baseline | 목표 |
|------|----------|------|
| 악플/욕설 Recall | 0.59 | **≥ 0.75** |
| 전체 F1 Score | 0.77 | **≥ 0.80** |
| 모델 크기 | ~420MB | **≤ 150MB** |
| 추론 속도 | ~50ms | **≤ 30ms** |
