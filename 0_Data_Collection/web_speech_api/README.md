# web_speech_api — 브라우저 STT 실험 기록

faster-whisper를 채택하기 **전에**, 브라우저 Web Speech API(Google 엔진)로 같은 오디오를 STT 돌려본 비교 기록입니다. 인식 간격(interval)별 출력 차이를 보려고 남겼습니다.

| 파일 | 설정 |
| :--- | :--- |
| `01_audio_1_google.txt` | 기본 |
| `audio_1_google200ms.txt` | 200ms 간격 |
| `audio_1_google_300ms.txt` | 300ms 간격 |
| `02_audio_1_google_500ms.txt` | 500ms 간격 |

> 결론: 발화 누락·문장 끊김이 커서 최종은 **faster-whisper large-v3**(`scripts/02_whisper_transcriber.py`)로 결정. 기록용입니다.
