# web_speech_api — 런타임 STT(Web Speech API) 실측 & 테스트

메아리의 숲이 **런타임에서 실제 채택한 STT 엔진 = Google Web Speech API**(브라우저 `webkitSpeechRecognition`)를 직접 돌려본 자료입니다. 선정 근거는 [`../STT_COMPARISON.md`](../STT_COMPARISON.md).

## 🧪 직접 테스트 — `test_web_speech.html`

**크롬(Chrome)에서** `test_web_speech.html` 을 열고(파일 더블클릭) 마이크 권한을 허용한 뒤 말해 보세요:

- 한국어 **실시간 인식**(중간 interim / 확정 final 결과)
- **첫 응답 지연(ms)**, 평균 문장 간격, 인식 단어 수 측정
- 욕설이 **검열 없이 원문 인식**되는지 확인 (욕설탐지 입력으로 적합한지)

> Chrome/Edge 전용(Web Speech API). Firefox·Safari는 미지원. 로컬 파일로 바로 열어도 동작합니다(마이크 권한 필요).

## 📄 실측 로그 (게임 오디오 `audio_1`)

인식 간격(interval)별 출력 차이를 보려고 남긴 원본 출력입니다.

| 파일 | 설정 |
| :--- | :--- |
| `audio_1_google_default.txt` | 기본 |
| `audio_1_google_200ms.txt` | 200ms 간격 |
| `audio_1_google_300ms.txt` | 300ms 간격 |
| `audio_1_google_500ms.txt` | 500ms 간격 |

## 요점

Web Speech는 **블랙박스라 VAD·빔서치 튜닝은 불가**하지만, 런타임 STT엔 그 튜닝이 필요 없습니다(텍스트만 확보하면 됨). 인식 흔들림은 뒤단 **욕설 분류 모델 fine-tuning**이 흡수합니다. 정확도가 생명인 학습데이터 수집엔 faster-whisper를 따로 씁니다([`../../../0_Data_Collection/02_stt`](../../../0_Data_Collection/02_stt)).
