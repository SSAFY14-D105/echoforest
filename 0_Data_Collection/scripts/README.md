# 🎮 게임 음성채팅 수집 + 라벨링 파이프라인 (01~06)

협동 게임 유튜브 영상에서 음성채팅을 모아 **STT → 정제 → 개인지칭 제거 → unSmile 사전라벨 → (사람 검수)** 까지 가는 파이프라인입니다.

> 📌 예전 06~12는 **자체 8라벨** 자동 라벨링이었는데 미채택이라 제거했습니다. 지금 06은 **공식 unSmile(10라벨) 사전라벨 + 사람 검수** 방식입니다(사람 검수가 ground truth라 순환 없음). 설계 의사결정은 [`수집_파이프라인_설계노트.md`](수집_파이프라인_설계노트.md) 참고.

---

## 🚀 실행 순서

```bash
python 01_youtube_downloader.py  # 00_url_list.txt URL → 오디오(wav) → ../raw_audio/   (yt-dlp, 403 우회)
python 02_whisper_transcriber.py # 오디오 → 텍스트 (faster-whisper large-v3, GPU). unSmile 10라벨 헤더 템플릿
python 03_text_clean.py          # 병합 + 숫자/기호·자모·외국어 노이즈 제거 + 중복 제거
python 04_text_anonymize.py      # 개인지칭(닉네임+호칭 / 등록 닉네임) **행 삭제** (Kiwi). [유저] 치환 아님
python 05_text_clean_advanced.py # 노이즈·STT 환각·중복 제거 (min 2자)
python 06_prelabel_unsmile.py    # unSmile로 abuse/clean **사전라벨** → 검수용 tsv
```

이후 `06`이 만든 검수 파일의 `검수` 칼럼을 채워 **확정** → 문장+10라벨만 추출해 [`../datasets/train_collected.tsv`](../datasets)에 합칩니다.

> ※ 경로는 `BASE_DIR = 0_Data_Collection`(부모) 기준이라 `scripts/`에서 실행해도 `../raw_audio/` 등을 올바로 찾습니다.
> ※ 실행은 conda env에서 `PYTHONUTF8=1`(이모지 출력 cp949 크래시 방지), GPU STT는 `HF_HUB_DISABLE_SYMLINKS=1`(Windows symlink 권한) 권장.

## 📁 구조

```
scripts/
├── 00_url_list.txt              # 협동게임 YouTube URL 목록
├── 01_youtube_downloader.py     # yt-dlp 다운로드 (403 우회)
├── 02_whisper_transcriber.py    # faster-whisper STT (발화 단위 청킹, unSmile 10라벨 헤더)
├── 03_text_clean.py             # 기본 정제 (기호·자모·외국어 노이즈, 중복)
├── 04_text_anonymize.py         # 개인지칭 행 삭제 (Kiwi NNP+호칭 / 등록 닉네임)
├── 05_text_clean_advanced.py    # 고급 정제 (노이즈·환각·중복, min 2자)
├── 06_prelabel_unsmile.py       # unSmile abuse/clean 사전라벨 → 검수용 tsv
├── 수집_파이프라인_설계노트.md   # 설계 의사결정 기록
└── README.md
```

> 중간 산출물: `raw_data/`(STT) → `processed_data/03~05`(정제) → `processed_data/06_prelabeled/review_candidates.tsv`(검수 대기). 모두 재생성 가능해 git 미추적.

## ⚙️ 의존성

```bash
conda install ffmpeg -c conda-forge
pip install yt-dlp faster-whisper torch kiwipiepy pandas transformers
```

## 🔎 주의 (품질)

- **라벨 정책**: unSmile **10라벨 포맷은 유지**하되(공식·train_collected 호환), 게임 맥락상 실제 분류는 **`악플/욕설` vs `clean` 이진**만 한다. 이유 — 혐오 '대상' 세분류(여성/남성/지역/종교…)는 게임 채팅에 거의 없음 · unSmile은 multi-label이라 욕설/혐오 라벨만 보면 됨 · 기획서 목표가 "악플/욕설 Recall 개선". (상세 근거: `06_prelabel_unsmile.py` docstring · [`collected_game_chat/README`](../collected_game_chat))
- `04` 개인지칭 삭제는 게임 채팅 특성상 비율이 높을 수 있음(파일럿 ~12%). 등록 닉네임(`CUSTOM_USERS`)에 **영상별 화자명을 추가**하면 bare 닉네임 탐지율↑.
- `06`의 unSmile 사전라벨은 **게임 오더를 abuse로 오탐**하는 경향이 큼(이 프로젝트가 파인튜닝으로 풀려는 바로 그 문제). 그래서 abuse 후보를 확률순 정렬해두니 **사람 검수로 반드시 보정**할 것.
