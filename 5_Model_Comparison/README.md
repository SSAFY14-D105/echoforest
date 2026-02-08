# 5. 모델 비교 (Model Comparison)

Fine-tuning 전/후 모델 성능을 비교합니다.

## 📊 비교 대상 (총 9개 모델)

### Baseline (Before Fine-tuning)
| 모델 | 출처 | 설명 |
|------|------|------|
| kor_unsmile | `smilegate-ai/kor_unsmile` | UnSmile 공식 모델 |

### Fine-tuned (After)
| # | 모델명 | 방식 | 베이스 모델 | 데이터 |
|---|--------|------|------------|--------|
| 1 | lora_game_kcelectra | LoRA | KcELECTRA | v1 (보정) |
| 2 | lora_tutorial_kcbert | LoRA | kcbert | v1 (보정) |
| 3 | lora_game_kcelectra_v2 | LoRA | KcELECTRA | v2 (보정+수집) |
| 4 | lora_tutorial_kcbert_v2 | LoRA | kcbert | v2 (보정+수집) |
| 5 | full_game_kcelectra | Full FT | KcELECTRA | v1 (보정) |
| 6 | full_tutorial_kcbert | Full FT | kcbert | v1 (보정) |
| 7 | full_game_kcelectra_v2 | Full FT | KcELECTRA | v2 (보정+수집) |
| 8 | full_tutorial_kcbert_v2 | Full FT | kcbert | v2 (보정+수집) |

---

## 📁 디렉토리 구조

```
5_Model_Comparison/
├── README.md                    # 이 문서
├── test_all_models.ipynb        # 9개 모델 비교 테스트 스크립트
│
├── models/                      # Fine-tuned 모델 저장
│   ├── lora_game_kcelectra/merged_model/
│   ├── lora_tutorial_kcbert/merged_model/
│   ├── lora_game_kcelectra_v2/merged_model/
│   ├── lora_tutorial_kcbert_v2/merged_model/
│   ├── full_game_kcelectra/best_model/
│   ├── full_tutorial_kcbert/best_model/
│   ├── full_game_kcelectra_v2/best_model/
│   └── full_tutorial_kcbert_v2/best_model/
│
├── data/                        # 테스트 데이터
│   ├── game_test.tsv            # 테스트용 (104건, 20%)
│   └── game_train.tsv           # 학습용 (414건, 80%)
│
└── results/                     # 평가 결과
    ├── comparison_results.csv   # 9개 모델 비교 결과
    └── comparison_chart.png     # 시각화 차트
```

### 모델 저장 방법
Jupyter에서 학습 완료 후:
1. `output/xxx/merged_model/` 또는 `output/xxx/best_model/` 폴더 다운로드
2. `5_Model_Comparison/models/xxx/` 에 업로드

---

## 🧪 테스트 방법

### 1. 데이터 구성

| 데이터셋 | 건수 | 용도 |
|---------|------|------|
| UnSmile Train (보정) | 14,690건 | v1/v2 학습 |
| UnSmile Valid (보정) | 3,663건 | 학습 중 Validation |
| 수집 게임 데이터 | 518건 | v2 학습에 **전량 사용** |
| 게임 테스트 데이터 | 별도 | 9개 모델 비교 테스트 |

> **Q: 왜 수집 데이터를 Train/Test로 분리하지 않았나요?**
> 
> **A:** 수집 데이터(518건)는 양이 적어, 최대한 많은 데이터를 학습에 활용했습니다.
> 대신 **실제 게임에서 자주 사용하는 표현**들을 별도로 수집하여 테스트 데이터로 활용합니다.
> 이를 통해 **실제 게임 환경에서의 성능**을 정확히 측정할 수 있습니다.

### 2. 평가 메트릭
| 메트릭 | 설명 |
|--------|------|
| **LRAP** | 전체 라벨 순위 정확도 |
| **Abuse Recall** | 욕설 재현율 (중요!) |
| **Abuse F1** | 욕설 F1 점수 |
| **Clean Recall** | 클린 재현율 |
| **Clean F1** | 클린 F1 점수 |

### 3. 테스트 실행
```bash
# Jupyter에서 test_all_models.ipynb 실행
```

---

## 📈 Validation 결과 (UnSmile Valid 3,663건 기준)

> ⚠️ 이 결과는 **학습 모니터링용**입니다. 실제 게임 성능은 **게임 테스트 데이터**로 평가 필요!

### LoRA Fine-tuning

| 모델 | LRAP | Abuse Recall | Abuse F1 | Clean Recall | Clean F1 | Epochs |
|------|------|--------------|----------|--------------|----------|--------|
| **v1 Game (KcELECTRA)** | 0.8733 | **0.7014** | 0.7005 | 0.7022 | 0.7584 | 7 (Early) |
| v1 Tutorial (kcbert) | 0.8736 | 0.6615 | 0.6937 | 0.6946 | 0.7341 | 10 |
| **v2 Game (KcELECTRA)** | **0.8828** | 0.6950 | 0.7063 | 0.7065 | 0.7613 | 10 |
| v2 Tutorial (kcbert) | 0.8674 | 0.6718 | 0.6740 | 0.7054 | 0.7383 | 10 |

### Full Fine-tuning

| 모델 | LRAP | Abuse Recall | Abuse F1 | Clean Recall | Clean F1 | Epochs |
|------|------|--------------|----------|--------------|----------|--------|
| v1 Game (KcELECTRA) | 0.8727 | 0.6680 | 0.6897 | 0.6871 | 0.7513 | 5 |
| v1 Tutorial (kcbert) | **0.8795** | 0.6602 | 0.6918 | **0.7333** | 0.7565 | 5 |
| v2 Game (KcELECTRA) | 0.8753 | 0.6615 | 0.6913 | 0.7269 | 0.7699 | 5 |
| v2 Tutorial (kcbert) | 0.8772 | 0.6782 | 0.6871 | 0.7172 | 0.7440 | 5 |

### 🏆 핵심 발견
- **Abuse Recall 최고**: LoRA v1 Game (KcELECTRA) - **0.7014**
- **LRAP 최고**: LoRA v2 Game (KcELECTRA) - **0.8828**
- **LoRA가 Full FT보다 Abuse Recall 높음** (0.70 vs 0.66~0.68)

---

## 📊 게임 테스트 결과 (작성 예정)

> 수집한 게임 데이터 104건으로 9개 모델(Baseline + 8개) 비교

| 모델 | LRAP | Abuse Recall | Abuse F1 | 개선율 |
|------|------|--------------|----------|--------|
| kor_unsmile (Baseline) | - | - | - | - |
| LoRA v1 Game | - | - | - | - |
| ... | | | | |
