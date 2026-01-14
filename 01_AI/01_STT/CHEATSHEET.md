# 🚀 서버 실행 명령어 모음 (CHEATSHEET)

매번 경로 찾느라 고생하지 마세요! 이 파일만 열어서 **복사 붙여넣기** 하세요.

---

## 1. 🟢 v3 AI 서버 (메인 요리사)
*   **용도**: 실제 게임/테스트에 사용되는 고성능 서버.
*   **실행법**:
```bash
# 터미널 1
cd 02_Gunho/01_STT/03_FastAPI
conda activate ai-server
uvicorn app.main:app
```

## 2. 🔴 v1 데모 서버 (보조 알바)
*   **용도**: `demo_launcher.html`에서 v1(빨간색) 버튼 누를 때 필요.
*   **실행법**:
```bash
# 터미널 2 (새 터미널 열기)
cd 02_Gunho/01_STT/99_Archive/01_Local_Whisper
python -m http.server 8080
```

## 3. 🎮 데모 런처 열기 (메뉴판)
*   **용도**: 모든 데모를 한눈에 보고 실행.
*   **실행법**:
```bash
cd 02_Gunho/01_STT
start demo_launcher.html
```
