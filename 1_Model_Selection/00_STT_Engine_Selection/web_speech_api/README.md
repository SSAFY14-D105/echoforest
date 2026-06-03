# web_speech_api — 런타임 STT(Web Speech API) 재현 도구 & 정성 샘플

런타임에서 채택한 STT 엔진 **Google Web Speech API**(브라우저 `webkitSpeechRecognition`)를 **직접 돌려보는 도구**와, 그 **정성 출력 샘플**입니다. 선정 근거·리스크는 [`../STT_COMPARISON.md`](../STT_COMPARISON.md).

## 🧪 진짜 측정값은 여기서 — `test_web_speech.html`

**크롬에서** 열고(파일 더블클릭) 마이크 허용 후 말해 보면:

- 한국어 **실시간 인식**(중간 interim / 확정 final)
- **첫 응답 지연(ms)** = 발화 시작→첫 중간결과(스트리밍 응답성, 보통 수백 ms) · 평균 문장 간격 · 단어 수
- 욕설이 **검열 없이 원문 인식**되는지

> 이게 이 폴더에서 **유일하게 재현 가능한 정량 지표**(지연·confidence)다. Chrome/Edge 전용, 로컬 파일로 바로 동작(마이크 필요).

## 📄 정성 샘플 — `webspeech_sample_*.txt` (⚠️ 지표 아님)

한 게임플레이 음성을 Web Speech로 받아본 **원본 출력**입니다. **무엇을 의미하고 무엇이 아닌지** 정직하게:

- ✅ **보여주는 것**: Web Speech가 한국어 구어체 + **욕설(시발/개새끼/좆됐다 등)을 검열 없이** 받아적는다 → 욕설탐지 입력으로 적합하다는 **정성 증거**.
- ❌ **아닌 것 (정확도 지표 ❌)**: **정답(ground-truth) 전사가 없어** WER/정확도를 못 잰다.
- ❌ **파이프라인 audio_1과 무관**: 이 음성은 **좀비 서바이벌 게임** 플레이로, `02_stt`의 audio_1(**피코파크**)과 **다른 영상**이다. → train/serve 비교(같은 음성 페어)엔 못 씀.
- ⚠️ **"interval"은 Web Speech 설정이 아님**: 200/300/500ms는 캡처 코드의 **commit 주기**일 뿐. 줄 수·중복(중간결과 재기록)만 바뀌고 *엔진 정확도와는 무관*하다.

| 파일 | 캡처 commit 주기 |
| :--- | :--- |
| `webspeech_sample_default.txt` | 기본(throttle 없음 → interim 중복 많음) |
| `webspeech_sample_200ms.txt` | 200ms |
| `webspeech_sample_300ms.txt` | 300ms |
| `webspeech_sample_500ms.txt` | 500ms |

## 한계와 다음 단계

Web Speech는 블랙박스(VAD·빔서치 튜닝 불가)지만 런타임 STT엔 그 튜닝이 불필요하다(텍스트만 확보). 다만 **학습=whisper / 런타임=web-speech** 라는 **train/serve skew**가 미측정 리스크로 남아 있다 — 측정 절차는 [`../STT_COMPARISON.md` §4](../STT_COMPARISON.md) 참고. 정확도가 생명인 학습데이터 수집엔 faster-whisper를 따로 쓴다([`../../../0_Data_Collection/02_stt`](../../../0_Data_Collection/02_stt)).
