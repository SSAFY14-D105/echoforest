# 🎭 02_Sentiment_Analysis

게임 내 유저 발화의 **감정/문맥 분석**을 위한 NLP 모델 평가 및 실험 폴더입니다.

## 🎯 목표

브라우저(WebGPU)에서 실행 가능한 경량 NLP 모델을 찾기 위해:
- 다양한 모델의 **정확도(Accuracy)** 비교
- **레이턴시(Latency)** 측정
- **메모리 사용량** 확인
- 한국어 **부정적 문맥** 인식률 테스트

## 📂 폴더 구조

```
02_Sentiment_Analysis/
├── README.md              # 현재 파일
├── CONTEXT.md             # 왜 감정 분석이 필요한가
├── evaluation_guide.md    # 평가 방법론 및 지표 정의
├── results/               # 실험 결과 저장
│   └── TEMPLATE.md        # 결과 기록 템플릿
└── models/                # 모델별 테스트
    ├── 01_DistilKoBERT/
    ├── 02_MobileBERT/
    └── 03_TinyBERT/
```

## 🚀 Quick Start

1. 평가 방법 확인: [`evaluation_guide.md`](./evaluation_guide.md)
2. 실험 결과 기록: [`results/TEMPLATE.md`](./results/TEMPLATE.md) 복사 후 작성
3. 모델별 테스트: `models/` 폴더에서 진행

## 📊 평가 대상 모델

| 모델 | 예상 크기 | 한국어 | 상태 |
|------|----------|--------|------|
| DistilKoBERT | ~65MB (양자화) | ✅ | 🔲 미테스트 |
| MobileBERT | ~25MB (양자화) | ⚠️ 영어 | 🔲 미테스트 |
| TinyBERT | ~15MB (양자화) | ⚠️ 영어 | 🔲 미테스트 |

## 📖 관련 문서

- 프로젝트 전체 개요: [`../CONTEXT.md`](../CONTEXT.md)
- STT 관련: [`../01_STT/`](../01_STT/)
