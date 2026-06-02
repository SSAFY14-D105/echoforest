# 04_anonymized — 익명화 STT (고급정제 전)

`scripts/04_text_anonymize.py` 출력. Kiwi 형태소로 닉네임·고유명사를 `[유저]`로 치환한 단계.

- `final_dataset.tsv` (17,296행) — `sentence  label`

> 다음 단계 `05_text_clean_advanced.py`가 노이즈·STT 환각·중복을 더 제거해 [`../04_anonymized_clean/`](../04_anonymized_clean)(15,282행)을 만듭니다. 두 폴더의 `final_dataset.tsv`는 **서로 다른 단계**(중복 아님).
