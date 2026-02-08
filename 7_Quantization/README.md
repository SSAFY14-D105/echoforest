# 7. 모델 양자화 (Model Quantization)

Best 모델을 INT8 양자화하여 추론 최적화를 수행합니다.

---

## 🎯 양자화 대상 모델

| 항목 | 값 |
|------|------|
| **모델명** | Full v2 Tutorial (kcbert-base) |
| **경로** | `../4_2_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_tutorial_kcbert_v2/best_model` |
| **토크나이저** | beomi/kcbert-base |
| **양자화 방식** | INT8 Dynamic Quantization |

---

## 📊 분석 항목

| 분석 | 설명 |
|------|------|
| **모델 크기** | 원본 vs 양자화 MB 비교 |
| **추론 속도** | CPU 100회 평균 (ms) |
| **Abuse 메트릭** | Precision, Recall, F1 |
| **Clean 메트릭** | Precision, Recall, F1 |
| **라벨별 성능** | 10개 라벨 각각 F1 비교 |
| **Confusion Matrix** | Abuse 탐지 혼동 행렬 |

---

## 📁 디렉토리 구조

```
7_Quantization/
├── README.md                       # 이 문서
├── quantize_model.ipynb            # 양자화 노트북 (Colab 실행)
├── quantize_model_enhanced.py      # Python 스크립트 버전
├── quantized_model/                # 양자화된 모델 저장
│   ├── model_int8.pt
│   ├── config.json
│   └── tokenizer files...
└── results/                        # 분석 결과
    ├── README.md                   # 결과 설명
    ├── quantization_dashboard.png  # 메인 대시보드 (6-panel)
    ├── confusion_matrices.png      # Confusion Matrix
    ├── quantization_results.csv    # 주요 메트릭 요약
    ├── per_label_metrics.csv       # 라벨별 상세 메트릭
    └── quantization_report.json    # JSON 리포트
```

---

## 🔧 실행 방법

1. `quantize_model.ipynb`를 Colab 환경에서 실행
2. 모든 셀 순차 실행
3. `results/` 폴더에 분석 결과 자동 저장
4. `quantized_model/` 다운로드 후 AI 서버 배포

---

## ✅ 성공 기준

| 조건 | 판정 |
|------|------|
| Abuse Recall 차이 < 1% | ✅ 성공 (성능 손실 없음) |
| Abuse Recall 차이 < 2% | ✅ 성공 (미미한 손실) |
| Abuse Recall 차이 ≥ 2% | ⚠️ 검토 필요 |

---

## 📈 예상 결과

| 항목 | Before | After (예상) | 개선 |
|------|:------:|:------------:|:----:|
| 모델 크기 | ~420MB | ~150MB | 2.8x 압축 |
| 추론 속도 | ~50ms | ~30ms | 1.7x 빠름 |
| Abuse Recall | - | - | < 2% 손실 |
