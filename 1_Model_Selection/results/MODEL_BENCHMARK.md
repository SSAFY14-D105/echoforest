# 🎮 6개 모델 벤치마크 결과

## 📊 테스트 환경
- **테스트 데이터**: `game_test.tsv` (187건)
- **테스트 일시**: 2026-02-08 17:30
- **데이터 출처**: 협동 게임 STT + 유튜브 협동게임 STT

---

## 🏆 결과 요약

| 모델 | Abuse Recall | Abuse F1 | 선정 |
|------|:------------:|:--------:|:----:|
| UnSmile | **66.38%** | 78.97% | ✅ |
| Multilingual | **60.34%** | 60.87% |  |
| KcELECTRA v2 | **42.24%** | 54.14% |  |
| KoELECTRA Small | **29.31%** | 40.00% |  |
| KoELECTRA Base | **14.66%** | 22.22% |  |

---

## 🎯 UnSmile 선정 이유

### 1. 최고 성능
- **Abuse Recall**: 66.38% (6개 모델 중 1위)
- **Abuse F1**: 78.97%

### 2. 한국어 혐오 발언 전용
- Smilegate AI에서 개발한 **한국어 혐오 발언 탐지** 전용 모델
- 댓글/채팅 데이터로 학습되어 게임 대화에 적합

### 3. 다른 모델 한계
- **KoELECTRA 계열**: Fine-tuning 안 된 베이스 모델 → 성능 저조
- **Korean Sentiment**: 일반 감정 분석 → 욕설 특화 X
- **Multilingual**: 한국어 성능 부족

---

## 📈 시각화

### 6개 모델 비교
![6 Model Comparison](./6_model_comparison.png)

### 베스트 모델 선정
![Best Model Selection](./best_model_selection.png)

---

## 📋 상세 결과

| 모델 | TP | TN | FP | FN | Precision | Recall |
|------|:--:|:--:|:--:|:--:|:---------:|:------:|
| KoELECTRA Small | 34 | 51 | 20 | 82 | 63.0% | 29.3% |
| KoELECTRA Base | 17 | 51 | 20 | 99 | 45.9% | 14.7% |
| Multilingual | 70 | 27 | 44 | 46 | 61.4% | 60.3% |
| UnSmile | 77 | 69 | 2 | 39 | 97.5% | 66.4% |
| KcELECTRA v2 | 49 | 55 | 16 | 67 | 75.4% | 42.2% |

---

## 🚀 다음 단계
1. UnSmile 기반으로 **게임 STT 데이터로 Fine-tuning**
2. LoRA vs Full Fine-tuning 비교
3. 최적 모델 INT8 양자화
