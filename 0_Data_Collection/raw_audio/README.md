# raw_audio — YouTube 오디오

`scripts/01_youtube_downloader.py`가 받은 오디오가 여기 쌓입니다.

| 파일 | 용도 | git |
| :--- | :--- | :--- |
| `audio_N.wav` | STT(`02`)에 쓰는 원본 (무압축) | ❌ 미추적 — 용량 커서 **로컬 전용** |
| `audio_N.opus` | `01`이 만든 압축본(~32kbps, wav의 1/40) | ✅ **LFS로 보관** (원본 영상 삭제 대비 아카이브) |

재현: `00_url_list.txt`의 URL로 `01`을 돌리면 wav+opus가 생깁니다. opus만 받아도 `02`(faster-whisper)로 재STT 가능합니다.
