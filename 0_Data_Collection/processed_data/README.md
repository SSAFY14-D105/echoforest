# processed_data — 8라벨 시도의 대표 산출물 (핵심만 보존)

게임 STT를 모아 **8라벨로 분류해보려던 시도**의 흔적입니다. 8라벨 체계는 **최종 미채택**(→ 10라벨 unSmile로 선회)이라, 수집·정제 중간 단계는 정리하고 **각 시도의 대표 결과물 1개씩**만 남겼습니다.

| 파일 | 무엇 | 라벨 |
| :--- | :--- | :--- |
| `04_anonymized_clean/final_dataset.tsv` | 수집·정제·익명화한 게임 STT **15,281문장** + 키워드 기반 **수동 8라벨** | 8라벨 |
| `05_external/unsmile_relabeled.tsv` | 공식 UnSmile을 게임용 8라벨로 **재분류**해본 결과 | 8라벨 |
| `06_ai_labeled/gemini_labeled_100.tsv` | Gemini로 **AI 자동 8라벨**을 붙여본 샘플(100문장) | 8라벨 |

즉 8라벨을 **수동 · 외부데이터(unsmile) · AI** 3가지로 시도 → 모두 접고 **10라벨 unSmile** 채택.

> 최종 학습/평가 데이터는 여기가 아니라 [`../datasets/`](../datasets)(10라벨)입니다. 테스트셋(688) 문장의 라벨링 원본은 [`../datasets/_archive/human_labeled_1666.tsv`](../datasets/_archive)에 보존돼 있습니다.
> 수집·정제 단계(03~05) 중간 산출물은 정리했고, 단계 정의는 [`../scripts/README.md`](../scripts/README.md) · [설계노트](../scripts/수집_파이프라인_설계노트.md)에 남아 있습니다.
