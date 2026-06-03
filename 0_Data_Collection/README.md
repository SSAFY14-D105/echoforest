# 0_Data_Collection — 데이터 수집·라벨링

게임 음성채팅(STT)을 모아 정제·라벨링해서 **파인튜닝/평가용 데이터셋**을 만드는 단계입니다.
각 처리 단계가 **자기 폴더에 코드 + 그 단계의 출력 데이터를 함께** 둡니다(`01`→`06`).

## 📁 구조

| 폴더 | 하는 일 | 입력 → 출력 |
| :--- | :--- | :--- |
| `01_download/` | YouTube 오디오 다운로드 (yt-dlp, 403 우회) | `00_url_list.txt` → `audio_N.wav`(로컬)·`audio_N.opus`(LFS) |
| `02_stt/` | faster-whisper large-v3 STT (GPU) | `../01_download` 오디오 → `audio_N.tsv` |
| `03_clean/` | 병합·정제(기호·자모·외국어 노이즈, 중복) | `../02_stt` → `merged_stt_cleaned.tsv` |
| `04_anonymize/` | **개인지칭(닉네임) 행 삭제** (Kiwi) | `../03_clean` → `final_dataset.tsv` |
| `05_advanced_clean/` | 고급 정제(환각·중복, min 2자) | `../04_anonymize` → `final_dataset_clean.tsv` |
| `06_prelabel/` | **unSmile abuse/clean 사전라벨** | `../05_advanced_clean` → `review_candidates.tsv` |
| `collected_game_chat/` ⭐ | 손수 수집한 게임채팅(메아리의 숲 플레이 STT + YouTube STT)을 clean/negative 분류 | `*.json` → `datasets/train_collected.tsv`(518) |
| `datasets/` ⭐ | **최종 단일 출처**: `train_collected`(518)·`test_set`(688)·`_archive` | 모든 학습·평가가 여기서 읽음 |

> `06`의 사전라벨은 **초안** → 사람이 `검수` 칼럼 확정 → 문장+10라벨만 추출해 학습 데이터에 합침(누수검증 후).

## 🔗 흐름

```
[수집 파이프라인] — 각 폴더에 코드+출력 함께
01_download → 02_stt → 03_clean → 04_anonymize → 05_advanced_clean → 06_prelabel
 (오디오)      (STT)     (정제)      (개인지칭삭제)     (고급정제)          (사전라벨) ─→ 사람검수 ─→ datasets/(학습보강)

[기존 학습/평가 데이터]
collected_game_chat (메아리의숲+YouTube STT, 손수분류) ─→ datasets/train_collected.tsv (518) ─→ 4_LoRA/5_Full 학습
                                                          datasets/test_set.tsv (688, 고정) ─→ 모델선정·비교·양자화 평가
```

## 🚀 실행 (conda)

```bash
python 01_download/01_youtube_downloader.py
python 02_stt/02_whisper_transcriber.py
python 03_clean/03_text_clean.py
python 04_anonymize/04_text_anonymize.py
python 05_advanced_clean/05_text_clean_advanced.py
python 06_prelabel/06_prelabel_unsmile.py
```

> conda 환경에서 `PYTHONUTF8=1`(이모지 cp949 크래시 방지), GPU STT는 `HF_HUB_DISABLE_SYMLINKS=1` 권장.
> 의존성: `conda install ffmpeg -c conda-forge` + `pip install yt-dlp faster-whisper torch kiwipiepy pandas transformers`

## 🏷️ 라벨 정책 — abuse/clean 이진

unSmile **10라벨 포맷은 유지**하되(공식·train_collected 호환), 게임 맥락상 실제 분류는 **`악플/욕설` vs `clean` 이진**만 한다. 이유 — 혐오 '대상' 세분류(여성/남성/지역/종교…)는 게임 채팅에 거의 없음 · unSmile은 multi-label이라 욕설/혐오 라벨만 보면 됨 · 기획서 목표가 "악플/욕설 Recall 개선". (상세: `06` docstring · `collected_game_chat/README`)

## 🗂️ git 정책

- 원본 `*.wav`: 로컬만(용량). 압축본 `*.opus`: **LFS로 커밋**(원본 영상 삭제 대비 아카이브).
- STT·정제 tsv: 작은 텍스트라 커밋(전사본 보존).

## ℹ️ 참고

- 예전 **8라벨 자체 분류 시도**는 미채택이라 제거하고 10라벨 unSmile로 선회(서사는 velog).
- 공식 unSmile 원본은 최상위 [`UnSmile/`](../UnSmile), 보정은 [`3_UnSmile_Correction`](../3_UnSmile_Correction).
- 파이프라인 설계 의사결정: [`수집_파이프라인_설계노트.md`](수집_파이프라인_설계노트.md).
