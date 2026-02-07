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

### 1. 데이터 분리
```
수집 데이터 (518건)
├── Train: 414건 (80%) → v2 학습에 사용
└── Test:  104건 (20%) → 9개 모델 비교용
```

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

## 📈 결과 (작성 예정)

| 모델 | LRAP | Abuse Recall | Abuse F1 | 비고 |
|------|------|--------------|----------|------|
| kor_unsmile (Baseline) | - | - | - | |
| LoRA v1 Game | - | - | - | |
| LoRA v2 Game | - | - | - | |
| Full FT v1 Game | - | - | - | |
| ... | | | | |

---

## 🎯 목표

**"게임 데이터로 Fine-tuning 후 Abuse Recall이 XX% 개선"** 증명
