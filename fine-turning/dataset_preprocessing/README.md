# 한국어 STT 데이터셋 전처리 파이프라인

WebSpeech API 스타일 한국어 음성 데이터셋 전처리 도구입니다.
실제 STT 환경을 시뮬레이션하기 위해 **5% 텍스트 손실** (삭제 70% + 음성학적 대체 30%)을 적용합니다.

## 특징

- **Zeroth-Korean 자동 다운로드** (OpenSLR, CC BY 4.0)
- **WebSpeech API 형식 변환** (JSONL)
- **실제 STT 오류 시뮬레이션**
  - 조사 삭제 ("이/가/을/를" 등)
  - 어미 손실 ("습니다" → "슴다")
  - 단어 누락 (문장 시작/끝 우선)
  - 음성학적 대체 ("했어요" → "했요", "애" ↔ "에")
- **태그 없는 손실** (`{missing}` 같은 학습 방해 요소 제거)

## 설치

```bash
pip install -r requirements.txt
```

## 사용법

### 1. 데이터셋 다운로드

```bash
python download.py
```

다운로드 경로: `./data/zeroth_korean/` (~3.5GB)

### 2. WebSpeech 형식으로 전처리

```bash
# 기본 (5% 손실, 원본 오디오 경로 참조)
python preprocess.py

# 커스텀 설정
python preprocess.py \
  --input_dir ./data/zeroth_korean \
  --output_dir ./data/webspeech_dataset \
  --error_rate 0.08 \
  --copy_audio
```

**파라미터:**
- `--input_dir`: Zeroth-Korean 데이터 경로
- `--output_dir`: 출력 디렉토리
- `--error_rate`: 손실 비율 (기본 0.05 = 5%)
- `--copy_audio`: 오디오 파일 복사 (기본: 원본 경로 참조)

### 3. 데이터셋 검증

```bash
python verify_dataset.py --dataset_dir ./data/webspeech_dataset
```

## 출력 형식

### 디렉토리 구조

```
webspeech_dataset/
├── train.jsonl           # 학습 데이터
├── test.jsonl            # 테스트 데이터
├── all.jsonl             # 전체 데이터
├── dataset_info.json     # 메타데이터
├── stats.json            # 통계 정보
└── audio/                # 오디오 파일 (--copy_audio 사용 시)
```

### JSONL 스키마

```json
{
  "audio": "path/to/audio.wav",
  "text": "안녕 반갑습니다",
  "text_clean": "안녕하세요 반갑습니다",
  "confidence": 0.92,
  "metadata": {
    "speaker_id": "103_003",
    "duration": 2.34,
    "split": "train",
    "is_degraded": true,
    "operations": ["조사 삭제"],
    "original_length": 13,
    "degraded_length": 11
  }
}
```

**필드 설명:**
- `text`: STT 출력 시뮬레이션 (손실 반영)
- `text_clean`: 원본 전사 텍스트 (ground truth)
- `confidence`: 시뮬레이션된 신뢰도 점수
- `is_degraded`: 손실 적용 여부
- `operations`: 적용된 손실 작업 목록

## 손실 시뮬레이션 전략

### 삭제 계열 (70%)

1. **조사 삭제** (20%)
   ```
   "오늘은 날씨가 좋아요" → "오늘 날씨 좋아요"
   ```

2. **어미 손실** (15%)
   ```
   "반갑습니다" → "반갑슴다" / "반갑습다"
   ```

3. **단어 누락** (35%)
   ```
   "정말 좋은 날씨네요" → "좋은 날씨네요"
   ```

### 음성학적 대체 (30%)

1. **자주 틀리는 단어**
   ```
   "있어요" → "이써요" / "이서요"
   "했습니다" → "했슴다" / "핸니다"
   ```

2. **모음 혼동**
   ```
   "애" ↔ "에"
   "의" → "이" / "으"
   ```

3. **자모 변형**
   ```
   초성: ㄱ → ㄲ/ㅋ, ㄷ → ㄸ/ㅌ
   종성: 탈락 또는 ㄴ ↔ ㄹ
   ```

## Python에서 사용

```python
import json

# 데이터 로드
with open('./data/webspeech_dataset/train.jsonl', 'r', encoding='utf-8') as f:
    train_data = [json.loads(line) for line in f]

# 샘플 확인
sample = train_data[0]
print(f"Original:  {sample['text_clean']}")
print(f"Degraded:  {sample['text']}")
print(f"Operations: {sample['metadata']['operations']}")
```

## 커스터마이제이션

### 음성학적 규칙 추가

`korean_phonetics.py`의 `KoreanPhoneticReplacer` 클래스 수정:

```python
# 단어 대체 규칙 추가
self.word_replacements = {
    '있어요': ['이써요', '이서요'],
    '새로운_단어': ['대체어1', '대체어2'],  # 추가
}
```

### 손실 비율 조정

`apply_stt_errors()` 메서드에서 비율 변경:

```python
# 삭제 70% → 50%로 변경
if random.random() < 0.5:  # 기존 0.7
    # 삭제 로직
```

## 라이센스

- **코드**: MIT License
- **Zeroth-Korean 데이터셋**: CC BY 4.0

## 다음 단계

1. **다른 데이터셋 추가**
   - FutureBeeAI 한국어 대화 (30시간)
   - Nexdata-AI (357시간)
   - KsponSpeech (연구용, 1,000시간)

2. **게임 특화 데이터 추가**
   - 욕설/괴롭힘 패턴
   - 짧은 발화 (게임 채팅 스타일)

3. **모델 학습**
   ```bash
   # 예시: HuggingFace Transformers
   python train_toxic_detector.py \
     --train_data ./data/webspeech_dataset/train.jsonl \
     --model_name klue/roberta-base
   ```

## 문제 해결

### "No samples found" 오류

```bash
# Zeroth 데이터 구조 확인
ls -R ./data/zeroth_korean/
```

예상 구조: `zeroth_korean/train_data_01/[speaker_dirs]/`

### 메모리 부족

대용량 데이터셋의 경우 배치 처리:

```python
# preprocess.py 수정
BATCH_SIZE = 1000
for i in range(0, len(samples), BATCH_SIZE):
    batch = samples[i:i+BATCH_SIZE]
    # 처리...
```

## 기여

이슈 및 PR 환영합니다!

## 참고 자료

- [Zeroth-Korean OpenSLR](https://www.openslr.org/40/)
- [WebSpeech API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [한국어 음운론](https://ko.wikipedia.org/wiki/한국어_음운론)
