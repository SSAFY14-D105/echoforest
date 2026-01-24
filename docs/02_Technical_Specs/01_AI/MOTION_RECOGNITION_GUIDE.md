# 🖐️ 모션 인식 구현 명세서 (Local Browser Integration)

이 문서는 **MediaPipe**를 사용하여 브라우저 로컬에서 모션을 인식하는 최적의 방법을 설명합니다.

---

## 1. 핵심 아키텍처 (Processing Model)

STT는 FastAPI로 보냈지만, **모션 인식은 브라우저(Local)**에서 직접 처리합니다.

### ① 왜 모션만 로컬에서 하나요?
- **데이터 크기**: 영상 데이터는 텍스트에 비해 수천 배 큽니다. 서버로 영상을 계속 쏘면 네트워크 과부하로 게임이 불가능해집니다.
- **반응 속도**: 내 움직임이 즉각적으로 반영되어야 하는 게임 특성상, 로컬 처리가 필수적입니다.

### ② Web Worker (Performance)
- 연산 부하가 큰 MediaPipe 로직을 **Web Worker**라는 비서에게 맡겨, 게임의 프레임(FPS) 저하가 없도록 합니다.

### ③ WebGPU/WebGL (Acceleration)
- MediaPipe는 브라우저의 GPU 자원을 활용합니다. 설정에서 `delegate: "GPU"` 옵션을 활성화하여 성능을 극대화합니다.

---

## 2. 개발 절차 (Steps)

1.  **패키지 설치**: `@mediapipe/tasks-vision`
2.  **카메라 스트림 확보**: `navigator.mediaDevices.getUserMedia`
3.  **모델 로딩 (Local/CDN)**: 브라우저가 직접 `.tflite` 모델 파일을 읽어 메모리에 올립니다.
4.  **관절 포인트(Landmarks) 추출**: 33개의 포즈 포인트 혹은 21개의 손 관절 포인트를 실시간으로 뽑아냅니다.
5.  **포즈 판정 로직**: (예: 손하트, 볼하트)
6.  **결과 보고**: 성공 시 **WebSocket**으로 백엔드에 보고합니다.

---

## 3. 백엔드 통신 명세 (WebSocket Packet)

```json
{
  "type": "MOTION_REPORT",
  "subtype": "HEART_DETECTION",
  "payload": {
    "label": "hand_heart",
    "score": 0.95
  }
}
```

---

### 💡 사용자님, 헷갈리지 마세요!
- **STT (분석)**: FastAPI 서버 (원격)
- **모션 (분석)**: 내 브라우저 (로컬)
