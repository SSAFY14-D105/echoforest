# 🔧 조정된 실전 실행 계획서 (피드백 반영 + Conda 환경)

> **변경사항**:
> 1. 피드백 4가지 반영
> 2. Python venv → Conda(miniforge) 환경으로 변경
> 3. webrtcvad → silero-vad로 대체 (Windows 호환성)
> 4. 데이터 불균형 전략 단순화 (3중 → 2중)

---

## 📋 피드백 반영 내역

| 피드백 | 기존 계획 | 조정 후 |
|--------|----------|---------|
| 1. 데이터 불균형 | Oversampling + Weighted Sampler + Weighted Loss | **Oversampling(5배) + Weighted Loss만 적용** |
| 2. VAD 라이브러리 | webrtcvad (C++ 의존) | **silero-vad (PyTorch 기반, 설치 쉬움)** |

| 3. 자음이 포함된 데이터셋 삭제 | 개 ㅋㅋ → 하하/비꼼 (문맥 판단) | 개 ㅋㅋ → 삭제 |

---

## 🐍 Conda(Miniforge) 환경 설정

### Day 1-1: Conda 환경 생성 및 패키지 설치

#### ✅ 체크리스트
- [ ] Conda 환경 생성 (Python 3.10)
- [ ] PyTorch 설치 (GPU 지원)
- [ ] 필수 패키지 설치

#### 🔧 환경 설정 명령어

**1. Conda 환경 생성**:
```bash
# 새 환경 생성 (Python 3.10 권장)
conda create -n unsmile-finetune python=3.10 -y

# 환경 활성화
conda activate unsmile-finetune
```

**2. PyTorch 설치** (GPU 지원):
```bash
# CUDA 11.8 버전 (NVIDIA GPU 있는 경우)
conda install pytorch torchvision torchaudio pytorch-cuda=11.8 -c pytorch -c nvidia -y

# CPU만 있는 경우
conda install pytorch torchvision torchaudio cpuonly -c pytorch -y

# 설치 확인
python -c "import torch; print(f'PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}')"
```

**3. environment.yml 생성** (재현 가능한 환경):
```yaml
name: unsmile-finetune
channels:
  - pytorch
  - nvidia
  - conda-forge
  - defaults

dependencies:
  - python=3.10
  - pytorch=2.1.0
  - pytorch-cuda=11.8
  - pip
  - pip:
    # STT 및 오디오 처리
    - SpeechRecognition==3.10.0
    - pydub==0.25.1
    - soundfile==0.12.1
    - librosa==0.10.1

    # VAD (silero-vad로 변경)
    - silero-vad==4.0.0
    - onnxruntime==1.16.0

    # 데이터 처리
    - pandas==2.0.3
    - numpy==1.24.3
    - scikit-learn==1.3.0

    # Transformers & Datasets
    - transformers==4.35.0
    - datasets==2.14.5
    - accelerate==0.24.1

    # 한국어 처리
    - kss==4.2.0

    # 유틸리티
    - tqdm==4.66.1
    - pyyaml==6.0.1
    - matplotlib==3.7.2
    - seaborn==0.12.2
```

**4. 환경 설치**:
```bash
# environment.yml로 환경 생성
conda env create -f environment.yml

# 또는 기존 환경에 설치
conda activate unsmile-finetune
conda env update -f environment.yml
```

**5. 설치 확인**:
```bash
# 패키지 확인
conda list

# Python 인터프리터 경로 확인
which python  # Linux/Mac
where python  # Windows

# 출력 예시: C:\Users\SSAFY\miniforge3\envs\unsmile-finetune\python.exe
```

---

## 📁 조정된 프로젝트 구조

```
fine-turning/
├── environment.yml                        # [신규] Conda 환경 파일
│
├── data_collection/
│   ├── audio_transcriber_web.py          # [수정] silero-vad 적용
│   ├── youtube_downloader.py
│   └── raw_data/
│
├── preprocessing/
│   ├── vad_chunking_silero.py            # [변경] silero-vad 사용
│   ├── data_augmentation.py              # [수정] 단순화
│   ├── text_normalization.py             # [수정] 자음 복원 규칙 단순화
│   └── dataset_builder.py                # [수정] Weighted Sampler 제거
│
├── training/
│   ├── train.py                          # [수정] 학습 전략 단순화
│   ├── config.yaml
│   └── checkpoints/
│
├── evaluation/
│   ├── evaluate.py
│   └── confusion_matrix.png
│
└── models/
    └── unsmile_v1.0/
```

