# 구현 계획서 (v1): Local Whisper

**목표**: 서버 비용 없이 브라우저 내에서 AI(Whisper)를 구동하여 음성 인식 수행.
**기술**: Transformers.js (Whisper-tiny), Web Worker.

## 결과: 실패 (Archive 됨)
- **이유**: 추론 속도가 너무 느림 (약 1.7초).
- **문제점**:
    1.  WebAssembly의 한계로 인한 높은 CPU 점유율.
    2.  게임 플레이 시 프레임 드랍 발생 가능성.
    3.  한국어 인식률이 Tiny 모델이라 낮음.

## 구현 상세
- `index.html`: UI 및 스크립트 로드
- `main.js`: Transformers.js 파이프라인 초기화 및 오디오 처리
- `worker.js`: UI 스레드 차단 방지용 워커 (옵션)
