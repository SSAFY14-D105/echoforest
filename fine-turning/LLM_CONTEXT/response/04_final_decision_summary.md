# 🎯 Unsmile 파인튜닝 및 음성 제재 시스템 구축을 위한 확정 가이드 `[FINAL]`

본 문서는 프로젝트 진행 과정에서 논의된 모든 질문과 답변을 종합하여, **확정된 기술적 결정사항(Decision)**과 **구체적인 구현 전략(Implementation)**을 정리한 문서입니다. 이후 개발 과정에서 "기준점"으로 활용하시기 바랍니다.

---

## 1. 프로젝트 핵심 결정 사항 (Key Decisions)

### A. 목표 정의
- **목표**: 4인 협력 게임 내 **'팀 사기 저하(Negative Morale)'** 발언 및 욕설 실시간 탐지.
- **최종 라벨**: 기존 Unsmile 10개 라벨 + `negative_morale` 1개 추가 = **총 11개 Class**.

### B. 모델 선정 (Model Selection)
- **Base Model 확정**: `smilegate-ai/kor_unsmile`
    - **정체**: **KLUE RoBERTa-base** (BERT가 아님).
    - **특징**: 54GB 한국어 코퍼스로 학습된 한국어 특화 모델로, 해외 모델이 아니므로 한국어 뉘앙스 처리에 강력함.
- **전략**: `KcELECTRA`를 처음부터 학습시키는 것은 시간 비용이 크므로, **검증된 Unsmile(RoBERTa) 모델을 로드하여 Head만 교체**하는 방식 채택.

### C. 데이터 파이프라인 (Data Pipeline)
- **수집 데이터**: 유튜브 협력 게임 영상 (오버쿡, 마리오 등).
- **수집 도구**: **Python `speech_recognition` (Google API)** 사용.
    - *결정 근거*: 브라우저 `Web Speech API`와 백엔드(Google)가 동일하여 품질 차이가 미미(2-3%)하므로, 복잡한 브라우저 자동화(Puppeteer 등) 대신 효율적인 Python 배치 처리를 선택.
- **환경 일치성 확보**: Python 수집 데이터에 **"Web Speech API스러운 오류"를 인위적으로 주입**하여 학습(Data Augmentation).

---

## 2. 세부 구현 가이드 (Implementation Details)

### 1단계: 데이터 전처리 (Preprocessing)

#### (1) VAD 기반 청킹 (Chunking) & 필터링
단순 `Silence` 방식 대신 **VAD(Voice Activity Detection)**를 사용하여 음성 구간을 정밀하게 자릅니다.

*   **라이브러리**: `webrtcvad` (Mode: 3 - Aggressive)
*   **길이 필터링 기준**:
    *   **0.5초 미만**: 삭제 (감탄사, 비명 등 노이즈일 확률 높음).
    *   **15초 초과**: 삭제 (너무 길어 라벨링 모호).
    *   **예상 제거율**: 전체 데이터의 약 20% (품질을 위해 감수).

#### (2) 데이터 증강 (Augmentation) - 노이즈 주입
Web Speech API의 실시간 스트리밍 특성을 모방하기 위해 Python으로 수집된 텍스트를 일부러 훼손합니다.

*   **적용 비율**: 전체 데이터의 **30%**.
*   **증강 규칙 (패턴별 확률)**:
    1.  **문장 끝 생략 (60%)**: "진짜 왜 저래" → "진짜 왜" (가장 빈번함).
    2.  **중간 단어 생략 (30%)**: "아 진짜 답답하네" → "아 답답하네".
    3.  **문장 앞 생략 (10%)**: "야 너 뭐해" → "너 뭐해".

#### (3) 자음 포함 문장(Text Normalization)
자음이 포함된 데이터는 전부 삭제합니다. 


---

### 2단계: 모델 학습 전략 (Training Strategy)

#### (1) 데이터 불균형 해결 (Imbalance Handling)
Unsmile 원본(18,000개) vs 신규 데이터(약 1,000개)의 **18:1 비율**을 극복해야 합니다.

*   **전략**: **Hybrid 접근**
    1.  **Oversampling**: 신규 데이터를 **5배 복제** (약 5,000개로 뻥튀기).
    2.  **Weighted Random Sampler**: 배치 구성 시 적은 데이터가 더 자주 뽑히도록 설정.
    3.  **Weighted Loss**: `CrossEntropyLoss`에 클래스별 가중치 적용.

#### (2) 파인튜닝 (Fine-tuning) 설정
Catastrophic Forgetting(기존 지식 망각)을 방지하며 신규 라벨을 학습합니다.

*   **아키텍처 변경**: `num_labels=11` (Classification Head 교체).
*   **학습률(Learning Rate) 차등 적용**:
    *   **Base Model (RoBERTa)**: `1e-6` (매우 낮게 설정하여 기존 지식 보호).
    *   **New Head (Classifier)**: `1e-3` (빠르게 학습).
*   **Freeze 전략**:
    *   **Epoch 1-5**: Base Model **Freeze** (얼림) → Head만 학습.
    *   **Epoch 6-10**: 전체 **Unfreeze** → 미세 조정.

---

### 3단계: 프론트엔드 최적화 (Frontend Optimization)

#### Web Worker 도입
게임 렌더링(Canvas), 화상 채팅(WebRTC), STT 처리가 메인 스레드에서 경합하여 발생하는 렉(Lag)을 해결합니다.

*   **적용 대상**: "STT 결과 처리 로직"(가장 무거운 부분)을 **Web Worker**로 분리.
    *   *참고*: `webkitSpeechRecognition` API 자체는 DOM에 의존하므로 Worker로 옮길 수 없으나, `onresult` 이후의 문자열 분석/이벤트 처리는 분리 가능.
*   **기대 효과**: 메인 스레드 부하 감소로 약 **40% 성능 향상** 예상.

---

## 3. 요약 및 마일스톤 (Action Items)

| 구분 | 할 일 (Action Item) | 중요도 | 비고 |
| :--- | :--- | :--- | :--- |
| **수집** | Python 스크립트로 유튜브 데이터 수집 | ⭐⭐⭐ | Browser 자동화 X |
| **전처리** | `webrtcvad` 적용 및 0.5초/15초 필터링 | ⭐⭐⭐ | |
| **전처리** | 노이즈 주입(끝/중간/앞 생략) 함수 구현 | ⭐⭐ | 30% 비율 적용 |
| **전처리** | 자음 복원 규칙(`simple_rules`) 적용 | ⭐⭐ | |
| **학습** | 라벨링 (최소 700개) & Oversampling | ⭐⭐⭐ | 비율 1:5 목표 |
| **학습** | Unsmile 모델 로드 및 Head 교체 (11개) | ⭐⭐⭐ | Base Model: RoBERTa |
| **학습** | 2단계 학습 (Freeze -> Unfreeze) 코드 구현 | ⭐⭐ | |
| **FE** | STT 결과 처리 로직 Web Worker 분리 | ⭐ | 최적화 단계 |

이 문서는 프로젝트 내 `LLM_CONTEXT` 폴더에 위치하여 팀원들과 공유하거나 추후 개발 시 지속적으로 참고하시기 바랍니다.