---

## 🔧 변경된 구현 코드

### 1. VAD: silero-vad로 교체 (Windows 호환성)

**preprocessing/vad_chunking_silero.py**:
```python
import torch
import torchaudio
from pydub import AudioSegment
import os
import numpy as np

class SileroVADChunker:
    def __init__(self, min_duration=0.5, max_duration=15.0, threshold=0.5):
        """
        Args:
            min_duration: 최소 청크 길이 (초)
            max_duration: 최대 청크 길이 (초)
            threshold: VAD 임계값 (0.0-1.0, 0.5 권장)
        """
        self.min_duration = min_duration * 1000  # ms
        self.max_duration = max_duration * 1000
        self.threshold = threshold

        # Silero VAD 모델 로드 (자동 다운로드)
        print("Loading Silero VAD model...")
        self.model, utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            onnx=False
        )
        self.get_speech_timestamps = utils[0]

    def chunk_audio(self, audio_file_path):
        """오디오 파일을 VAD로 청킹"""
        print(f"Processing: {audio_file_path}")

        # 오디오 로드 (pydub)
        audio = AudioSegment.from_file(audio_file_path)

        # 16kHz Mono로 변환 (Silero VAD 요구사항)
        audio = audio.set_frame_rate(16000).set_channels(1)

        # NumPy array로 변환
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        samples = samples / np.iinfo(audio.array_type).max  # Normalize to [-1, 1]

        # Torch tensor로 변환
        wav_tensor = torch.from_numpy(samples)

        # VAD로 음성 구간 탐지
        speech_timestamps = self.get_speech_timestamps(
            wav_tensor,
            self.model,
            threshold=self.threshold,
            sampling_rate=16000,
            min_speech_duration_ms=int(self.min_duration),
            max_speech_duration_s=int(self.max_duration / 1000)
        )

        print(f"Detected {len(speech_timestamps)} speech segments")

        # 타임스탬프를 기반으로 청크 생성
        chunks = []
        for ts in speech_timestamps:
            start_ms = ts['start'] * 1000 / 16000  # sample to ms
            end_ms = ts['end'] * 1000 / 16000

            # 길이 필터링
            duration = end_ms - start_ms
            if self.min_duration <= duration <= self.max_duration:
                chunk = audio[start_ms:end_ms]
                chunks.append(chunk)

        print(f"Filtered chunks: {len(chunks)}")
        return chunks

    def save_chunks(self, chunks, output_dir):
        """청크를 파일로 저장"""
        os.makedirs(output_dir, exist_ok=True)

        for i, chunk in enumerate(chunks):
            output_path = os.path.join(output_dir, f"chunk_{i:04d}.wav")
            chunk.export(output_path, format="wav")

        print(f"✅ Saved {len(chunks)} chunks to {output_dir}")

# 사용 예시
if __name__ == "__main__":
    chunker = SileroVADChunker(min_duration=0.5, max_duration=15.0, threshold=0.5)

    # 테스트
    audio_file = "data_collection/raw_data/test_audio.mp3"
    chunks = chunker.chunk_audio(audio_file)
    chunker.save_chunks(chunks, "data_collection/chunks/")
```

**장점**:
- ✅ Windows에서 설치 문제 없음 (Pure Python + PyTorch)
- ✅ GPU 가속 지원
- ✅ webrtcvad보다 정확도 높음

---

### 2. 자음 복원 규칙 단순화

