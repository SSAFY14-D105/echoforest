# 4_2_Full_Fine_Tuning

Full Fine-Tuning 기반 모든 파라미터 학습 스크립트

## 📁 스크립트

| 파일명 | 모델 | 메트릭 | 설명 |
|--------|------|--------|------|
| `full_game_kcelectra.py` | KcELECTRA-base-v2022 | abuse_recall | 게임 환경 최적화 (한국어) |
| `full_tutorial_bert.py` | beomi/kcbert-base | LRAP | 공식 튜토리얼 기반 |

### 📓 Jupyter 노트북 (외부 GPU 환경용)

| 파일명 | 모델 | 메트릭 | 설명 |
|--------|------|--------|------|
| `full_game_kcelectra.ipynb` | KcELECTRA-base-v2022 | abuse_recall | L40S GPU 최적화 |
| `full_tutorial_kcbert.ipynb` | beomi/kcbert-base | LRAP | 튜토리얼 기반 |

## 🔧 학습 설정

```python
# 게임 환경 최적화
EPOCHS = 5
BATCH_SIZE = 16
LEARNING_RATE = 2e-5
WARMUP_RATIO = 0.1
WEIGHT_DECAY = 0.01

# 튜토리얼 기반
EPOCHS = 5
BATCH_SIZE = 32
LEARNING_RATE = 2e-5
```

## ▶️ 실행 방법

```bash
# Conda 환경 활성화
conda activate echoforest_ft

# 게임 환경 최적화 버전 실행
python full_game_kcelectra.py

# 튜토리얼 기반 버전 실행
python full_tutorial_bert.py
```

## 📊 출력 폴더

- `output_game_full/` - 게임 최적화 Full FT 결과
- `output_tutorial_full/` - 튜토리얼 기반 Full FT 결과

## ⚠️ 주의사항

- Full Fine-tuning은 모든 파라미터를 학습하므로 **GPU 메모리가 많이 필요**합니다.
- VRAM 8GB 이상 권장
- 메모리 부족 시 BATCH_SIZE를 줄이세요.
