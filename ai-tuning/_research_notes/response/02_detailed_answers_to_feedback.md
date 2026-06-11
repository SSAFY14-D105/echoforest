# 📋 피드백에 대한 상세 답변: 실전 중심의 현실적 접근

## 1. 데이터 전처리 - 의미 단위 분할 문제 해결

### 문제 인식
맞습니다. VAD만으로는 "내가 생각하기에는... (쉼) 너무 이상하다" 같은 경우 문장이 두 개로 잘립니다. 이는 학습 데이터 품질 저하로 이어집니다.

### 현실적 해결 방안: 하이브리드 접근

#### **Option 1: STT 먼저 + 후처리 (추천)**
```
1. VAD로 긴 오디오를 일단 청크로 분할 (너그럽게 설정)
2. 각 청크를 STT로 변환
3. STT 결과 텍스트를 "의미 단위"로 재분할
```

**구체적 구현**:
```python
# Step 1: VAD로 1차 분할 (긴 청크 허용)
webrtcvad.Vad(2)  # 덜 공격적으로 설정
min_speech_duration = 1.0  # 최소 1초 이상만 유효 발화로

# Step 2: STT 변환 (Web Speech API 또는 Whisper)
transcription = stt_api(audio_chunk)

# Step 3: 텍스트 기반 문장 분리 (kss 라이브러리 활용)
from kss import split_sentences
sentences = split_sentences(transcription)

# 결과: "내가 생각하기에는 너무 이상하다" → 1개 문장으로 유지됨
```

**장점**:
- 음성의 의미적 종결을 STT가 자연스럽게 감지
- kss(Korean Sentence Splitter)는 한국어 종결어미 패턴을 이해
- 학습 데이터 품질 향상

**단점**:
- STT 비용/시간 증가 (긴 청크를 먼저 변환)
- 하지만 2주 프로젝트에서 5-10개 영상은 충분히 처리 가능

---

#### **Option 2: 불완전 문장도 학습 데이터로 활용**
사실 현업에서는 "불완전한 문장"도 의도적으로 학습시키는 경우가 많습니다.

**이유**:
- 실제 게임 환경에서도 중간에 끊기는 발화가 많음
- "내가 생각하기에는..." 만으로도 부정/긍정 판단은 어느 정도 가능
- 모델이 **문맥 불완전성에 robust**해짐

**전략**:
```python
# VAD로 자른 후 최소 길이 필터링
if len(text.split()) >= 3:  # 최소 3단어 이상만 사용
    training_data.append(text)
```

**적용 시나리오**:
- 2주 프로젝트에서는 Option 1 (STT 먼저)로 시작
- 데이터가 부족하면 Option 2로 보완 (짧은 청크도 활용)

---

### 의미 단위 분할의 "정답"
결론적으로 **완벽한 의미 단위 분할은 불가능**합니다. 현업 팁:
1. **80% 정확도로 타협**: 100% 완벽한 데이터보다 양이 중요
2. **STT + 문장 분리기 조합**: kss, kiwipiepy 등 활용
3. **불완전 데이터도 활용**: 최소 길이만 만족하면 포함

---

## 2. Web Speech API 환경과 Python 도구의 괴리 해결

### (1) Web Speech API vs Python Libraries

#### 현실 체크
- **Web Speech API**: 브라우저에서 실시간 스트리밍, 자동 VAD 내장
- **webrtcvad/silero-vad**: Python 전처리용, 브라우저에서 직접 사용 불가

#### 해결 전략: 환경 일치성 확보

**전략 A: Web Speech API로 통일 (추천)**
```
학습 데이터 수집: 유튜브 영상 → Web Speech API로 STT
실제 서비스: 게임 음성 → Web Speech API로 STT

→ 100% 동일한 파이프라인으로 데이터 일관성 확보
```

**구현**:
```javascript
// 브라우저에서 유튜브 영상 재생 후 STT 수집
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = false;
recognition.lang = 'ko-KR';

// 유튜브 오디오를 Web Audio API로 캡처 → STT
```