**preprocessing/text_normalization.py** (수정):
```python
import re

class TextNormalizer:
    def __init__(self):
        # 자음 복원 규칙 (안전하게 단순화)
        self.consonant_rules = {
            r'ㅋ{2,}': '하하',      # ㅋㅋ, ㅋㅋㅋ → 하하 (긍정으로 통일)
            r'ㅎ{2,}': '하하',      # ㅎㅎ → 하하
            r'ㅉㅉ': '쯧쯧',        # ㅉㅉ → 쯧쯧 (중립)
            r'ㅇㅇ': '응응',        # ㅇㅇ → 응응
            # ㅅㅂ 같은 명확한 욕설 자음은 제거하고 라벨로만 처리
        }

        # 자음만 있는 짧은 문장 필터링 (품질 관리)
        self.consonant_only_pattern = re.compile(r'^[ㄱ-ㅎㅏ-ㅣ\s]+$')

    def is_consonant_only(self, text):
        """자음만 있는 문장인지 확인"""
        return bool(self.consonant_only_pattern.match(text.strip()))

    def normalize(self, text):
        """텍스트 정규화"""
        # 1. 자음 복원
        for pattern, replacement in self.consonant_rules.items():
            text = re.sub(pattern, replacement, text)

        # 2. 연속 공백 제거
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    def batch_normalize(self, texts, filter_consonant_only=True):
        """배치 정규화 + 자음 전용 문장 필터링"""
        normalized = []
        filtered_count = 0

        for text in texts:
            # 자음만 있는 문장 제거 옵션
            if filter_consonant_only and self.is_consonant_only(text):
                filtered_count += 1
                continue

            normalized.append(self.normalize(text))

        if filtered_count > 0:
            print(f"⚠️ Filtered {filtered_count} consonant-only sentences")

        return normalized

# 테스트
if __name__ == "__main__":
    normalizer = TextNormalizer()

    test_texts = [
        "아 ㅋㅋㅋ 진짜 웃기네",      # → "아 하하 진짜 웃기네"
        "ㅉㅉ 너무 답답하다",          # → "쯧쯧 너무 답답하다"
        "ㅋㅋㅋ",                    # → 필터링됨 (자음만)
        "ㅇㅇ 알겠어"                # → "응응 알겠어"
    ]

    for text in test_texts:
        if normalizer.is_consonant_only(text):
            print(f"[FILTERED] {text}")
        else:
            normalized = normalizer.normalize(text)
            print(f"{text} → {normalized}")
```

**변경 이유**:
- "ㅋㅋ" → "하하" 통일 (긍정으로 간주, 안전)
- "ㅋㅋ" → "비꼼" 변환 제거 (오분류 위험)
- 자음만 있는 애매한 문장은 학습 데이터에서 제외

---

### 3. 데이터 불균형 전략 단순화 (2중만 적용)

