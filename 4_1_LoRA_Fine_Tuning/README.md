# 4_1_LoRA_Fine_Tuning

LoRA (Low-Rank Adaptation) 기반 Parameter-Efficient Fine-Tuning

## 📁 디렉토리 구조

### v1_corrected_only/ (보정 데이터만 사용)
- **데이터**: UnSmile 보정 데이터 (10,490건)
- `lora_game_kcelectra.ipynb` - KcELECTRA + abuse_recall
- `lora_tutorial_kcbert.ipynb` - kcbert-base + LRAP
- `.py` 스크립트 버전 포함

### v2_corrected_plus_collected/ (보정 + 수집 데이터)
- **데이터**: UnSmile 보정 (10,490) + 게임 음성채팅 수집 (519) = **11,009건**
- `lora_game_kcelectra_v2.ipynb` - KcELECTRA + abuse_recall
- `lora_tutorial_kcbert_v2.ipynb` - kcbert-base + LRAP

## 🔧 LoRA 설정

```python
LORA_R = 16        # Rank
LORA_ALPHA = 32    # Scaling
LORA_DROPOUT = 0.1
target_modules = ["query", "key", "value"]
```

## 📊 모델 비교

| 버전 | 모델 | 메트릭 | 데이터 |
|------|------|--------|--------|
| v1 Game | KcELECTRA | abuse_recall | 보정 10,490건 |
| v1 Tutorial | kcbert-base | LRAP | 보정 10,490건 |
| v2 Game | KcELECTRA | abuse_recall | 보정+수집 11,009건 |
| v2 Tutorial | kcbert-base | LRAP | 보정+수집 11,009건 |

## 🚀 실행 환경
- GPU: NVIDIA L40S (48GB)
- Python 3.12.6
- torch 2.5.1+cu121
- CUDA 12.1
