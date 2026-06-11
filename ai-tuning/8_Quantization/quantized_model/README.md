# Quantized Model Loading Guide

This directory stores the INT8 dynamic-quantized state dict for **Full v2 KcELECTRA**.

Current INT8 status: **not recommended for deployment**.

- 판정 규칙: not-clean (clean 제외 9개 라벨 max sigmoid > 0.5)
- Original Abuse Recall/F1: 0.8548 / 0.8778
- INT8 Abuse Recall/F1: 0.7016 / 0.8150
- INT8 calibrated threshold: 0.26
- INT8 calibrated test Recall/F1: 0.8589 / 0.8894
- FP16 Abuse Recall/F1: 0.8548 / 0.8778

The FP16 artifact in `../fp16_model/` is the recommended compressed artifact when metric
preservation is more important than INT8 CPU speed.

Dynamic quantization changes module classes at runtime, so `model_int8.pt` is not loaded with
`AutoModelForSequenceClassification.from_pretrained()` directly. Recreate the original model,
apply the same dynamic quantization, then load this state dict.

```python
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_PATH = "../../5_Full_Fine_Tuning/v2_corrected_plus_collected/output/full_game_kcelectra_v2/best_model"
INT8_STATE = "model_int8.pt"

torch.backends.quantized.engine = "qnnpack"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH).eval()
quantized_model = torch.ao.quantization.quantize_dynamic(
    model,
    {torch.nn.Linear},
    dtype=torch.qint8,
).eval()
quantized_model.load_state_dict(torch.load(INT8_STATE, map_location="cpu"))

# abuse = sigmoid(logits)[:9].max() > 0.5
```
