# 🎯 감정 분석 모델 선정 결과

## 📊 최종 선정 모델

| 모델 | 최적 Threshold | F1 Score | 선정 |
|------|----------------|----------|------|
| **UnSmile** | **16.26%** | **89.51%** | ✅ **선정** |
| Korean Sentiment | 86.65% | 86.09% | 대안 |

---

## 🏆 UnSmile 모델 상세

```
모델: smilegate-ai/kor_unsmile
최적 Threshold: 16.26%
F1 Score: 89.51%
Precision: 94.1%
Recall: 85.3%
Accuracy: 93.3%
```

**특징:**
- 한국어 혐오 발언 탐지 전용 모델
- Precision 94% = 욕설로 판단한 것의 94%가 진짜 욕설
- 게임 저주 시스템에 적합

---

## 🔧 트러블슈팅 기록

### 1. 라벨 매핑 문제
**증상:** 모든 모델에서 F1 50% 고정
**원인:** 모델별 라벨 의미가 다름
```python
# Korean Sentiment: LABEL_0 = 부정 (LABEL_1 아님!)
# UnSmile: "악플/욕설" = 부정
# KoELECTRA: "negative" = 부정
```
**해결:** MODEL_NEGATIVE_LABELS 매핑 테이블 추가

### 2. 욕설확률 표시 혼란
**증상:** 같은 문장이 모델마다 다른 %로 표시
**원인:** 라벨별로 score 해석이 다름
**해결:** curse_score로 통일 (100% = 욕설)

### 3. KoELECTRA 시리즈 성능 저조
**증상:** F1 50~60%, 모든 출력이 50% 근처
**원인:** Fine-tuning 안 된 base 모델
**결론:** 사용 불가, Fine-tuning 필요

### 4. Threshold 이해
**증상:** 1% threshold에서 F1 50%가 왜?
**원인:** 모든 문장을 욕설로 판단 → TP 100%, FP 100%
**결론:** 정상 동작, 모델 출력 자체가 50% 근처

---

## ❌ 제외된 모델들

| 모델 | 문제 | 상태 |
|------|------|------|
| KoELECTRA Small | Fine-tuning 안 됨 | 사용 불가 |
| KoELECTRA Base | Fine-tuning 안 됨 | 사용 불가 |
| KcELECTRA v2 | Fine-tuning 안 됨 | 사용 불가 |
| Multilingual | 한국어 성능 부족 | 대안 없음 |

---

## 🚀 다음 단계

1. **UnSmile 브라우저 통합** - Transformers.js로 변환
2. **Threshold 16.26% 적용** - 게임에서 사용
3. **(선택) Fine-tuning** - 게임 데이터로 추가 학습
