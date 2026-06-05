# 4_1_LoRA_Fine_Tuning

LoRA (Low-Rank Adaptation) 기반 Parameter-Efficient Fine-Tuning

## 🎯 왜 파인튜닝하나 (동기 — threshold 딜레마)

공식 unSmile은 **게임 특유 부정어**를 잘 못 잡는다 — "손가락에 살쪘냐", "빡대가리", "발목잡지마", "트롤" 같은 **비난·조롱**은 일반 혐오발언과 형태가 달라 base 모델이 놓친다(Recall↓).

그렇다고 **threshold를 낮춰** 민감하게 만들면, 이번엔 "가만히 있어라 좀", "냅다 갈겨버리네" 같은 **멀쩡한 게임 오더·흥분**까지 욕설로 잡아(과탐) → **욕을 안 했는데 저주가 발동**하는 최악의 UX가 된다.

> **딜레마**: threshold 하나로는 *"게임 부정어는 잡고 + 멀쩡한 말은 놔두기"* 를 **동시에 못 한다.**

→ 그래서 **게임 도메인 데이터로 fine-tuning** 한다. 모델이 게임 맥락을 학습해 **비난/욕설은 잡고( Recall↑ ) + 게임 오더는 통과( 과탐↓ )** 시키도록. threshold 조절로 안 되는 걸 *학습*으로 푸는 게 핵심.

## 📁 디렉토리 구조

```
4_1_LoRA_Fine_Tuning/
├── v1_corrected_only/           # 보정 데이터만 (10,490건)
│   ├── lora_game_kcelectra.py/.ipynb
│   ├── lora_tutorial_kcbert.py/.ipynb
│   └── output/                  # 학습 결과 저장
│       ├── lora_game_kcelectra/
│       └── lora_tutorial_kcbert/
│
└── v2_corrected_plus_collected/ # 보정+수집 (11,009건)
    ├── lora_game_kcelectra_v2.py/.ipynb
    ├── lora_tutorial_kcbert_v2.py/.ipynb
    └── output/
        ├── lora_game_kcelectra_v2/
        └── lora_tutorial_kcbert_v2/
```

## 📊 버전별 데이터

| 버전 | 데이터 | 건수 |
|------|--------|------|
| v1 | UnSmile 보정 | 10,490건 |
| v2 | UnSmile 보정 + 게임 음성채팅 수집 | 11,009건 |

## 🔧 LoRA 설정

```python
LORA_R = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.1
target_modules = ["query", "key", "value"]
```

## 📈 모델 비교

| 노트북 | 모델 | 메트릭 |
|--------|------|--------|
| `lora_game_kcelectra` | KcELECTRA-base-v2022 | abuse_recall |
| `lora_tutorial_kcbert` | kcbert-base | LRAP |

## 🚀 실행 방법

```bash
# Jupyter 환경
# GPU 서버에 ipynb 파일 업로드 후 실행

# 로컬 conda 환경
conda activate echoforest_ft
python v1_corrected_only/lora_game_kcelectra.py
```
