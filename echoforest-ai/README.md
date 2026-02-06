# 🌲 EchoForest AI

> AI 모델 개발 및 추론 서버

## 📁 디렉토리 구조

| 디렉토리 | 용도 | 상태 |
|----------|------|------|
| [**inference/**](inference/) | AI 추론 서버 (FastAPI) | ✅ 운영 중 |
| **training/** | 모델 학습/파인튜닝 | 🚧 예정 |

---

## 🤖 inference/ - AI 추론 서버

### 핵심 기능
- **혐오 발언 탐지**: Smilegate unSmile 모델 기반
- **심각도별 스택 계산**: critical(+5), severe(+3), mild(+1)
- **배치 처리**: 5초마다 발화를 모아서 한 번에 분석

### 빠른 시작
```bash
cd inference
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 성능 지표
| 지표 | 값 |
|------|-----|
| F1 Score | **0.955** |
| 응답 속도 | ~50ms (CPU) |
| GPU 가속 | ~5ms |

### 상세 문서
- [📖 inference/README.md](inference/README.md) - 전체 설명
- [📂 app/README.md](inference/app/README.md) - 소스 코드
- [🧪 tests/README.md](inference/tests/README.md) - 테스트 도구
- [📡 docs/API_SPEC.md](inference/docs/API_SPEC.md) - API 명세

---

## 📚 training/ - 모델 학습 (예정)

### 계획된 내용
- **LoRA Fine-tuning**: 게임 채팅 특화 모델 학습
- **데이터 파이프라인**: YouTube STT 데이터 수집 및 전처리
- **성능 비교**: LoRA vs Full Fine-tuning

---

## 🔧 기술 스택

| 분류 | 기술 |
|------|------|
| AI 모델 | Smilegate unSmile (BERT 기반) |
| 프레임워크 | PyTorch, Transformers |
| 서버 | FastAPI, Uvicorn |
| 환경 관리 | Conda (Python 3.10) |
