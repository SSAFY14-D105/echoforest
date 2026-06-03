# 🎮 게임 음성채팅 데이터 수집 파이프라인 (01~05)

협동 게임 유튜브 영상에서 음성채팅을 모아 **STT → 정제 → 익명화**까지 하는 수집 파이프라인입니다.

> 📌 예전엔 이 뒤에 **8라벨 자동 라벨링**(06~12) 스크립트가 붙어 있었지만, 8라벨 체계를 접고 **10라벨 unSmile**로 선회하면서 라벨링 스크립트는 정리했습니다. 그 시도의 결과물은 [`../processed_data/`](../processed_data)에 대표본으로 남아 있습니다. 파이프라인 설계 의사결정(스크립트 분리·청킹·403 우회·STT 자모 제거 이유)은 [`수집_파이프라인_설계노트.md`](수집_파이프라인_설계노트.md) 참고.

---

## 🚀 실행 순서

```bash
python 01_youtube_downloader.py  # 00_url_list.txt URL → 오디오(wav) → ../raw_audio/
python 02_whisper_transcriber.py # 오디오 → 텍스트 (faster-whisper large-v3, GPU)
python 03_text_clean.py          # STT 병합 + 숫자/기호 제거 + 마스킹 욕설 복구
python 04_text_anonymize.py      # 닉네임/고유명사 → [유저] (Kiwi 형태소)
python 05_text_clean_advanced.py # 노이즈·STT 환각·중복 제거
```

> ※ 경로는 `BASE_DIR = 0_Data_Collection`(부모) 기준이라 `scripts/`에서 실행해도 `../raw_audio/` 등을 올바로 찾습니다.

## 📁 구조

```
scripts/
├── 00_url_list.txt              # 협동게임 YouTube URL 목록
├── 01_youtube_downloader.py     # yt-dlp 다운로드 (403 우회 적용)
├── 02_whisper_transcriber.py    # faster-whisper STT (발화 단위 청킹)
├── 03_text_clean.py             # 기본 텍스트 정제
├── 04_text_anonymize.py         # [유저] 익명화 (Kiwi)
├── 05_text_clean_advanced.py    # 고급 정제
├── 수집_파이프라인_설계노트.md   # 설계 의사결정 기록
└── README.md
```

## 📝 산출물

`05`까지 거친 정제·익명화 STT 코퍼스(**15,281문장**)는 [`../processed_data/04_anonymized_clean/final_dataset.tsv`](../processed_data/04_anonymized_clean)에 있습니다. 이게 테스트셋(688)의 **게임 STT 부분의 출처**입니다.

> 최종 학습/평가 데이터는 여기가 아니라 [`../datasets/`](../datasets)(10라벨)입니다.

## ⚙️ 의존성

```bash
conda install ffmpeg -c conda-forge
pip install yt-dlp faster-whisper torch kiwipiepy pandas
```