**preprocessing/dataset_builder.py** (수정):
```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from text_normalization import TextNormalizer
from data_augmentation import DataAugmenter
import numpy as np

class DatasetBuilder:
    def __init__(self):
        self.normalizer = TextNormalizer()
        self.augmenter = DataAugmenter(aug_ratio=0.3)

    def load_unsmile_data(self, path="unsmile_dataset.csv"):
        """Unsmile 원본 데이터 로드"""
        df = pd.read_csv(path)
        return df

    def load_custom_data(self, path="custom_labeled_data.csv"):
        """직접 라벨링한 데이터 로드"""
        df = pd.read_csv(path)
        # 텍스트 정규화 (자음 전용 문장 필터링 포함)
        normalized_texts = self.normalizer.batch_normalize(
            df['text'].tolist(),
            filter_consonant_only=True
        )
        df_filtered = df.iloc[:len(normalized_texts)].copy()
        df_filtered['text'] = normalized_texts
        return df_filtered

    def oversample_custom_data(self, df, factor=5):
        """소수 클래스 오버샘플링"""
        print(f"Oversampling custom data by {factor}x")
        return pd.concat([df] * factor, ignore_index=True)

    def compute_class_weights(self, labels):
        """클래스 가중치 계산 (Weighted Loss용)"""
        class_weights = compute_class_weight(
            'balanced',
            classes=np.unique(labels),
            y=labels
        )
        print("\nClass Weights:")
        for i, weight in enumerate(class_weights):
            print(f"  Class {i}: {weight:.3f}")
        return class_weights

    def build_final_dataset(self, unsmile_path, custom_path, output_dir="dataset"):
        """최종 데이터셋 구축 (Weighted Sampler 제거)"""

        # 1. 데이터 로드
        unsmile_df = self.load_unsmile_data(unsmile_path)
        custom_df = self.load_custom_data(custom_path)

        # 2. 오버샘플링 (5배)
        custom_df = self.oversample_custom_data(custom_df, factor=5)
        print(f"Unsmile: {len(unsmile_df)}, Custom (5x): {len(custom_df)}")

        # 3. 병합
        final_df = pd.concat([unsmile_df, custom_df], ignore_index=True)

        # 4. 데이터 증강 (30%)
        texts = final_df['text'].tolist()
        labels = final_df['label'].tolist()
        aug_texts, aug_labels = self.augmenter.augment_dataset(texts, labels)

        final_df = pd.DataFrame({'text': aug_texts, 'label': aug_labels})

        # 5. 클래스 가중치 계산 및 저장
        class_weights = self.compute_class_weights(final_df['label'].values)
        np.save(f"{output_dir}/class_weights.npy", class_weights)

        # 6. Train/Val/Test 분할
        train, temp = train_test_split(
            final_df,
            test_size=0.3,
            stratify=final_df['label'],
            random_state=42
        )
        val, test = train_test_split(
            temp,
            test_size=0.5,
            stratify=temp['label'],
            random_state=42
        )

        # 7. 저장
        os.makedirs(output_dir, exist_ok=True)
        train.to_csv(f"{output_dir}/train.csv", index=False)
        val.to_csv(f"{output_dir}/val.csv", index=False)
        test.to_csv(f"{output_dir}/test.csv", index=False)

        print(f"\n✅ Dataset created:")
        print(f"  Train: {len(train)}")
        print(f"  Val: {len(val)}")
        print(f"  Test: {len(test)}")
        print(f"  Class weights saved to: {output_dir}/class_weights.npy")

        return train, val, test

# 실행
if __name__ == "__main__":
    import os
    builder = DatasetBuilder()

    train, val, test = builder.build_final_dataset(
        unsmile_path="data/unsmile_dataset.csv",
        custom_path="data/custom_labeled_data.csv",
        output_dir="dataset"
    )
```

**변경 사항**:
- ❌ Weighted Random Sampler 제거 (복잡도 감소)
- ✅ Oversampling(5배) 유지
- ✅ Class Weights 계산 및 저장 (Weighted Loss에 사용)

---

### 4. 학습 스크립트 단순화

