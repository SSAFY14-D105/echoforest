# 4_1_LoRA_Fine_Tuning

LoRA (Low-Rank Adaptation) 기반 Parameter-Efficient Fine-Tuning 스크립트

## 📁 스크립트

| 파일명 | 모델 | 메트릭 | 설명 |
|--------|------|--------|------|
| `lora_game_kcelectra.py` | KcELECTRA-base-v2022 | abuse_recall | 게임 환경 최적화 (한국어) |
| `lora_tutorial_bert.py` | beomi/kcbert-base | LRAP | 공식 튜토리얼 기반 |

### 📓 Jupyter 노트북 (외부 GPU 환경용)

| 파일명 | 모델 | 메트릭 | 설명 |
|--------|------|--------|------|
| `lora_game_kcelectra.ipynb` | KcELECTRA-base-v2022 | abuse_recall | L40S GPU 최적화 |
| `lora_tutorial_kcbert.ipynb` | beomi/kcbert-base | LRAP | 튜토리얼 기반 |

## 🔧 LoRA 설정

```python
LORA_R = 16        # Rank
LORA_ALPHA = 32    # Scaling
LORA_DROPOUT = 0.1
target_modules = ["query", "key", "value"]
```

## ▶️ 실행 방법

```bash
# Conda 환경 활성화
conda activate echoforest_ft

# 게임 환경 최적화 버전 실행
python lora_game_kcelectra.py

# 튜토리얼 기반 버전 실행
python lora_tutorial_bert.py
```

## 📊 출력 폴더

- `output_game_lora/` - 게임 최적화 LoRA 결과
- `output_tutorial_lora/` - 튜토리얼 기반 LoRA 결과

## 🆚 Full Fine-tuning과 비교

| 항목 | LoRA | Full FT |
|------|------|---------|
| 학습 파라미터 | ~0.5% | 100% |
| 메모리 사용 | 낮음 | 높음 |
| 학습 속도 | 빠름 | 느림 |
| 성능 | 비슷 | 약간 좋음 |