**장점**:
- 학습 데이터 = 실전 데이터 (Distribution Shift 최소화)
- 추가 서버/GPU 불필요

**단점**:
- Web Speech API 정확도가 Whisper보다 낮음
- 하지만 일관성이 더 중요 (약간 부정확해도 학습/추론 환경이 동일하면 OK)

---

**전략 B: 데이터 증강으로 간극 메우기**
Python으로 전처리한 데이터에 "Web Speech API 스타일" 노이즈 추가:
```python
# Whisper 결과물에 Web Speech API 특성 반영
def add_webspeech_artifacts(text):
    # 1. 일부 조사 생략 (Web Speech 특성)
    text = text.replace("이것은", "이건")

    # 2. 숫자를 한글로 (Web Speech는 "1" → "일"로 변환)
    text = re.sub(r'\d+', lambda x: num2words(x.group(), lang='ko'), text)

    # 3. 랜덤 단어 생략 (5% 확률로 인식 실패 시뮬레이션)
    words = text.split()
    if random.random() < 0.05:
        words.pop(random.randint(0, len(words)-1))

    return ' '.join(words)
```

---

### (2) 브라우저 렉(Lag) 원인 및 대책

#### 렉 발생 원인 분석
```
1. WebRTC 스트림 디코딩: 4명 화상 = 4개 동시 비디오/오디오 스트림
2. 게임 렌더링: 마리오 스타일 → Canvas/WebGL 연산
3. Web Speech API: 실시간 오디오 분석 추가 부하
```

#### 구체적 원인
- **CPU 병목**: 브라우저는 단일 스레드라 모든 작업이 경합
- **메모리 누수**: LiveKit 스트림이 제대로 정리 안 되면 메모리 증가
- **GC(Garbage Collection)**: 주기적 프레임 드랍 유발

#### 최적화 방안

**즉시 적용 가능**:
```javascript
// 1. 화상 품질 낮추기 (LiveKit 설정)
const roomOptions = {
  videoCaptureDefaults: {
    resolution: VideoPresets.h540.resolution  // 720p → 540p
  },
  publishDefaults: {
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360]  // 저화질 레이어만
  }
};

// 2. Web Speech API 샘플링 빈도 조절
recognition.maxAlternatives = 1;  // 대안 후보 줄이기
recognition.interimResults = false;  // 중간 결과 끄기

// 3. 게임 프레임레이트 제한
requestAnimationFrame() → setInterval(30fps)  // 60fps → 30fps
```

**아키텍처 개선** (2주 후):
- STT 처리를 Web Worker로 분리 (메인 스레드 해방)
- 게임 렌더링을 OffscreenCanvas로 분리

---

#### Whisper 포기하고 Web Speech API 고수 (결론)
**동의합니다.** 2주 프로젝트에서는:
- Web Speech API로 학습 데이터 수집 (일관성 우선)
- 정확도는 파인튜닝으로 보완
- GPU 서버 없이도 진행 가능

---

## 3. 자음 처리 고도화 전략

### 단순 토큰화 vs 의미 복원 비교

#### **Option A: 토큰화 ([웃음], [비꼼])**
```python
replacements = {
    'ㅋㅋ': '[웃음]',
    'ㅎㅎ': '[웃음]',
    'ㅉㅉ': '[비꼼]',
    'ㅅㅂ': '[욕설]'
}
```
**장점**: 구현 간단, 일관성 유지
**단점**: 모델이 특수 토큰을 학습해야 함 (BERT vocab 확장 필요)

---

#### **Option B: 의미 단어로 복원 (추천)**
```python
context_aware_replacements = {
    # 긍정 문맥
    ('ㅋㅋ', 'positive'): '하하',
    ('ㅋㅋㅋ', 'positive'): '재밌네',

    # 부정 문맥
    ('ㅋㅋ', 'negative'): '웃기네',  # 비꼬기
    ('ㅉㅉ', 'any'): '한심하네',
    ('ㅅㅂ', 'any'): '짜증나'
}
```