**training/train.py** (수정 - Weighted Sampler 제거):
```python
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer
)
import pandas as pd
import numpy as np
import yaml
import os

class UnsmileDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]

        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(label, dtype=torch.long)
        }

class UnsmileTrainer:
    def __init__(self, config_path="config.yaml"):
        # Config 로드
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)

        # Tokenizer & Model
        model_name = self.config['model']['name']
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            num_labels=self.config['model']['num_labels']
        )

        # GPU 설정
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        print(f"Using device: {self.device}")

        # Class weights 로드
        weights_path = os.path.join(
            os.path.dirname(self.config['data']['train_path']),
            'class_weights.npy'
        )
        self.class_weights = torch.tensor(
            np.load(weights_path),
            dtype=torch.float
        ).to(self.device)
        print(f"Loaded class weights from {weights_path}")

    def load_data(self):
        """데이터 로드 (Weighted Sampler 없음)"""
        train_df = pd.read_csv(self.config['data']['train_path'])
        val_df = pd.read_csv(self.config['data']['val_path'])

        self.train_dataset = UnsmileDataset(
            train_df['text'].tolist(),
            train_df['label'].tolist(),
            self.tokenizer,
            self.config['data']['max_length']
        )

        self.val_dataset = UnsmileDataset(
            val_df['text'].tolist(),
            val_df['label'].tolist(),
            self.tokenizer,
            self.config['data']['max_length']
        )

        print(f"Train: {len(self.train_dataset)}, Val: {len(self.val_dataset)}")

    def train_stage1_freeze(self):
        """Stage 1: Base 모델 Freeze"""
        print("\n" + "="*60)
        print("Stage 1: Training with Base Model Frozen")
        print("="*60)

        # RoBERTa Freeze (Unsmile은 RoBERTa 기반)
        for param in self.model.roberta.parameters():
            param.requires_grad = False

        # Weighted Loss Trainer
        class WeightedLossTrainer(Trainer):
            def __init__(self, *args, class_weights=None, **kwargs):
                super().__init__(*args, **kwargs)
                self.class_weights = class_weights

            def compute_loss(self, model, inputs, return_outputs=False):
                labels = inputs.pop("labels")
                outputs = model(**inputs)
                logits = outputs.logits

                # Weighted Cross Entropy Loss
                loss_fct = nn.CrossEntropyLoss(weight=self.class_weights)
                loss = loss_fct(logits, labels)

                return (loss, outputs) if return_outputs else loss

        # 학습 설정
        training_args = TrainingArguments(
            output_dir=os.path.join(self.config['output']['checkpoint_dir'], "stage1"),
            num_train_epochs=self.config['training']['num_epochs_freeze'],
            per_device_train_batch_size=self.config['training']['batch_size'],
            per_device_eval_batch_size=self.config['training']['batch_size'],
            learning_rate=self.config['training']['learning_rate_head'],
            weight_decay=self.config['training']['weight_decay'],
            warmup_steps=self.config['training']['warmup_steps'],
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            logging_dir='./logs',
            logging_steps=50,
        )

        trainer = WeightedLossTrainer(
            model=self.model,
            args=training_args,
            train_dataset=self.train_dataset,
            eval_dataset=self.val_dataset,
            class_weights=self.class_weights
        )

        trainer.train()
        print("✅ Stage 1 completed")

    def train_stage2_full(self):
        """Stage 2: 전체 Fine-tune"""
        print("\n" + "="*60)
        print("Stage 2: Full Model Fine-tuning")
        print("="*60)

        # Unfreeze
        for param in self.model.roberta.parameters():
            param.requires_grad = True

        # 차등 학습률
        optimizer_grouped_parameters = [
            {
                "params": self.model.roberta.parameters(),
                "lr": self.config['training']['learning_rate_base']
            },
            {
                "params": self.model.classifier.parameters(),
                "lr": self.config['training']['learning_rate_head']
            }
        ]

        optimizer = torch.optim.AdamW(
            optimizer_grouped_parameters,
            weight_decay=self.config['training']['weight_decay']
        )

        # Weighted Loss Trainer
        class WeightedLossTrainer(Trainer):
            def __init__(self, *args, class_weights=None, **kwargs):
                super().__init__(*args, **kwargs)
                self.class_weights = class_weights

            def compute_loss(self, model, inputs, return_outputs=False):
                labels = inputs.pop("labels")
                outputs = model(**inputs)
                logits = outputs.logits

                loss_fct = nn.CrossEntropyLoss(weight=self.class_weights)
                loss = loss_fct(logits, labels)

                return (loss, outputs) if return_outputs else loss

        training_args = TrainingArguments(
            output_dir=os.path.join(self.config['output']['checkpoint_dir'], "stage2"),
            num_train_epochs=self.config['training']['num_epochs_full'],
            per_device_train_batch_size=self.config['training']['batch_size'],
            per_device_eval_batch_size=self.config['training']['batch_size'],
            weight_decay=self.config['training']['weight_decay'],
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            logging_dir='./logs',
            logging_steps=50,
        )

        trainer = WeightedLossTrainer(
            model=self.model,
            args=training_args,
            train_dataset=self.train_dataset,
            eval_dataset=self.val_dataset,
            optimizers=(optimizer, None),
            class_weights=self.class_weights
        )

        trainer.train()
        print("✅ Stage 2 completed")

    def save_model(self):
        """최종 모델 저장"""
        output_dir = self.config['output']['model_dir']
        os.makedirs(output_dir, exist_ok=True)
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)
        print(f"✅ Model saved to {output_dir}")

    def run(self):
        """전체 파이프라인"""
        self.load_data()
        self.train_stage1_freeze()
        self.train_stage2_full()
        self.save_model()

# 실행
if __name__ == "__main__":
    trainer = UnsmileTrainer(config_path="config.yaml")
    trainer.run()
```

---

