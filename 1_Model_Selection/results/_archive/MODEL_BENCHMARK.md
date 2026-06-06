# 🎮 6개 모델 벤치마크 결과

> ⚠️ 이 결과는 **구 `test_set`(688건) 기준**(2026-06-03 측정). 현 `test_set`은 **482로 재정제**됨 → 482 기준 재평가 대기. 구 688판: `../../0_Data_Collection/datasets/_archive/test_set_688_backup.tsv`.

## 📊 테스트 환경
- **테스트 데이터**: `test_set.tsv` (당시 688건판, held-out)
- **테스트 일시**: 2026-06-03 16:12
- **데이터 출처**: 협동 게임 STT + 유튜브 협동게임 STT

---

## 🏆 결과 요약

| 모델 | Abuse Recall | Abuse F1 | 선정 |
|------|:------------:|:--------:|:----:|
| UnSmile | **66.51%** | 74.87% | ✅ |
| KoELECTRA Small | **86.98%** | 43.79% |  |
| Multilingual | **68.84%** | 41.51% |  |
| KcELECTRA v2 | **28.84%** | 33.70% |  |
| KoELECTRA Base | **36.28%** | 28.31% |  |

---

## 🎯 UnSmile 선정 이유

### 1. 최고 성능 (선정 기준: Abuse F1)
- **Abuse F1**: 74.87% (모델 중 1위)
- **Abuse Precision**: 85.63% · **Recall**: 66.51%
- **Accuracy**: 86.05% · **Clean F1**: 90.34%

> ⚠️ 선정은 Recall이 아니라 **F1 기준**. 단순 Recall 최대 모델은 거의 모든 문장을 욕설로 분류해(Precision↓·오탐↑) 실사용 불가 → 균형 지표로 선정.

### 2. 한국어 혐오 발언 전용
- Smilegate AI의 **한국어 혐오 발언 탐지** 전용 모델, 댓글/채팅 학습 → 게임 대화에 적합

### 3. 다른 모델 한계
- **KoELECTRA / Multilingual**: 베이스 모델 → over-flagging으로 Precision 저조
- **KcELECTRA v2**: 일반 도메인 → 게임 욕설 특화 부족

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
| KoELECTRA Small | 187 | 21 | 452 | 28 | 29.3% | 87.0% |
| KoELECTRA Base | 78 | 215 | 258 | 137 | 23.2% | 36.3% |
| Multilingual | 148 | 123 | 350 | 67 | 29.7% | 68.8% |
| UnSmile | 143 | 449 | 24 | 72 | 85.6% | 66.5% |
| KcELECTRA v2 | 62 | 382 | 91 | 153 | 40.5% | 28.8% |

---

## 🚀 다음 단계
1. UnSmile 기반으로 **게임 STT 데이터로 Fine-tuning**
2. LoRA vs Full Fine-tuning 비교
3. 최적 모델 INT8 양자화
