# utils — 8라벨 시도 때 쓰던 보조 스크립트 (기록용)

데이터 수집·8라벨 분석을 돕던 유틸. **현재 입력 경로(`processed_data/07_final/…` 등)는 트리에 없어 그대로는 실행되지 않습니다.** 8라벨 시도의 작업 흔적으로 남깁니다.

| 파일 | 했던 일 | 비고 |
| :--- | :--- | :--- |
| `analyze_labels.py` | 라벨 분포·키워드·샘플 분석 → `processed_data/05_analysis/` | 입력 `07_final` 없음 |
| `select_balanced.py` | 라벨 균형 맞춰 테스트 후보 추출 | 입력 `07_final` 없음 |
| `split_sentences.py` | Kiwi로 긴 STT를 발화 단위로 분리 | 입력 `07_final` 없음 |
| `UnSmile STT 데이터 수집 및 처리 가이드.md` | 수집 파이프라인 **설계 의사결정 기록**(청킹·403 우회·STT 자모 제거 이유) | 본문 파일명은 옛 이름(현재는 `scripts/01~05`) |

> 최종 수집 스크립트는 [`../scripts/`](../scripts), 최종 데이터는 [`../datasets/`](../datasets)입니다.
