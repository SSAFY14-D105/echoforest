# 📦 datasets — 파이프라인 단일 데이터 출처

이 폴더가 **모든 단계가 참조하는 데이터의 단일 출처(single source of truth)** 입니다. 수집·라벨링(상위 `0_Data_Collection/`)의 최종 산출물이며, 모델 선정·학습·평가가 전부 여기서 읽습니다.

## 파일

| 파일 | 건수 | 구성 | 용도 |
| :--- | :---: | :--- | :--- |
| **train_collected.tsv** | 518 | clean 284 / abuse 234 | 파인튜닝 **추가 학습**(v2)에 투입. 출처: 직접 수집한 게임 채팅([`../collected_game_chat/`](../collected_game_chat)) — YouTube STT 파이프라인과 별개 |
| **test_set.tsv** | **688** | abuse 215 / clean 473 | **held-out 테스트셋** — 모델 선정·비교·양자화 평가에 공통 사용 |

### test_set.tsv 무결성 (검증됨)
- 공식 unSmile(원본·보정, train·valid)과 **0 겹침**
- `train_collected.tsv`(518)와도 **0 겹침** → 8개 모델(v1·v2) 누구를 평가해도 누수 없음
- 구성: 기존 게임 벤치 187 + 사람이 라벨링한 게임 STT(human_labeled의 라벨분), 중복·학습누수 제거
- **개인지칭(`[유저]`) 행 통째 삭제**: 공식 unSmile 정제 때 *개인지칭 행을 삭제*(15,005→14,690)한 것과 **동일 기준**. 학습·운영엔 `[유저]`가 없으므로, 테스트의 `[유저]` 포함 **54행을 행 단위로 제거** → 742 → **688**

## _archive (참고용 원본, 평가에는 사용 안 함)
| 파일 | 설명 |
| :--- | :--- |
| game_test_187.tsv | 초기 모델 선정 벤치마크 테스트셋(187) |
| game_test_clean_181.tsv | 187에서 학습 누수 6문장 제거(181) |
| human_labeled_1666.tsv | 사람 라벨 원본 1,666행 (그중 1,073행은 무라벨) |

## 어느 단계가 무엇을 쓰나
```
1_Model_Selection   → test_set.tsv (6모델 벤치마크·임계값 최적화)
2_Baseline_Test     → (원본 unSmile 약점 측정)
4_LoRA / 5_Full     → train_collected.tsv (+ 3_UnSmile_Correction의 보정 데이터) 학습
6_Model_Comparison  → test_set.tsv (8모델 비교)
8_Quantization      → test_set.tsv (양자화 모델 평가)
```
> ⚠️ 테스트는 항상 `test_set.tsv`(688) 하나로 통일 — 단계마다 다른 셋을 쓰지 말 것.