### 5. 렉 최적화 우선순위 조정

**frontend/performance-optimization.md** (새 문서):
```markdown
# 브라우저 렉 최적화 우선순위

## 1순위: LiveKit 비디오 최적화 ⭐⭐⭐
```javascript
// LiveKit Room 설정
const roomOptions = {
  videoCaptureDefaults: {
    resolution: VideoPresets.h360.resolution  // 720p → 360p
  },
  publishDefaults: {
    videoSimulcastLayers: [VideoPresets.h180]  // 최저 화질만
  }
};

// 필요 시 비디오 완전 비활성화
localParticipant.setCameraEnabled(false);
```

## 2순위: 게임 렌더링 프레임 제한 ⭐⭐
```javascript
// 60fps → 30fps로 제한
let lastFrameTime = 0;
const targetFPS = 30;
const frameInterval = 1000 / targetFPS;

function gameLoop(currentTime) {
    if (currentTime - lastFrameTime < frameInterval) {
        requestAnimationFrame(gameLoop);
        return;
    }

    lastFrameTime = currentTime;

    // 게임 렌더링
    updateGame();
    renderGame();

    requestAnimationFrame(gameLoop);
}
```

## 3순위: STT Worker 분리 ⭐
```javascript
// 효과가 미미하면 스킵
const sttWorker = new Worker('stt-worker.js');
// (기존 코드 동일)
```

**최적화 순서**:
1. LiveKit 해상도 낮추기 → 렉 테스트
2. 여전히 렉 → 게임 30fps 제한
3. 여전히 렉 → STT Worker 도입
4. 여전히 렉 → 비디오 완전 비활성화
```

---

## 📊 조정된 2주 일정

### Week 1: 데이터 파이프라인 (변경 사항 반영)

| Day | 작업 | 주요 변경 |
|-----|------|-----------|
| **Day 1** | Conda 환경 + Silero VAD | ✅ webrtcvad → silero-vad |
| **Day 2** | STT 수집 | - |
| **Day 3** | 데이터 증강 + 정규화 | ✅ 자음 복원 단순화 |
| **Day 4-5** | 라벨링 + 데이터셋 구축 | ✅ Weighted Sampler 제거 |

### Week 2: 모델 학습 및 최적화

| Day | 작업 | 주요 변경 |
|-----|------|-----------|
| **Day 6-7** | 모델 학습 (Stage 1-2) | ✅ 2중 불균형 전략만 |
| **Day 8-9** | 평가 및 분석 | - |
| **Day 10** | 렉 최적화 | ✅ LiveKit 우선, STT Worker는 부차적 |

---

## ✅ 최종 체크리스트 (조정본)

### 환경 설정
- [ ] Conda 환경 생성 (`unsmile-finetune`)
- [ ] PyTorch GPU/CPU 설치
- [ ] environment.yml로 패키지 설치
- [ ] Silero VAD 모델 다운로드 확인

### 데이터 파이프라인
- [ ] Silero VAD 청킹 코드 작동 확인
- [ ] 자음 복원 규칙 단순화 적용
- [ ] 자음 전용 문장 필터링 확인
- [ ] Oversampling 5배 + Class Weights 계산

### 모델 학습
- [ ] Weighted Loss만 적용 (Sampler X)
- [ ] Stage 1 (Freeze) 학습 완료
- [ ] Stage 2 (Full) 학습 완료
- [ ] F1-score 목표 달성 (≥ 0.70)

### 최적화
- [ ] LiveKit 해상도 최적화 우선 적용
- [ ] 렉 여전하면 게임 30fps 제한
- [ ] 필요 시 STT Worker 도입

---

## 🎯 피드백 반영 완료

| 항목 | 상태 |
|------|------|
| 1. 데이터 불균형 3중 → 2중 | ✅ 완료 |
| 2. webrtcvad → silero-vad | ✅ 완료 |
| 3. 렉 최적화 우선순위 조정 | ✅ 완료 |
| 4. 자음 복원 안전화 | ✅ 완료 |
| 5. Conda 환경 적용 | ✅ 완료 |

---

**이제 Day 1부터 바로 시작 가능합니다!** 🚀
