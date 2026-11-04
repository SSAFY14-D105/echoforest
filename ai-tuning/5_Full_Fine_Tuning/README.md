# 5_Full_Fine_Tuning

Full Fine-tuning 기반 모든 파라미터 학습

![Full Fine-Tuning: base 2종(KcELECTRA·kcbert) × 데이터 v1/v2](results/full_models_ko.png)

![Full Fine-Tuning 학습 곡선 (Full v2 KcELECTRA)](results/training_curve_ko.png)

> 첫 그래프는 `test_set.tsv` 기준 4개 Full FT 모델 비교이고, 두 번째 그래프는 Full v2 KcELECTRA의 validation 학습 로그입니다.

> 📖 **파인튜닝 동기(threshold 딜레마)·전체 파이프라인 흐름** → [AI 파이프라인 개요](../AI_파이프라인_개요.md)

## 📁 디렉토리 구조

```
5_Full_Fine_Tuning/
├── v1_corrected_only/           # 보정 데이터만 (14,690건)
│   ├── full_game_kcelectra.py/.ipynb
│   ├── full_tutorial_bert.py
│   ├── full_tutorial_kcbert.ipynb
│   └── output/                  # 학습 결과 저장
│       ├── full_game_kcelectra/
│       └── full_tutorial_kcbert/
│
└── v2_corrected_plus_collected/ # 보정+수집 (15,208건)
    ├── full_game_kcelectra_v2.py/.ipynb
    ├── full_tutorial_kcbert_v2.py/.ipynb
    └── output/
        ├── full_game_kcelectra_v2/
        └── full_tutorial_kcbert_v2/
```

## 📊 버전별 데이터

| 버전 | 데이터 | 건수 |
|------|--------|------|
| v1 | UnSmile 보정 | 14,690건 |
| v2 | UnSmile 보정 + 게임 음성채팅 수집 | 15,208건 |

## 🔧 학습 설정

실제 실행한 노트북 기준, 4개 모델(v1/v2 × KcELECTRA/kcbert) 공통입니다.

| 항목 | 값 |
|------|----|
| epoch / batch / LR | 5 / 16 / 2e-5 (Full FT는 LoRA보다 낮은 LR) |
| gradient accumulation | 2 |
| 조기 종료 | patience 3 (unSmile 검증셋, epoch마다 평가) |
| 체크포인트 선택 지표 | `abuse_recall` |
| max_len · fp16 | 128 · 사용 |
| 시드 | 고정 안 함(1회 실행) |

> 결과 모델은 각 폴더의 `.ipynb`로 학습했습니다(커밋 `63cf9be1` "하이퍼파라미터 통일 후 8개 모델 결과 완성"). 같은 폴더의 `.py`는 설정을 통일하기 전 초안이라 누적·인내값·선택 지표가 다르니, 재현은 노트북 기준으로 하세요. v1과 v2가 같은 설정이라 v1→v2 차이는 데이터 차이로 읽을 수 있습니다.

## 📈 모델 비교

| 실험 | 모델 | 메트릭 |
|--------|------|--------|
| `full_game_kcelectra` | KcELECTRA-base-v2022 | abuse_recall |
| `full_tutorial_kcbert` | kcbert-base | abuse_recall |

> v1 kcbert 실험은 로컬 실행 스크립트명이 `full_tutorial_bert.py`, 노트북명이 `full_tutorial_kcbert.ipynb`입니다. 산출물 폴더명은 `full_tutorial_kcbert/`로 통일되어 Step 6 비교 코드와 연결됩니다.

## ⚠️ 참고
Full Fine-tuning은 LoRA보다 학습 시간이 길고 메모리 사용량이 높습니다.

## 🚀 실행 방법

```bash
# Jupyter 환경
# GPU 서버에 ipynb 파일 업로드 후 실행

# 로컬 conda 환경
conda activate echoforest_ft
python v1_corrected_only/full_game_kcelectra.py
```