**구현 예시**:
```python
def restore_consonants(text):
    # 간단한 규칙 기반
    if 'ㅋㅋ' in text:
        # 주변 단어로 긍정/부정 판단
        if any(word in text for word in ['못', '안', '왜']):
            text = text.replace('ㅋㅋ', '웃기네')
        else:
            text = text.replace('ㅋㅋ', '하하')

    if 'ㅉㅉ' in text:
        text = text.replace('ㅉㅉ', '한심하다')

    return text
```

**성능 영향**:
- **토큰화**: 모델이 새 vocab 학습 필요 (학습 시간 +10%)
- **의미 복원**: 기존 vocab 활용 (즉시 학습 가능)

**결론**: **의미 단어 복원이 유리** (단, 규칙 정의에 1-2일 필요)

---

### 현실적 타협안: 하이브리드
```python
# 명확한 것만 복원, 애매한 건 삭제
simple_rules = {
    'ㅋㅋㅋ+': '하하',  # 여러 개는 긍정 웃음으로
    'ㅉㅉ': '쯧쯧',
    'ㅅㅂ': '',  # 욕설 자음은 삭제 (라벨로 대체)
    'ㅇㅇ': '응응'
}
```

---

## 4. 모델 선정 및 학습 전략 (핵심 결정)

### (1) KcELECTRA vs BERT (Unsmile 공식)

#### 전략적 선택 가이드

**시나리오 A: 공식 Unsmile BERT 파인튜닝 (안전)**
```
Base: smilegate-ai/kor_unsmile (BERT)
장점:
- 이미 욕설/혐오 탐지 학습 완료
- Warm start로 빠른 수렴
- "팀 사기 저하" 라벨만 추가하면 됨

단점:
- BERT는 구어체에 약함
- KcELECTRA보다 성능 낮을 수 있음

적합한 경우: 2주 안에 안전하게 결과 내야 할 때
```

---

**시나리오 B: KcELECTRA 처음부터 파인튜닝 (도전)**
```
Base: beomi/KcELECTRA-base-v2022
데이터: Unsmile 전체 + 새 데이터

장점:
- 구어체(댓글) 특화 → 게임 채팅과 잘 맞음
- 높은 최종 성능 기대

단점:
- 처음부터 학습 = 시간 많이 소요 (Epoch 20-30)
- 데이터 부족 시 underfitting 위험

적합한 경우: 성능이 최우선이고 시간 여유 있을 때
```

---

#### **추천: 단계적 접근 (2주 프로젝트 최적)**

**Week 1**:
```python
# 빠른 검증용 - Unsmile BERT 활용
model = AutoModelForSequenceClassification.from_pretrained(
    "smilegate-ai/kor_unsmile"
)
# negative_morale 라벨만 추가
model.classifier = nn.Linear(768, 7)  # 6→7개 라벨
```

**Week 2**:
```python
# 성능 개선용 - KcELECTRA로 재학습 (시간 되면)
model = AutoModelForSequenceClassification.from_pretrained(
    "beomi/KcELECTRA-base-v2022"
)
# Unsmile 데이터 전체로 처음부터 학습
```

**이점**:
- Week 1에 작동하는 모델 확보 (리스크 최소화)
- Week 2에 성능 향상 도전 (안 되면 Week 1 결과 사용)

---

### (2) KcELECTRA 기반 Unsmile 공개 모델 존재 여부

**조사 결과**: 현재 **없습니다.**
- Hugging Face에서 검색 결과 공식 Unsmile은 BERT만
- 대안: 직접 KcELECTRA + Unsmile 조합으로 사전학습 필요

**현실적 대안**:
```python
# KcELECTRA + Unsmile 빠른 사전학습 (Day 6-7)
base = "beomi/KcELECTRA-base-v2022"
dataset = load_dataset("smilegate-ai/kor_unsmile")

# 3-5 Epoch만 빠르게 (2-3시간)
trainer = Trainer(
    model=model,
    args=TrainingArguments(
        num_train_epochs=5,
        per_device_train_batch_size=32,
        learning_rate=5e-5
    )
)
trainer.train()

# 결과물을 "우리만의 KcELECTRA-Unsmile" 베이스로 활용
```

