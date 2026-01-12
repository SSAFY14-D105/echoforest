# 실패 분석 및 대안: Web Speech API 검증

**현황 분석**:
- **Local Whisper 결과**: 레이턴시 약 1700ms (1.7초), 정확도 낮음.
- **결론**: 실시간 액션 게임(피코파크 류)에는 부적합. "점프" 외쳤는데 1.7초 뒤에 점프하면 사망 확정.

**대안 제안: Web Speech API (Chrome Built-in)**
- **특징**: 크롬 브라우저에 내장된 구글 음성 인식 엔진 사용.
- **장점**:
    1.  **모델 로드 시간 0초**.
    2.  **한국어 인식률 최상** (구글 엔진).
    3.  **레이턴시**: 서버 통신이 있지만 최적화가 잘 되어 있어 Whisper Local보다 빠를 가능성 높음 (약 300~500ms 예상).
- **단점**: 크롬 외 브라우저 호환성 이슈 (하지만 프로젝트용이라면 크롬 권장으로 해결 가능). 인터넷 연결 필수.

## 구현 계획 (수정됨)

### 1단계: index.html 수정
- 기존 `main.js` (Whisper) 대신 `speech_api.js` (Web Speech API) 로드.
- UI는 그대로 사용.

### 2단계: Web Speech API 로직 구현 (`speech_api.js`)
- `window.webkitSpeechRecognition` 사용.
- `continuous = true` (계속 듣기).
- `interimResults = false` (확정된 결과만 처리하여 중복 방지).
- **VAD 불필요**: 브라우저 엔진이 알아서 문장 끊어줌.

### 3단계: 검증 테스트
1.  **반응 속도**: 말 끝난 후 텍스트 뜨는 속도 비교.
2.  **연속 발화**: "점프 점프" 했을 때 따로 인식되는지 확인.
3.  **한국어 정확도**: "뽀뽀", "사랑해" 인식률 확인.

## 디렉토리 구조 (변경)
```
01_WhishperTest/
├── index.html      // 스크립트 소스만 변경
├── speech_api.js   // [NEW] Web Speech API 로직
└── main.js         // [Keep] 비교용 보존
```
