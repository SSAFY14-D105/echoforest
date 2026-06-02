# 04_anonymized_clean — 고급 정제 + 8라벨본

`scripts/05_text_clean_advanced.py`(노이즈·STT 환각·중복 제거, 15,282행) 이후 단계 산출물.

| 파일 | 포맷 | 설명 |
| :--- | :--- | :--- |
| `final_dataset.tsv` | 8라벨 이진 | `sentence` + 8라벨(abuse…order) |
| `final_dataset_clean.tsv` | `sentence  label` | 정제 문장 |
| `final_dataset_labeled.tsv` | `sentence  label` | 단일 라벨 부여본 |

> 8라벨 체계는 최종 미채택. 정제된 STT 문장 자체는 테스트셋(688)의 출처입니다. 전체 맥락은 [상위 README](../README.md).
