# processed_data — scripts 파이프라인 단계별 중간 산출물 (8라벨 시도 기록)

`scripts/03~12`가 단계별로 떨어뜨린 중간 파일들입니다. **분류 체계(8라벨)는 최종 미채택**이라, 이 폴더 대부분은 *버려진 8라벨 시도의 기록*입니다.
단, `03_cleaned` · `04_anonymized(_clean)`의 **정제된 STT 문장 자체**는 최종 테스트셋([`../datasets/test_set.tsv`](../datasets), 688)의 출처라 의미가 있습니다.

| 하위 폴더 | 산출 스크립트 | 내용 | 포맷 |
| :--- | :--- | :--- | :--- |
| `03_cleaned/` | `03_text_clean.py` | STT 병합·정제 문장 | `sentence  label` |
| `04_anonymized/` | `04_text_anonymize.py` | 닉네임 → `[유저]` 익명화 (17,296행) | `sentence  label` |
| `04_anonymized_clean/` | `05_text_clean_advanced.py` + 라벨링 | 고급 정제(15,282행) + 8라벨본 | `sentence label` / 8라벨 |
| `05_analysis/` | (구 8라벨 분석 스크립트, 제거됨) | 라벨 분포·키워드·샘플 통계 txt | 텍스트 |
| `05_external/` | `08·09_*unsmile*.py` | UnSmile → 3/8라벨 변환본 | 3·8라벨 |
| `06_ai_labeled/` | `11_ai_labeling.py` | Gemini 8라벨 자동 라벨 (+source) | 8라벨 |

> 최종 학습/평가 데이터는 여기가 아니라 [`../datasets/`](../datasets)(10라벨)입니다. 전체 맥락은 [`../README.md`](../README.md).
