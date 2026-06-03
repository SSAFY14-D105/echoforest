# processed_data — 수집 파이프라인 중간 산출물

`scripts/03~05`가 STT 결과를 정제·익명화하며 단계별로 떨어뜨리는 **중간 산출물** 위치입니다. (폴더는 스크립트 실행 시 자동 생성)

| 하위 폴더 | 산출 스크립트 | 내용 |
| :--- | :--- | :--- |
| `03_cleaned/` | `03_text_clean.py` | STT 병합·정제 (`sentence  label`) |
| `04_anonymized/` | `04_text_anonymize.py` | 닉네임/고유명사 → `[유저]` 익명화 (Kiwi) |
| `04_anonymized_clean/` | `05_text_clean_advanced.py` | 노이즈·STT 환각·중복 제거 → `final_dataset_clean.tsv` |

흐름: `raw_audio` →(02 STT)→ `raw_data/01_faster_whisper` →(03·04·05)→ 여기. 이후 **AI 사전라벨 + 사람 검수**로 라벨을 붙여 최종 데이터([`../datasets/`](../datasets))에 반영합니다.

> 예전 **8라벨 분류 시도** 산출물(수동 8라벨·unsmile 재라벨·Gemini 샘플)은 미채택이라 제거했습니다. 그 시도의 서사는 velog 개발일지에 정리돼 있습니다.
