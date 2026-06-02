# 03_cleaned — STT 정제본

`scripts/03_text_clean.py` 출력. 여러 영상의 STT 결과를 병합하고 숫자·기호를 제거, 마스킹된 욕설(시*발 등)을 복구한 문장.

- `merged_stt_cleaned.tsv` — `sentence  label`

8라벨 파이프라인의 입력이지만, **여기 정제 문장들은 익명화(`04`)·고급정제(`05`)를 거쳐 최종 테스트셋(688)의 일부가 됩니다.** 전체 맥락은 [상위 README](../README.md).
