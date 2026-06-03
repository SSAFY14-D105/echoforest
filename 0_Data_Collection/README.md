# 0_Data_Collection — 데이터 수집·라벨링 단계

게임 음성채팅(STT) 데이터를 모으고, 정제하고, 라벨링해서 **파인튜닝/평가에 쓸 데이터셋을 만드는** 파이프라인입니다.

---

## ⚠️ 먼저 읽기 — "수집"은 쓰였고, "8라벨 라벨링"만 안 쓰였습니다

이 폴더는 **수집(데이터 모으기)** 과 **라벨링(분류 붙이기)** 두 일을 합니다. 라벨링은 방식이 두 번 바뀌었는데(8라벨→10라벨), **수집한 문장 자체는 그대로 최종에 쓰였어요.**

| 부분 | 위치 | 최종 사용? |
| :--- | :--- | :---: |
| **데이터 수집** (YouTube→STT→정제) | `scripts/01~05`, `processed_data/04_anonymized_clean`(코퍼스) | ✅ **실제 데이터의 출처** — 테스트셋(688)의 게임 STT 부분이 여기 수집분에서 나옴(라벨링 원본은 `datasets/_archive`) |
| 라벨링 ① **8라벨**(초기 시도) | (전부 제거 — velog에 기록) | ❌ **미채택** — 8라벨 체계·산출물 모두 정리, 10라벨로 선회 |
| 라벨링 ② **10라벨 unSmile**(최종) | `collected_game_chat/`, `datasets/` | ✅ **파인튜닝·평가에 이게 쓰임** |

> **핵심:** 8라벨 *분류 체계* 는 버렸지만, **그 데이터를 모은 수집 파이프라인(01~05)은 지금 테스트셋의 출처**라 필요합니다. 최종 학습/평가에 들어가는 라벨링된 데이터는 `datasets/`(10라벨)이고, 8라벨 산출물은 *버려진 라벨링 시도의 기록*으로 남아 있어요.

---

## 📁 폴더 지도

| 폴더/파일 | 내용 | 역할 |
| :--- | :--- | :--- |
| **`datasets/`** ⭐ | `train_collected.tsv`(518) · `test_set.tsv`(688) · `_archive/` · README | **최종 데이터 단일 출처**(10라벨). 모든 학습·평가가 여기서 읽음 |
| `collected_game_chat/` ⭐ | `collected_game_chat.json` · `build_train_collected.py` · README | **직접 수집한 게임 채팅**(clean/negative) → unSmile 10라벨 tsv(=train_collected 518)로 변환 |
| `scripts/` | 수집 파이프라인 `00`~`05` + 설계노트 + README | YouTube→STT→정제→익명화 (아래 표) |
| `processed_data/` | `03_cleaned` → `04_anonymized(_clean)` (실행 시 생성) | 수집 파이프라인(`scripts/03~05`)의 **중간 산출물**(정제·익명화 STT) |
| `raw_audio/` | (비어있음, `.gitkeep`) | YouTube 오디오(.wav) 저장 위치 — 용량 커서 커밋 안 함 |

> 📍 STT **엔진 선택**(Web Speech vs Whisper) 비교 실험은 데이터 수집이 아니라 모델 선정 단계라, [`1_Model_Selection/00_STT_Selection/`](../1_Model_Selection/00_STT_Selection)로 옮겼습니다.

> ℹ️ **공식 unSmile 원본은 최상위 [`UnSmile/`](../UnSmile)** (`UnSmile_Dataset`, `UnSmile_Dataset_Drop_개인지칭`)에 있고, 최종 파인튜닝([`3_UnSmile_Correction`](../3_UnSmile_Correction))이 그걸 읽습니다. 예전 8라벨 시도가 쓰던 unSmile 가공본(`unsmile/`)은 최종 파이프라인에서 안 써서 제거했습니다.

---

## 🔧 scripts/ — 수집 파이프라인 (01~05)

실행 순서대로:

| # | 스크립트 | 하는 일 |
| :--- | :--- | :--- |
| 00 | `00_url_list.txt` | 협동게임 YouTube URL 목록 |
| 01 | `01_youtube_downloader.py` | URL → 오디오(wav) 다운로드 → `raw_audio/` (yt-dlp, 403 우회) |
| 02 | `02_whisper_transcriber.py` | 오디오 → 텍스트 (**faster-whisper large-v3**, GPU) |
| 03 | `03_text_clean.py` | STT 결과 병합 + 숫자/기호 제거 + 마스킹 욕설 복구 |
| 04 | `04_text_anonymize.py` | 닉네임/고유명사 → `[유저]` 치환 (Kiwi 형태소) |
| 05 | `05_text_clean_advanced.py` | 노이즈·STT 환각·중복 제거 |

> 실행법·의존성은 [`scripts/README.md`](scripts/README.md), 설계 의사결정은 [`scripts/수집_파이프라인_설계노트.md`](scripts/수집_파이프라인_설계노트.md) 참고.
> ※ 경로는 `BASE_DIR = 0_Data_Collection`(부모) 기준이라, `scripts/`에서 실행해도 `processed_data/`·`raw_audio/`를 올바로 찾습니다.
> ※ 예전 8라벨 라벨링 스크립트(06~12)는 미채택이라 정리했고, 그 시도의 결과물만 [`processed_data/`](processed_data)에 대표본으로 남겼습니다.

---

## 🎯 그래서 다음 단계로 뭐가 넘어가나
```
collected_game_chat/ (직접 수집한 게임 채팅) ─→ datasets/train_collected.tsv (518, 10라벨) ─→ 4_LoRA / 5_Full 추가학습
YouTube 협동게임 STT + 사람 라벨링          ─→ datasets/test_set.tsv (688, 10라벨) ───────→ 1_Model_Selection·6_Comparison·8_Quantization 평가
```
> 데이터 무결성·구성은 [`datasets/README.md`](datasets/README.md)에 정리돼 있습니다.
