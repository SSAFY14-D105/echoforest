# 🎮 Game Data Pipeline: From STT to Training

이 문서는 게임 내 음성 채팅 데이터를 수집, 정제, 라벨링하여 AI 학습용 데이터셋(`final_train.tsv`)을 구축하는 전체 파이프라인 가이드입니다.

---

## 🎯 1. Labeling Strategy (핵심 전략)

우리 AI 모델의 차별점은 단순 욕설 필터링을 넘어 **"게임 내 맥락(Context)"**을 이해하는 것입니다.

### 1-1. 왜 UnSmile을 그대로 쓰지 않는가?

| 구분 | 기존 UnSmile | 우리 프로젝트 |
|------|-------------|--------------|
| **목적** | 온라인 댓글 혐오 탐지 | 협동게임 음성 부정어 탐지 |
| **입력** | 타이핑된 텍스트 | STT 변환된 음성 |
| **라벨** | 10개 (성별/지역/종교 등) | 8개 (게임 맥락 특화) |
| **핵심 차이** | 혐오 "발언" 분류 | 팀 분위기 해치는 "태도" 분류 |

→ **"남탓", "감정표출", "게임오더"** 등 게임 특화 라벨이 필요!

### 1-2. 2단계 라벨링 전략 (Two-Phase Labeling)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Phase 1] UnSmile 10라벨 → 3라벨 축소                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [원본 UnSmile 10라벨]              [축소된 3라벨]                  │
│  ┌─────────────────────┐          ┌────────────────┐               │
│  │ 악플/욕설           │ ──────▶ │ 욕설/악플 = 1  │               │
│  ├─────────────────────┤          ├────────────────┤               │
│  │ 여성/가족           │          │                │               │
│  │ 남성                │          │                │               │
│  │ 성소수자            │ ──────▶ │ 기타혐오 = 1   │               │
│  │ 인종/국적           │          │                │               │
│  │ 연령, 지역, 종교... │          │                │               │
│  ├─────────────────────┤          ├────────────────┤               │
│  │ clean               │ ──────▶ │ clean = 1      │               │
│  └─────────────────────┘          └────────────────┘               │
│                                                                     │
│  ▶ 05_prep_unsmile.py 에서 처리                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ [Phase 2] 3라벨 + 우리 데이터 → Gemini로 8라벨 재라벨링            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [입력]                                                             │
│  - UnSmile 3라벨 데이터 (약 11K)                                   │
│  - 유튜브 STT 데이터 (약 6K)                                       │
│                           ↓                                         │
│                    Gemini API                                       │
│                           ↓                                         │
│  [출력: 8라벨]                                                      │
│  abuse | hate | clean | blame | anger | frustration | praise | order│
│                                                                     │
│  ▶ 06_ai_labeling.py 에서 처리                                     │
│  ▶ Gemini에게 기존 라벨(욕설/혐오/clean)을 힌트로 제공             │
└─────────────────────────────────────────────────────────────────────┘
```

### 1-3. 최종 8-Class Labels (Multi-label)

하나의 문장에 여러 라벨이 동시에 붙을 수 있습니다. (예: `abuse` + `order` = "아 시발 미드 오라고")

| ID | 라벨 (English) | 설명 (Description) | 예시 (STT Raw) | 게임 영향 |
| :--- | :--- | :--- | :--- | :--- |
| **0** | **abuse** | 욕설, 패드립, 심한 비속어 | `시발` `개새끼` `느금마` | 🔴 강한 페널티 |
| **1** | **hate** | 혐오 발언 (성별/지역/인종 등) | (Unsmile 기준) | 🔴 강한 페널티 |
| **2** | **clean** | 일반적인 대화, 잡담 | `밥 먹고 올게요` `오늘 날씨 춥네` | ⚪ 무해 |
| **3** | **blame** | 남 탓, 정치질, 팀원 비난 | `너 때문이야` `아 뭐하냐` `니가 던졌잖아` | 🟠 팀 분위기 저하 |
| **4** | **anger** | (대상 없는) 단순 분노, 짜증 | `아 진짜 화나네` `열받아` `아오` | 🟡 경고성 |
| **5** | **frustration** | 좌절, 포기, 자책, 한숨 | `하 진짜` `망했다` `못해먹겠네` `gg` | 🟡 모니터링 |
| **6** | **praise** | 칭찬, 격려, 긍정 | `나이스` `잘했어` `캐리했네` `굿` | 🟢 긍정 피드백 |
| **7** | **order** | 전략적 지시, 행동 요청 | `오른쪽 가자` `점프해` `빼자` `들어와` | ⚪ 무해 (게임 진행) |

### 1-4. Prompting Know-how (노하우)
Gemini에게 프롬프트를 줄 때 다음 3가지를 고려했습니다:
1.  **영어 라벨 사용**: LLM의 이해도를 높이기 위해 프롬프트 내부에서는 `anger`, `praise` 등 영어 단어를 사용합니다.
2.  **STT 맞춤형 예시**: 실제 게임 STT 데이터는 문장부호(`!`, `?`, `.`)가 없습니다. 따라서 Few-shot 예시도 **"하 진짜"**로 주어야 정확도가 올라갑니다.
3.  **기존 라벨 힌트 제공**: UnSmile에서 이미 판정된 `욕설/혐오/clean` 정보를 프롬프트에 포함하여 Gemini가 뒤집지 않도록 유도합니다.

---

## 📂 2. Directory Architecture (폴더 구조)

```bash
data_collection/
├── 01_youtube_downloader.py   # [Step 1] 유튜브 오디오 다운로드
├── 02_whisper_transcriber.py  # [Step 2] STT 변환 (Audio -> Text)
├── 03_text_clean.py           # [Step 3] 텍스트 정제 (노이즈 제거)
├── 04_text_anonymize.py       # [Step 4] 익명화 (닉네임 -> [유저])
├── 05_prep_unsmile.py         # [Step 5] 외부 데이터(Unsmile) 변환
├── 06_ai_labeling.py          # [Step 6] AI 라벨링 (Gemini)
├── 07_merge_final.py          # [Step 7] 최종 병합 (Final merge)
│
├── utils/                     # [도구함] 분석 및 보조 스크립트 모음
│   ├── analyze_labels.py      # 라벨 분포/키워드 분석기
│   └── split_sentences.py     # 문장 분리 도구 등
│
├── raw_data/                  # [입력] 초기에 수집된 원본 데이터
├── processed_data/            # [출력] 단계별 처리된 데이터 저장소
│   ├── 01_audio_stt/          # (Step 2 결과) STT 원본
│   ├── 03_cleaned/            # (Step 3 결과) 1차 정제됨
│   ├── 04_anonymized/         # (Step 4 결과) 익명화됨
│   ├── 05_external/           # (Step 5 결과) Unsmile 변환 데이터 (기존 UnSmile모델 데이터셋을 욕설/악플|기타혐오|clean 3가지 라벨로 분류)
│   ├── 06_ai_labeled/         # (Step 6 결과) Gemini 라벨링 데이터 (GMS이용해서 우리가 3가지 라벨로 분류한 UnSmile 데이터셋과 우리 데이터 전부 8개 라벨로 재라벨링)
│   ├── 07_final/              # (Step 7 결과) ★최종 학습 데이터★
│   └── archive/               # [백업] 실행할 때마다 날짜별로 기록 저장 (Backup)
└── DATA_PIPELINE_README.md    # (현재 문서)
```

---

## 🚀 2. Workflow & Execution (실행 순서)

아래 순서대로 스크립트를 실행(`python <filename>`)하면 데이터가 파이프라인을 타고 처리됩니다.

### Step 3: 텍스트 정제 (Text Cleaning)
*   **파일**: `03_text_clean.py`
*   **입력**: `raw_data/` 또는 `processed_data/01_audio_stt/`
*   **기능**:
    *   Whisper의 환각(X1, X2...) 및 특수기호 노이즈 제거.
    *   마스킹된 욕설(`X발`)을 원색적인 표현(`시발`)으로 복구 (AI 학습용).
*   **출력**: `processed_data/03_cleaned/merged_stt_cleaned.tsv`
*   **아카이브**: `archive/03_cleaned_history/`에 자동 백업됨.

### Step 4: 익명화 (Anonymization)
*   **파일**: `04_text_anonymize.py`
*   **입력**: `processed_data/03_cleaned/merged_stt_cleaned.tsv`
*   **기능**:
    *   유튜버 실명, 닉네임, 게임 유저명을 **`[유저]`** 태그로 치환.
    *   Kiwi 형태소 분석기 + 사용자 정의 사전 사용.
*   **출력**: `processed_data/04_anonymized/final_dataset.tsv`
*   **아카이브**: `archive/04_anonymized_history/`에 자동 백업됨.

### Step 5: UnSmile 라벨 축소 (10라벨 → 3라벨)
*   **파일**: `05_prep_unsmile.py`
*   **입력**: `processed_data/05_external/unsmile_train_v1.0.tsv` (HuggingFace 원본)
*   **전략 (Phase 1)**:
    *   기존 UnSmile 10개 라벨을 3개로 축소합니다:
    *   `악플/욕설 = 1` → **욕설/악플**
    *   `여성/가족, 남성, 성소수자, 인종/국적, 연령, 지역, 종교, 기타 혐오` 중 하나라도 1 → **기타혐오**
    *   `clean = 1` → **clean**
*   **출력**: `processed_data/05_external/unsmile_3label.tsv`
*   **참고**: 이 데이터는 Step 6에서 Gemini를 통해 8라벨로 확장됩니다.

### Step 6: AI 라벨링 (Gemini 8라벨 재라벨링)
*   **파일**: `06_ai_labeling.py`
*   **입력 1**: `processed_data/05_external/unsmile_3label.tsv` (UnSmile 3라벨 축소 데이터)
*   **입력 2**: `processed_data/04_anonymized/final_dataset.tsv` (유튜브 STT 데이터)
*   **전략 (Phase 2)**:
    *   두 데이터를 Gemini API를 통해 8개 라벨로 재라벨링합니다.
    *   `[abuse, hate, clean, blame, anger, frustration, praise, order]`
    *   UnSmile 데이터의 경우 기존 3라벨(욕설/혐오/clean)을 힌트로 제공합니다.
*   **출력**: `processed_data/06_ai_labeled/gemini_labeled_17k.tsv`
*   **아카이브**: `archive/06_ai_labeled_history/`에 자동 백업됨.

### Step 7: 최종 병합 (Final Merge)
*   **파일**: `07_merge_final.py`
*   **입력 1**: `processed_data/06_ai_labeled/gemini_labeled_17k.tsv` (우리 데이터)
*   **입력 2**: `processed_data/05_external/unsmile_converted_8label.tsv` (외부 데이터)
*   **기능**:
    *   두 데이터를 합치고 셔플(Shuffle)하여 최종 학습 포맷을 완성.
*   **출력**: `processed_data/07_final/final_train.tsv` (**★This is it!★**)
*   **아카이브**: `archive/07_final_history/`에 자동 백업됨.

---

## 🛠️ 3. Utils (보조 도구)

파이프라인 실행과는 별개로, 데이터를 분석하거나 확인할 때 사용합니다. `utils/` 폴더에 있습니다.

*   `python utils/analyze_labels.py`: 최종 데이터(`final_train.tsv`)의 라벨 분포와 키워드를 분석해줍니다.
*   `python utils/split_sentences.py`: 긴 문단을 문장 단위로 자르는 도구입니다.

---

## ⚠️ Team Note
*   **경로 문제**: 모든 스크립트는 상대 경로(`../processed_data`)를 자동으로 계산합니다. 어디서 실행하든(루트 또는 폴더 내부) 웬만하면 작동하지만, 가급적 `data_collection` 폴더에서 실행하는 것을 권장합니다.
*   **데이터 백업**: 실수를 해도 `processed_data/archive/` 폴더에 날짜별(`YYYYMMDD_HHMMSS`)로 원본이 저장되니 안심하고 롤백할 수 있습니다.
*   **외부 데이터**: Unsmile 데이터셋 원본은 깃허브 등에 공개되지 않을 수 있으니, 팀 공유 드라이브에서 `processed_data/05_external/` 경로에 파일을 넣어주세요.

**작성일**: 2026-02-01
**관리자**: AI Team
