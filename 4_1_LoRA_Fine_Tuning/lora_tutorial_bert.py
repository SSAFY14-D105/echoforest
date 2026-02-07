"""
=============================================================================
EchoForest AI - LoRA Fine-tuning (Tutorial-based / 튜토리얼 기반)
=============================================================================
공식 Smilegate UnSmile 튜토리얼 기반 LoRA Fine-tuning
- 모델: beomi/kcbert-base
- 메트릭: LRAP (Label Ranking Average Precision)
- 방식: LoRA (Parameter-Efficient Fine-Tuning)
=============================================================================
"""

import os
import torch
import pandas as pd
import numpy as np
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding
)
from peft import LoraConfig, get_peft_model, TaskType
from sklearn.metrics import label_ranking_average_precision_score
from datasets import Dataset
import warnings
warnings.filterwarnings('ignore')

# =============================================================================
# 설정
# =============================================================================
MODEL_NAME = "beomi/kcbert-base"
OUTPUT_DIR = "./output_tutorial_lora"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

EPOCHS = 5
BATCH_SIZE = 32
LEARNING_RATE = 2e-4
MAX_LENGTH = 128

LORA_R = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.1

LABEL_NAMES = ["여성/가족", "남성", "성소수자", "인종/국적", "연령",
               "지역", "종교", "기타 혐오", "악플/욕설", "clean"]
NUM_LABELS = len(LABEL_NAMES)

print("=" * 60)
print("🎓 LoRA Fine-tuning (Tutorial-based / beomi/kcbert-base)")
print("=" * 60)
print(f"Device: {DEVICE}")
print(f"Model: {MODEL_NAME}")
print(f"LoRA Rank: {LORA_R}, Alpha: {LORA_ALPHA}")
print(f"Metric: LRAP")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
print("=" * 60)

# =============================================================================
# 데이터 로드 및 전처리
# =============================================================================
print("\n[1/4] 데이터 로딩...")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
TRAIN_PATH = os.path.join(BASE_DIR, "3_UnSmile_Correction", "unsmile_train_corrected.tsv")
VALID_PATH = os.path.join(BASE_DIR, "3_UnSmile_Correction", "unsmile_valid_corrected.tsv")

train_df = pd.read_csv(TRAIN_PATH, sep='\t', encoding='utf-8')
valid_df = pd.read_csv(VALID_PATH, sep='\t', encoding='utf-8')
print(f"✓ Train: {len(train_df)}개, Valid: {len(valid_df)}개")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def preprocess_function(examples):
    tokenized = tokenizer(examples['문장'], padding='max_length', truncation=True, max_length=MAX_LENGTH)
    labels = [[float(examples[col][i]) for col in LABEL_NAMES] for i in range(len(examples['문장']))]
    tokenized['labels'] = labels
    return tokenized

train_dataset = Dataset.from_pandas(train_df).map(preprocess_function, batched=True, remove_columns=train_df.columns.tolist())
valid_dataset = Dataset.from_pandas(valid_df).map(preprocess_function, batched=True, remove_columns=valid_df.columns.tolist())

# =============================================================================
# 모델 + LoRA
# =============================================================================
print("\n[2/4] 모델 로딩 및 LoRA 적용...")
base_model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, num_labels=NUM_LABELS, problem_type="multi_label_classification"
)
base_model.config.id2label = {i: l for i, l in enumerate(LABEL_NAMES)}
base_model.config.label2id = {l: i for i, l in enumerate(LABEL_NAMES)}

peft_config = LoraConfig(
    task_type=TaskType.SEQ_CLS, r=LORA_R, lora_alpha=LORA_ALPHA,
    lora_dropout=LORA_DROPOUT, target_modules=["query", "key", "value"], bias="none"
)
model = get_peft_model(base_model, peft_config).to(DEVICE)
model.print_trainable_parameters()

# =============================================================================
# 메트릭
# =============================================================================
def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    return {'lrap': label_ranking_average_precision_score(labels, predictions)}

# =============================================================================
# 학습
# =============================================================================
print("\n[3/4] 학습 시작...")
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR, num_train_epochs=EPOCHS, per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE, learning_rate=LEARNING_RATE,
    eval_strategy="epoch", save_strategy="epoch", load_best_model_at_end=True,
    metric_for_best_model="lrap", greater_is_better=True,
    logging_steps=100, save_total_limit=2, report_to="none", fp16=True,
)

trainer = Trainer(
    model=model, args=training_args, train_dataset=train_dataset, eval_dataset=valid_dataset,
    tokenizer=tokenizer, compute_metrics=compute_metrics,
    data_collator=DataCollatorWithPadding(tokenizer=tokenizer)
)
trainer.train()

# =============================================================================
# 저장
# =============================================================================
print("\n[4/4] 모델 저장...")
model.save_pretrained(f"{OUTPUT_DIR}/lora_adapter")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/lora_adapter")
merged_model = model.merge_and_unload()
merged_model.save_pretrained(f"{OUTPUT_DIR}/merged_model")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/merged_model")

eval_results = trainer.evaluate()
with open(f"{OUTPUT_DIR}/results.txt", 'w', encoding='utf-8') as f:
    f.write(f"=== LoRA Tutorial-based (klue/bert-base) ===\n")
    for k, v in eval_results.items(): f.write(f"{k}: {v:.4f}\n")

print("\n" + "=" * 60)
print("📊 결과:", {k: f"{v:.4f}" for k, v in eval_results.items()})
print("✅ 완료!")