---

### (3) Head 교체 및 Catastrophic Forgetting 방지

#### 소량 데이터 학습 전략 (300개 수준)

**학습률 설정**:
```python
from transformers import TrainingArguments

# 차등 학습률 (Discriminative Fine-tuning)
optimizer_grouped_parameters = [
    # BERT layers: 매우 낮게 (기존 지식 보존)
    {
        "params": model.bert.parameters(),
        "lr": 1e-6  # 기존보다 100배 낮음
    },
    # New classifier head: 높게 (빠른 학습)
    {
        "params": model.classifier.parameters(),
        "lr": 1e-3  # 새 라벨 집중 학습
    }
]
```

**Freeze 전략**:
```python
# 처음 5 epoch는 BERT 동결
for epoch in range(5):
    for param in model.bert.parameters():
        param.requires_grad = False
    train(model)

# 이후 전체 미세조정
for param in model.bert.parameters():
    param.requires_grad = True
for epoch in range(5, 10):
    train(model)
```

---

#### Catastrophic Forgetting 방지 팁

**방법 1: 기존 데이터 혼합 (추천)**
```python
# 새 라벨 데이터 300개 + 기존 Unsmile 데이터 700개
train_dataset = {
    'negative_morale': 300,  # 새 데이터
    'unsmile_original': 700  # 기존 라벨 유지용
}

# 비율: 30:70으로 기존 지식 보존
```

**방법 2: Regularization 강화**
```python
TrainingArguments(
    weight_decay=0.01,  # L2 정규화
    warmup_steps=100,   # Warm-up으로 급격한 변화 방지
    gradient_accumulation_steps=4  # 작은 배치 효과 완화
)
```

**방법 3: Validation으로 모니터링**
```python
# 기존 라벨 성능 추적
def compute_metrics(pred):
    # negative_morale F1 + 기존 라벨 F1 동시 확인
    return {
        'new_label_f1': f1_new,
        'old_labels_f1': f1_old  # 떨어지면 Early Stop
    }
```

---

## 5. 최종 권장 전략 (2주 통합 플랜)

### **Week 1**: 기반 구축
1. **Day 1-2**: Web Speech API로 유튜브 STT 수집
2. **Day 3**: kss로 문장 분리 + 자음 의미 복원 (20개 규칙)
3. **Day 4-5**: 라벨링 (negative_morale 300개 목표)

### **Week 2**: 모델 학습
1. **Day 6-7**: Unsmile BERT + Head 추가 (안전판)
2. **Day 8**: 평가 및 검증
3. **Day 9-10**: (여유 되면) KcELECTRA 재학습 도전

### 핵심 결정
- **데이터 일관성**: Web Speech API 통일
- **자음 처리**: 의미 단어 복원 (20개 규칙)
- **모델**: Unsmile BERT 먼저 → 시간 되면 KcELECTRA
- **학습**: Freeze 5 epoch → Full fine-tune 5 epoch
- **Forgetting 방지**: 기존 데이터 70% 혼합

---

## 부록: 빠른 의사결정 체크리스트

| 질문 | 추천 답변 | 근거 |
|------|----------|------|
| VAD vs STT 먼저? | **STT 먼저** | 의미 단위 분할 정확도 우선 |
| Whisper vs Web Speech? | **Web Speech** | 일관성 > 정확도 |
| 자음 토큰화 vs 복원? | **의미 복원** | 기존 vocab 활용 가능 |
| BERT vs KcELECTRA? | **BERT 먼저** | 2주 안전성 확보 |
| 데이터 몇 개? | **300개 신규 + 700개 기존** | Forgetting 방지 |
| 학습률? | **BERT 1e-6, Head 1e-3** | 차등 학습 |

---

이 답변이 실무적 의사결정에 도움이 되었기를 바랍니다. 추가 질문이 있다면 언제든 알려주세요!
