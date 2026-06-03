# 03_clean — 텍스트 정제·병합

`03_text_clean.py`가 `../02_stt`의 STT tsv(`audio_N.tsv`)들을 병합 + 기호·자모·외국어(화이트리스트) 노이즈 제거 + **전역 중복 제거** → `merged_stt_cleaned.tsv` (`sentence · source · label`, 라벨은 비움).

`source` = 출신 영상 id(파일명 stem, 예: `audio_1`). 같은 문장이 여러 영상에 있으면 `audio_3;audio_7`처럼 `;`로 합쳐 보존 → 나중에 영상별로 골라 쓰기 가능(`df[df.source.str.contains('audio_5')]`).

다음: `../04_anonymize`.
