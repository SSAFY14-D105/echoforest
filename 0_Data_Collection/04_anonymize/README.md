# 04_anonymize — 개인지칭 행 삭제

`04_text_anonymize.py`가 `../03_clean` 문장에서 **개인지칭(등록 닉네임 / 고유명사+호칭)이 있는 행을 삭제**합니다 — `[유저]` 치환이 아니라 행 제거(공식 unSmile `Drop_개인지칭` 방식). → `final_dataset.tsv`.

Kiwi NNP 기반이되, 외래어·게임명(나이스·캐리·피코파크 등) 과삭제는 방지(닉네임+호칭만). 영상별 화자명을 `CUSTOM_USERS`에 추가하면 bare 닉네임 탐지율↑.

다음: `../05_advanced_clean`.
