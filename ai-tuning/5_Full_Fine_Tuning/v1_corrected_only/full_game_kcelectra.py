"""
=============================================================================
EchoForest AI - Full Fine-tuning (Game-optimized / 게임 환경 최적화)
=============================================================================
게임 음성채팅 환경에 최적화된 Full Fine-tuning
- 모델: beomi/KcELECTRA-base-v2022 (한국어 최적화)
- 메트릭: abuse_recall (악플 탐지율)
- 방식: Full Fine-tuning (모든 파라미터 학습)
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
    EarlyStoppingCallback
)
from sklearn.metrics import precision_recall_fscore_support, accuracy_score, label_ranking_average_precision_score
from datasets import Dataset
import warnings
warnings.filterwarnings('ignore')
from transformers import set_seed; set_seed(42)  # 재현성 시드 고정(기존 커밋 산출물은 시드 없이 학습됨)

# =============================================================================
# 설정
# =============================================================================
MODEL_NAME = "beomi/KcELECTRA-base-v2022"
OUTPUT_DIR = "./output/full_game_kcelectra"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

EPOCHS = 5
BATCH_SIZE = 16
LEARNING_RATE = 2e-5
WARMUP_RATIO = 0.1
WEIGHT_DECAY = 0.01
MAX_LENGTH = 128

LABEL_NAMES = ["여성/가족", "남성", "성소수자", "인종/국적", "연령",
               "지역", "종교", "기타 혐오", "악플/욕설", "clean"]
NUM_LABELS = len(LABEL_NAMES)

print("=" * 60)
print("🎮 Full Fine-tuning (Game-optimized / KcELECTRA)")
print("=" * 60)
print(f"Device: {DEVICE}")
print(f"Model: {MODEL_NAME}")
print(f"Metric: abuse_recall")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
print("=" * 60)

# =============================================================================
# 데이터 로드 및 전처리
# =============================================================================
print("\n[1/4] 데이터 로딩...")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
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
# 모델
# =============================================================================
print("\n[2/4] 모델 로딩...")
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, num_labels=NUM_LABELS, problem_type="multi_label_classification"
)
model.config.id2label = {i: l for i, l in enumerate(LABEL_NAMES)}
model.config.label2id = {l: i for i, l in enumerate(LABEL_NAMES)}
model = model.to(DEVICE)

total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"✓ 전체 파라미터: {total_params:,}, 학습 가능: {trainable_params:,} (100%)")

# =============================================================================
# 메트릭
# =============================================================================
def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    probs = torch.sigmoid(torch.tensor(predictions)).numpy()
    preds = (probs > 0.5).astype(int)
    labels_int = labels.astype(int)
    
    abuse_p, abuse_r, abuse_f1, _ = precision_recall_fscore_support(labels_int[:,8], preds[:,8], average='binary', zero_division=0)
    clean_p, clean_r, clean_f1, _ = precision_recall_fscore_support(labels_int[:,9], preds[:,9], average='binary', zero_division=0)
    lrap = label_ranking_average_precision_score(labels, predictions)
    
    return {'lrap': lrap, 'abuse_recall': abuse_r, 'abuse_f1': abuse_f1,
            'clean_recall': clean_r, 'clean_f1': clean_f1}

# =============================================================================
# 학습
# =============================================================================
print("\n[3/4] 학습 시작...")
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR, num_train_epochs=EPOCHS, per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE, learning_rate=LEARNING_RATE,
    warmup_ratio=WARMUP_RATIO, weight_decay=WEIGHT_DECAY,
    eval_strategy="epoch", save_strategy="epoch", load_best_model_at_end=True,
    metric_for_best_model="abuse_recall", greater_is_better=True,
    logging_steps=100, save_total_limit=2, report_to="none", fp16=True,
)

trainer = Trainer(
    model=model, args=training_args, train_dataset=train_dataset, eval_dataset=valid_dataset,
    tokenizer=tokenizer, compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=2)]
)
trainer.train()

# =============================================================================
# 저장
# =============================================================================
print("\n[4/4] 모델 저장...")
trainer.save_model(f"{OUTPUT_DIR}/best_model")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/best_model")

eval_results = trainer.evaluate()
with open(f"{OUTPUT_DIR}/results.txt", 'w', encoding='utf-8') as f:
    f.write(f"=== Full FT Game-optimized (KcELECTRA) ===\n")
    for k, v in eval_results.items(): f.write(f"{k}: {v:.4f}\n")

print("\n" + "=" * 60)
print("📊 결과:", {k: f"{v:.4f}" for k, v in eval_results.items()})
print("✅ 완료!")
