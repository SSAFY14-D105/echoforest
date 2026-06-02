# Unsmile 파인튜닝 전략기획서 (2주 스프린트)

## 1. 프로젝트 목표
- **기간**: 2주 (10 작업일)
- **최종 목표**: 음성 채팅 기반 부정적 언어 탐지 모델 구축
- **범위 제한**: 2주 내 검증 가능한 MVP(Minimum Viable Product) 완성

---

## 2. 주차별 실행 계획

### **1주차: 데이터 파이프라인 구축 및 기본 데이터셋 확보**

#### **Day 1-2: 데이터 전처리 전략 확정**
- VAD(Voice Activity Detection) 기반 Chunking 도입
  - `pydub.silence` 대신 `webrtcvad` 또는 `silero-vad` 사용
  - 설정: Aggressive mode 3 (게임 환경에 적합)
  - 최대 chunk 길이: 10초 (실시간성 고려)
- 후보 라이브러리: `py-webrtcvad` (가볍고 빠름)

#### **Day 3-4: 데이터 수집 및 STT 변환**
- 유튜브 영상: 최소 **5-10개** (각 20-30분)
  - 4인 협력 게임 위주 (마리오, 오버쿡, 동물의 숲 등)
  - 총 데이터량 목표: **500-1000개 발화**
- STT 엔진: Google Speech API 또는 Whisper (medium)
  - Whisper 추천: 한국어 성능 우수, 자음 처리 자연스러움

#### **Day 5: 기존 Unsmile 데이터 전처리**
- **자음 정제 전략** (핵심 결정):
  ```
  Option A (추천): 자음을 의미 있는 토큰으로 변환
  - ㅋㅋ/ㅎㅎ → [웃음]
  - ㅇㅇ → 응응
  - ㅅㅂ → [욕설]

  장점: 의미 보존 + STT와의 간극 최소화
  단점: 변환 규칙 정의 필요 (20-30개 패턴)
  ```
- 변환 후 텍스트 길이 통계 분석 (STT 결과와 유사하게)

---

### **2주차: 모델 파인튜닝 및 평가**

#### **Day 6-7: 라벨링 및 데이터셋 구축**
- **새 라벨 추가**: `negative_morale` (팀 사기 저하)
- 라벨링 가이드라인 작성:
  ```
  negative_morale 기준:
  - 팀원 비난: "너 왜 그렇게 못해", "나만 하네"
  - 포기 발언: "이거 망했다", "아 이거 안되겠다"
  - 짜증/불만: "진짜 답답하네", "아 진짜"

  제외 기준:
  - 단순 감탄사: "아", "어"
  - 게임 상황 설명: "저기 적 있어"
  ```
- 라벨링 도구: Label Studio 또는 간단한 CSV 기반
- 목표: **최소 300개** negative_morale 샘플

#### **Day 8-9: 파인튜닝 실행**
- **모델**: Unsmile BERT 기반 (beomi/KcBERT-base)
- **전략**:
  ```python
  # Transfer Learning 전략
  1. 기존 모델 로드 (Unsmile pretrained weights)
  2. Classification Head 교체 (기존 6개 라벨 → 7개 라벨)
  3. 학습률 차등 적용:
     - BERT layers: 1e-5 (낮게, Fine-tune)
     - New head: 1e-4 (높게, 빠른 학습)
  4. Freeze 전략: 처음 6 epoch는 BERT frozen
  ```
- 데이터 비율: 기존 Unsmile (70%) + 새 데이터 (30%)
- Epoch: 10-15 (Early stopping 적용)
- Batch size: 16-32 (GPU 메모리에 따라)

#### **Day 10: 평가 및 최적화**
- **평가 지표**:
  - F1-score (Multi-label, macro)
  - Confusion Matrix (특히 negative_morale 재현율)
  - Inference 속도: < 100ms per sentence (목표)
- **경량화** (시간 여유 시):
  - ONNX 변환으로 추론 속도 2배 개선
  - Quantization (INT8)은 다음 스프린트로

---

## 3. 핵심 기술 결정 사항

### **(1) Audio Chunking: VAD 기반 접근**
**채택 이유**:
- Silence 기반(100-200ms)은 말 빠르기에 민감
- VAD는 음성의 에너지와 주파수 특성을 종합 판단
- 실시간 게임 환경과 유튜브 데이터의 괴리 감소

**구현**:
```python
import webrtcvad
vad = webrtcvad.Vad(3)  # Aggressive mode
# 30ms 단위로 음성 판단 → 연속 500ms 이상 발화를 1개 chunk로
```

### **(2) 데이터 Mismatch 해결: 하이브리드 접근**
**최종 전략**:
1. Unsmile 원본 데이터에서 자음을 **의미 토큰으로 변환**
2. STT 결과물은 **그대로 사용** (자음 없음)
3. 모델이 두 분포를 모두 학습하도록 혼합 (Data Augmentation 효과)

**장점**:
- 자음 의미 보존 + 실전 환경 대응력 향상
- 추가 데이터 수집 없이도 robust한 모델

### **(3) Multi-label 전략: Head Expansion**
```python
# 기존 모델의 classifier만 교체
model.classifier = nn.Linear(768, 7)  # 6개 → 7개 라벨
# 기존 6개 라벨 가중치는 warm start로 활용 가능
```

---

## 4. 리스크 및 완화 전략

| 리스크 | 확률 | 완화 방안 |
|--------|------|-----------|
| 라벨링 300개 미달 | 중 | 기존 Unsmile + 감정 분석 데이터셋 재활용 |
| STT 변환 시간 부족 | 중 | Whisper Batch 처리, 5개 영상만 우선 처리 |
| 모델 학습 시간 초과 | 저 | Colab Pro 또는 학교 GPU 서버 활용 |
| 실시간성 미달 (>100ms) | 중 | 비동기 처리로 1-2초 지연 허용 (게임 경험 테스트 필요) |

---

## 5. 2주 후 기대 결과물

### 최소 달성 목표 (Must Have)
- [ ] VAD 기반 데이터 전처리 파이프라인 완성
- [ ] 500개 이상 STT 변환 데이터
- [ ] Negative_morale 라벨 추가된 파인튜닝 모델 v1
- [ ] 기본 평가 결과 (F1-score, Confusion Matrix)

### 추가 목표 (Nice to Have)
- [ ] 1000개 이상 데이터 확보
- [ ] ONNX 변환 및 속도 최적화
- [ ] 실제 게임 환경 테스트 (5명 내부 플레이 테스트)

---

## 6. 다음 스프린트 준비 사항

2주 후 결과에 따라:
- **성능 우수**: 경량화(Distillation) 및 배포 파이프라인 구축
- **성능 부족**: 데이터 추가 수집 (크라우드소싱) 및 라벨 재정의
- **실시간성 이슈**: 모델 압축 또는 규칙 기반 1차 필터링 추가

---

## 부록: 기술 스택 및 참고 자료

### 필수 라이브러리
```
- webrtcvad (Audio Chunking)
- openai-whisper (STT)
- transformers (BERT Fine-tuning)
- torch (PyTorch)
- scikit-learn (Evaluation)
```

### 참고 데이터셋
- Unsmile Dataset: https://github.com/smilegate-ai/korean_unsmile_dataset
- KcBERT: https://github.com/Beomi/KcBERT

### 모델 체크포인트 저장 위치
```
./models/
├── unsmile_finetuned_v1/
├── checkpoints/
└── onnx/
```
