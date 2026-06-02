# 0_Data_Collection — 데이터 수집·라벨링 단계

게임 음성채팅(STT) 데이터를 모으고, 정제하고, 라벨링해서 **파인튜닝/평가에 쓸 데이터셋을 만드는** 파이프라인입니다.

---

## ⚠️ 먼저 읽기 — 라벨 체계가 "두 개"입니다

이 폴더엔 **서로 다른 두 가지 접근**이 섞여 있어요. 헷갈리기 쉬우니 이것부터 짚습니다.

| 접근 | 라벨 체계 | 위치 | 실제 사용? |
| :--- | :--- | :--- | :---: |
| **① 최종(채택)** | **unSmile 10라벨** (여성/가족·남성·…·악플/욕설·clean) | **`datasets/`**, `labeling/` | ✅ **파인튜닝·평가에 이게 쓰임** |
| ② 초기 탐색 | 게임용 8라벨 (abuse·hate·clean·blame·anger·frustration·praise·order) | `scripts/`, `processed_data/` | ❌ 탐색만, 최종 미채택 |

> **결론: 실제 학습/평가에 들어간 데이터는 `datasets/`(10라벨) 입니다.** `scripts/`+`processed_data/`의 8라벨 파이프라인은 *초기에 시도했던 수집·라벨링 방식*이고, 최종적으로는 unSmile 모델을 파인튜닝하려고 **unSmile 10라벨 형식**으로 정리한 `datasets/`를 사용했어요. (8라벨 산출물은 기록용으로 남겨둔 것)

---

## 📁 폴더 지도

| 폴더/파일 | 내용 | 역할 |
| :--- | :--- | :--- |
| **`datasets/`** ⭐ | `train_collected.tsv`(518) · `test_set.tsv`(742) · `_archive/` · README | **최종 데이터 단일 출처**(10라벨). 모든 학습·평가가 여기서 읽음 |
| `labeling/` | `keywords.json` · `keywords.md` · `convert_keywords_to_tsv.py` | 우리가 게임하며 쓴 표현(긍정/부정)을 **키워드로 모아 → unSmile 10라벨 tsv(=train_collected 518)** 로 변환 |
| `scripts/` | 수집 파이프라인 `00`~`12` + README | YouTube→STT→정제→8라벨 라벨→병합 (아래 표) |
| `processed_data/` | `03_cleaned` → `04_anonymized(_clean)` → `05_external` → `06_ai_labeled` | scripts 파이프라인의 **단계별 중간 산출물**(8라벨) |
| `unsmile/` | UnSmile 정제·STT변형본 (`UnSmile_Clean`, `UnSmile_Original`) | 8라벨 파이프라인이 쓰던 unSmile 가공본 (최상위 `UnSmile/`의 공식 원본과 별개) |
| `utils/` | `analyze_labels.py`, `split_sentences.py`, `select_balanced.py` 등 | 수집 보조 유틸 + 처리 가이드 |
| `web_speech_api/` | `audio_1_google*.txt` | Web Speech API STT 출력 실험 기록 |
| `raw_audio/` | (비어있음, `.gitkeep`) | YouTube 오디오(.wav) 저장 위치 — 용량 커서 커밋 안 함 |

---

## 🔧 scripts/ — 수집 파이프라인 (8라벨, 초기 탐색)

실행 순서대로:

| # | 스크립트 | 하는 일 |
| :--- | :--- | :--- |
| 00 | `00_url_list.txt` | 협동게임 YouTube URL 목록 |
| 01 | `01_youtube_downloader.py` | URL → 오디오(wav) 다운로드 → `raw_audio/` |
| 02 | `02_whisper_transcriber.py` | 오디오 → 텍스트 (**faster-whisper large-v3**, GPU) |
| 03 | `03_text_clean.py` | STT 결과 병합 + 숫자/기호 제거 + 마스킹 욕설 복구 |
| 04 | `04_text_anonymize.py` | 닉네임/고유명사 → `[유저]` 치환 (Kiwi 형태소) |
| 05 | `05_text_clean_advanced.py` | 노이즈·STT 환각·중복 제거 |
| 06 | `06_manual_labeling.py` | 키워드 패턴으로 8라벨 자동 부여 |
| 07 | `07_convert_to_binary.py` | 단일 라벨 → 8컬럼 이진(0/1) 형식 |
| 08 | `08_prep_unsmile.py` | UnSmile 10라벨 → 3라벨 축소 |
| 09 | `09_relabel_unsmile.py` | UnSmile → 게임용 8라벨 재분류 |
| 11 | `11_ai_labeling.py` | (선택) Gemini/GPT로 8라벨 자동 라벨 |
| 12 | `12_merge_final.py` | STT + UnSmile + AI 라벨 병합 |

> 자세한 8라벨 정의·실행법은 [`scripts/README.md`](scripts/README.md) 참고.
> ※ 스크립트 경로는 `BASE_DIR = 0_Data_Collection`(부모) 기준이라, `scripts/`에서 실행해도 `processed_data/`·`raw_audio/`를 올바로 찾습니다.

---

## 🎯 그래서 다음 단계로 뭐가 넘어가나
```
labeling/ (키워드)  ─┐
                     ├→ datasets/train_collected.tsv (518, 10라벨) ─→ 4_LoRA / 5_Full 추가학습
게임/유튜브 STT 라벨 ─┘   datasets/test_set.tsv (742, 10라벨) ───────→ 1_Model_Selection·6_Comparison·8_Quantization 평가
```
> 데이터 무결성·구성은 [`datasets/README.md`](datasets/README.md)에 정리돼 있습니다.
