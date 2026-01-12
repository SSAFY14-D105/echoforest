# 구현 계획서: Python AI Server (v3)

**목표**: RTX 4050 GPU를 활용하여 Web Speech API(0.3s)보다 빠르거나 대등한 **0.2초대 Latency**를 달성하는 자체 AI 서버 구축.
**핵심 기술**: `FastAPI` (웹 서버), `Faster-Whisper` (최적화된 모델), `CUDA` (GPU 가속).

## 1. 프로젝트 구조
```
03_AI_Server/
├── venv/               # 가상환경
├── app/
│   ├── main.py         # FastAPI 진입점 (API 정의)
│   ├── transcriber.py  # Faster-Whisper 로직 분리
│   └── utils.py        # 오디오 처리 유틸리티
├── requirements.txt    # 의존성 목록
└── implementation_plan_v3_ai_server.md  # 본 문서
```

## 2. 구현 단계

### Step 1: 환경 설정 (Environment Setup)
- **Python 3.10+** (필수)
- **CUDA Toolkit 11.8 or 12.x**: `torch`와 호환되는 버전 확인 필요.
- 라이브러리 설치:
  ```bash
  pip install fastapi uvicorn[standard] faster-whisper python-multipart
  # Windows CUDA용 Torch 설치 (User가 직접 해야 할 수도 있음)
  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
  ```

### Step 2: Transcriber 구현 (Core Logic)
- `FasterWhisper` 클래스 사용.
- `model_size="tiny"` (가장 빠름) 또는 `base` (정확도 균형).
- `device="cuda"`, `compute_type="float16"` (RTX 4050 성능 최적화).

### Step 3: API 엔드포인트 구현 (FastAPI)
- `POST /transcribe`:
    - Input: `UploadFile` (audio blob)
    - Logic: 오디오 -> VAD(선택) -> Whisper -> Text
    - Output: JSON `{ "text": "...", "latency": ... }`

## 3. 검증 계획
1.  **GPU 로드 확인**: 서버 로그에 `Device: cuda` 뜨는지 확인.
2.  **Latency 측정**: Postman 또는 `test_client.html`로 요청 보내서 응답 속도 확인.
3.  **한국어 정확도**: "뽀뽀", "사랑해" 등 게임 키워드 인식 확인.
