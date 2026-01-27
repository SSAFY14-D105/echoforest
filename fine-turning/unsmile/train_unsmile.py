
import os
import random
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AdamW, get_linear_schedule_with_warmup
from sklearn.metrics import f1_score
from tqdm import tqdm

# Random seed
def seed_everything(seed):
    random.seed(seed)
    os.environ['PYTHONHASHSEED'] = str(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = True

SEED = 42
seed_everything(SEED)

# Device configuration
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'Device: {device}')

# Hyperparameters
BATCH_SIZE = 32
EPOCHS = 5
LEARNING_RATE = 2e-5
MAX_LEN = 128
MODEL_NAME = 'beomi/KcELECTRA-base-v2022'

# Paths (Relative to this script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAIN_FILE = os.path.join(BASE_DIR, 'train', 'unsmile_train_v1.0.tsv')
VALID_FILE = os.path.join(BASE_DIR, 'train', 'unsmile_valid_v1.0.tsv')
RESULT_DIR = os.path.join(BASE_DIR, 'results')

os.makedirs(RESULT_DIR, exist_ok=True)

# Load Data
print("Loading data...")
train_df = pd.read_csv(TRAIN_FILE, sep='\t')
val_df = pd.read_csv(VALID_FILE, sep='\t')

# Labels columns
LABEL_COLUMNS = ['여성/가족', '남성', '성소수자', '인종/국적', '연령', '지역', '종교', '기타 혐오', '악플/욕설', 'clean', '개인지칭']
num_labels = len(LABEL_COLUMNS)
print(f"Labels: {LABEL_COLUMNS}")

# Dataset Class
class UnSmileDataset(Dataset):
    def __init__(self, df, tokenizer, max_len):
        self.texts = df['문장'].values
        self.labels = df[LABEL_COLUMNS].values
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, item):
        text = str(self.texts[item])
        label = self.labels[item]

        encoding = self.tokenizer.encode_plus(
            text,
            add_special_tokens=True,
            max_length=self.max_len,
            return_token_type_ids=False,
            padding='max_length',
            truncation=True,
            return_attention_mask=True,
            return_tensors='pt',
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.float)
        }

# Tokenizer
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

# Data Loaders
train_dataset = UnSmileDataset(train_df, tokenizer, MAX_LEN)
val_dataset = UnSmileDataset(val_df, tokenizer, MAX_LEN)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

# Model
print("Loading model...")
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, 
    num_labels=num_labels, 
    problem_type="multi_label_classification"
)
model.to(device)

# Optimizer & Scheduler
optimizer = AdamW(model.parameters(), lr=LEARNING_RATE, correct_bias=False)
total_steps = len(train_loader) * EPOCHS
scheduler = get_linear_schedule_with_warmup(
    optimizer,
    num_warmup_steps=0,
    num_training_steps=total_steps
)
loss_fn = torch.nn.BCEWithLogitsLoss()

# Training Functions
def train_epoch(model, data_loader, loss_fn, optimizer, device, scheduler):
    model = model.train()
    losses = []
    
    for d in tqdm(data_loader, desc="Training"):
        input_ids = d["input_ids"].to(device)
        attention_mask = d["attention_mask"].to(device)
        targets = d["labels"].to(device)

        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask
        )
        
        loss = loss_fn(outputs.logits, targets)

        losses.append(loss.item())
        loss.backward()
        
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()
    
    return np.mean(losses)

def eval_model(model, data_loader, loss_fn, device):
    model = model.eval()
    losses = []
    preds = []
    real_targets = []
    
    with torch.no_grad():
        for d in tqdm(data_loader, desc="Evaluating"):
            input_ids = d["input_ids"].to(device)
            attention_mask = d["attention_mask"].to(device)
            targets = d["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask
            )
            loss = loss_fn(outputs.logits, targets)
            losses.append(loss.item())
            
            preds.append(torch.sigmoid(outputs.logits).cpu().detach().numpy())
            real_targets.append(targets.cpu().detach().numpy())
            
    return np.mean(losses), np.vstack(preds), np.vstack(real_targets)

# Training Loop
best_f1 = 0

print("Starting training...")
for epoch in range(EPOCHS):
    print(f'Epoch {epoch + 1}/{EPOCHS}')
    
    train_loss = train_epoch(
        model,
        train_loader,
        loss_fn,
        optimizer,
        device,
        scheduler
    )

    val_loss, preds, val_targets = eval_model(
        model,
        val_loader,
        loss_fn,
        device
    )

    # Threshold 0.5
    final_preds = (preds > 0.5).astype(int)
    val_f1 = f1_score(val_targets, final_preds, average='macro')

    print(f'Train loss {train_loss:.4f} | Val loss {val_loss:.4f} | Val Macro F1 {val_f1:.4f}')

    if val_f1 > best_f1:
        best_f1 = val_f1
        save_path = os.path.join(RESULT_DIR, 'best_model.pt')
        torch.save(model.state_dict(), save_path)
        print(f"Saved best model to {save_path}")

print("Training complete.")
