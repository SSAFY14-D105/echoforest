# 🎮 게임 음성채팅 데이터 파이프라인

게임 음성채팅 STT 데이터와 UnSmile 데이터셋을 8개 라벨로 분류하는 파이프라인

## 📊 라벨 정의

| 라벨 | 설명 | 예시 |
|------|------|------|
| `abuse` | 욕설/비속어 | 시발, 병신, 새끼 |
| `hate` | 혐오표현 (성별/지역/인종/종교) | 김치녀, 한남충, 틀딱 |
| `clean` | 일반 대화 | 여기로 와, 고마워 |
| `blame` | 비난/남탓 | 니가 못해서, 왜 그랬어 |
| `anger` | 분노 표현 | 화나, 짜증나 |
| `frustration` | 좌절/한탄 | 안돼, 포기 |
| `praise` | 칭찬/격려 | 잘했어, 최고 |
| `order` | 지시/명령 | 가자, 따라와, 조심해 |

---

## 📁 폴더 구조

```
data_collection/
├── 📜 스크립트 (실행 순서대로)
│   ├── 00_url_list.txt          # YouTube URL 목록
│   ├── 01_youtube_downloader.py # 유튜브 다운로드
│   ├── 02_whisper_transcriber.py # Whisper STT 변환
│   ├── 03_text_clean.py         # 기본 텍스트 정제
│   ├── 04_text_anonymize.py     # 유저ID 익명화
│   ├── 05_text_clean_advanced.py # 고급 텍스트 정제
│   ├── 06_manual_labeling.py    # STT 데이터 수동 라벨링
│   ├── 07_convert_to_binary.py  # 라벨 → 이진 형식 변환
│   ├── 08_prep_unsmile.py       # UnSmile 10라벨→3라벨
│   ├── 09_relabel_unsmile.py    # UnSmile 8라벨 재라벨링
│   ├── 11_ai_labeling.py        # Gemini AI 라벨링 (선택)
│   ├── 12_merge_final.py        # 최종 데이터 병합
│   └── 수집_파이프라인_설계노트.md # 파이프라인 설계 의사결정 기록 (청킹·403우회·자모제거 이유)
│
├── 📂 processed_data/           # 8라벨 시도 대표 산출물 (핵심만)
│   ├── 04_anonymized_clean/     # 수집 코퍼스 15,281 + 수동 8라벨
│   │   └── final_dataset.tsv
│   ├── 05_external/             # UnSmile → 게임 8라벨 재분류
│   │   └── unsmile_relabeled.tsv
│   └── 06_ai_labeled/           # Gemini AI 8라벨 샘플(100)
│       └── gemini_labeled_100.tsv
│
├── 📂 raw_audio/                # 원본 오디오 파일
└── 📂 web_speech_api/           # 웹 STT 관련
```

---

## 🚀 실행 순서

### Phase 1: STT 데이터 수집 및 정제
```bash
python 01_youtube_downloader.py  # 유튜브 → 오디오
python 02_whisper_transcriber.py # 오디오 → 텍스트
python 03_text_clean.py          # 기본 정제
python 04_text_anonymize.py      # 익명화
python 05_text_clean_advanced.py # 고급 정제
```

### Phase 2: 라벨링
```bash
python 06_manual_labeling.py     # 키워드 기반 라벨링
python 07_convert_to_binary.py   # 이진 형식 변환
```

### Phase 3: UnSmile 데이터 처리
```bash
python 08_prep_unsmile.py        # 3라벨 변환
python 09_relabel_unsmile.py     # 8라벨 재라벨링
```

### Phase 4: 병합 (선택)
```bash
python 12_merge_final.py         # 데이터 병합
```

---

## 📈 현재 데이터 현황

| 데이터셋 | 문장 수 | 상태 |
|----------|---------|------|
| STT 데이터 | 15,281 | ✅ 라벨링 완료 |
| UnSmile 데이터 | 11,136 | ✅ 재라벨링 완료 |

---

## 📝 출력 형식

TSV 형식, 각 라벨은 별도 컬럼 (0 또는 1):

```
sentence	abuse	hate	clean	blame	anger	frustration	praise	order
안녕하세요	0	0	1	0	0	0	0	0
시발 뭐야	1	0	0	0	0	0	0	0
```

---

## ⚙️ 의존성

```bash
pip install openai-whisper pandas pytube
```
