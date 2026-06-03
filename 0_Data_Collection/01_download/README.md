# 01_download — YouTube 오디오 다운로드

`01_youtube_downloader.py`가 `00_url_list.txt`의 URL을 yt-dlp로 받아(403 우회) `audio_N.wav`를 만들고, git 보관용 `audio_N.opus`(~32kbps) 압축본도 생성합니다.

| 파일 | git |
| :--- | :--- |
| `audio_N.wav` | ❌ 로컬만(용량) — STT(`02`) 입력용 |
| `audio_N.opus` | ✅ LFS 커밋 (원본 영상 삭제 대비 아카이브) |

다음 단계: `../02_stt`가 이 폴더의 wav를 읽어 STT.
