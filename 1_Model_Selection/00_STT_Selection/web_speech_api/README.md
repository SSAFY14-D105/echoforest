# web_speech_api — STT 엔진 비교의 v2 원본 출력

옆 문서 [`../STT_COMPARISON.md`](../STT_COMPARISON.md)가 STT를 3안(로컬 Whisper / **Google Web Speech** / faster-whisper 서버)으로 비교하는데, 이 폴더는 그중 **v2(Google Web Speech API)** 를 실제로 돌려본 원본 출력입니다. 인식 간격(interval)별 출력 차이를 보려고 남겼습니다.

| 파일 | 설정 |
| :--- | :--- |
| `01_audio_1_google.txt` | 기본 |
| `audio_1_google200ms.txt` | 200ms 간격 |
| `audio_1_google_300ms.txt` | 300ms 간격 |
| `02_audio_1_google_500ms.txt` | 500ms 간격 |

> 결론: Web Speech는 빠르지만 **블랙박스라 튜닝 불가**(VAD·빔서치 등) → 최종은 **faster-whisper (Python AI 서버)** 채택. 자세한 근거는 [`../STT_COMPARISON.md`](../STT_COMPARISON.md).
