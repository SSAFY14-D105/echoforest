# 🎮 Game Data Pipeline: From STT to Training

이 문서는 게임 내 음성 채팅 데이터를 수집, 정제, 라벨링하여 AI 학습용 데이터셋(`final_train.tsv`)을 구축하는 전체 파이프라인 가이드입니다.

---

## 🎯 1. Labeling Strategy (핵심 전략)

우리 AI 모델의 차별점은단순 욕설 필터링을 넘어 **"게임 내 맥락(Context)"**을 이해하는 것입니다.

### 1-1. 8-Class Labels (Multi-label)
하나의 문장에 여러 라벨이 동시에 붙을 수 있습니다. (예: `욕설` + `게임오더` = "아 시발 미드 오라고")

| ID | 라벨 (English) | 설명 (Description) | 예시 (STT Raw) |
| :--- | :--- | :--- | :--- |
| **0** | **abuse** | 욕설, 패드립, 심한 비속어 | `시발` `개새끼` `느금마` |
| **1** | **hate** | 혐오 발언 (성별/지역/인종 등) | (Unsmile 기준) |
| **2** | **clean** | 일반적인 대화, 잡담 (오더 아님) | `밥 먹고 올게요` `오늘 날씨 춥네` |
| **3** | **blame** | 남 탓, 정치질, 팀원 비난 | `너 때문이야` `아 뭐하냐` `니가 던졌잖아` |
| **4** | **anger** | (대상 없는) 단순 분노, 짜증 | `아 진짜 화나네` `열받아` `아오` |
| **5** | **frustration** | 좌절, 포기, 자책, 한숨 | `하 진짜` `망했다` `못해먹겠네` `gg` |
| **6** | **praise** | 칭찬, 격려, 긍정 | `나이스` `잘했어` `캐리했네` `굿` |
| **7** | **order** | 전략적 지시, 행동 요청 | `오른쪽 가자` `점프해` `빼자` `들어와` |

### 1-2. Prompting Know-how (노하우)
Gemini에게 프롬프트를 줄 때 다음 2가지를 고려했습니다.
1.  **영어 라벨 사용**: LLM의 이해도를 높이기 위해 프롬프트 내부에서는 `anger`, `praise` 등 영어 단어를 사용합니다. (저장은 `0/1` 로 변환됨)
2.  **STT 맞춤형 예시 (No Punctuation)**: 실제 게임 STT 데이터는 문장부호(`!`, `?`, `.`)가 없습니다. 따라서 Few-shot 예시도 **"하... 진짜"**가 아니라 **"하 진짜"**로 주어야 정확도가 올라갑니다.

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

### Step 5: 외부 데이터 준비 (Unsmile Conversion)
*   **파일**: `05_prep_unsmile.py`
*   **입력**: `processed_data/05_external/unsmile_train_clean_hybrid_11k.tsv` (※ 미리 넣어둬야 함)
*   **기능**:
    *   기존 Unsmile 데이터셋 포맷을 우리 프로젝트 포맷(8개 라벨)으로 변환.
    *   `악플/Clean` → `남탓`, `좌절`, `분노` 등 세부 라벨 추가 마킹.
*   **출력**: `processed_data/05_external/unsmile_converted_8label.tsv`
    *   *(폴더에 원본 파일 1개, 변환된 파일 1개, 총 2개가 공존하게 됨)*
*   **아카이브**: 없음 (외부 데이터는 변하지 않으므로)

### Step 6: AI 라벨링 (Gemini Labeling)
*   **파일**: `06_ai_labeling.py`
*   **입력**: `processed_data/04_anonymized/final_dataset.tsv`
*   **기능**:
    *   Google Gemini API를 사용해 게임 채팅에 8가지 다중 라벨 부착.
    *   [욕설, 혐오, Clean, 남탓, 분노, 좌절, 칭찬, 게임오더]
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
