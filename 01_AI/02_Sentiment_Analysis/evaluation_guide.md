# 📊 모델 평가 가이드

## 1. 평가 지표 정의

### 정확도 지표
| 지표 | 공식 | 설명 |
|------|------|------|
| **Accuracy** | (TP+TN) / Total | 전체 정확도 |
| **Precision** | TP / (TP+FP) | 부정 예측 중 실제 부정 |
| **Recall** | TP / (TP+FN) | 실제 부정 중 감지율 |
| **F1 Score** | 2×(P×R)/(P+R) | 균형 잡힌 지표 |

### 성능 지표
| 지표 | 단위 | 목표 |
|------|------|------|
| **Latency** | ms | < 100ms |
| **Memory** | MB | < 200MB |
| **Model Size** | MB | < 100MB (다운로드) |

---

## 2. 테스트 데이터셋

### 2.1 기본 테스트셋
게임 맥락의 부정/긍정 문장 수집

#### 부정적 문장 예시
```
- "야 진짜 뭐하냐"
- "아 ㅅㅂ"
- "하... 진짜 못하네"
- "야 진짜 잘하네~" (비꼼)
- "와 대단하다 대단해" (냉소)
```

#### 긍정적 문장 예시
```
- "사랑해"
- "뽀뽀 쪽"
- "잘했어!"
- "고마워"
- "최고야"
```

### 2.2 데이터셋 구성 권장
| 카테고리 | 수량 | 비고 |
|----------|------|------|
| 명시적 욕설 | 50+ | 직접적 비속어 |
| 비꼼/냉소 | 50+ | 문맥 파악 필요 |
| 긍정 표현 | 50+ | 스킬 키워드 포함 |
| 중립 | 30+ | 일상 대화 |

---

## 3. 평가 절차

### Step 1: 환경 설정
```bash
# 가상환경 활성화 (nlp 또는 ai-server)
conda activate nlp

# 필요 라이브러리 설치
pip install transformers torch onnxruntime
```

### Step 2: 모델 로드 및 추론 테스트
```python
from transformers import pipeline

# 예시: 감정 분류
classifier = pipeline("sentiment-analysis", model="모델명")
result = classifier("테스트 문장")
print(result)
```

### Step 3: 레이턴시 측정
```python
import time

start = time.time()
for text in test_dataset:
    classifier(text)
end = time.time()

avg_latency = (end - start) / len(test_dataset) * 1000  # ms
```

### Step 4: 결과 기록
`results/TEMPLATE.md` 복사 후 결과 작성

---

## 4. 결과 비교표 (예시)

| 모델 | Accuracy | F1 | Latency | Memory | 한국어 |
|------|----------|-----|---------|--------|--------|
| DistilKoBERT | 85% | 0.83 | 45ms | 68MB | ✅ |
| MobileBERT | 72% | 0.70 | 25ms | 28MB | ⚠️ |
| TinyBERT | 68% | 0.65 | 15ms | 18MB | ⚠️ |

> ⚠️ 위 수치는 예시입니다. 실제 테스트 후 업데이트 필요.

---

## 5. 브라우저 테스트 (Transformers.js)

### 설치
```bash
npm install @xenova/transformers
```

### 테스트 코드
```javascript
import { pipeline } from '@xenova/transformers';

const classifier = await pipeline(
  'sentiment-analysis', 
  'model-name',
  { device: 'webgpu' }  // WebGPU 가속
);

const result = await classifier("테스트 문장");
console.log(result);
```

### 레이턴시 측정
```javascript
const start = performance.now();
await classifier("테스트 문장");
const latency = performance.now() - start;
console.log(`Latency: ${latency.toFixed(2)}ms`);
```
