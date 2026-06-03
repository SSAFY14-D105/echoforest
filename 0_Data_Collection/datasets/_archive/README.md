# _archive — 참고용 (평가에는 사용 안 함)

`datasets/test_set.tsv`(688)에 녹아든 과거 자료. **현재 평가는 `test_set.tsv` 하나만 사용합니다.**

| 파일 | 설명 |
| :--- | :--- |
| `youtube_stt_181.tsv` | 초기 모델 선정 벤치마크 — YouTube 게임 STT, 학습누수 6문장 제거된 181건. unSmile 10라벨. **181개 전부 `test_set`(688)에 포함**(즉 부분집합) |

> 초기 벤치 원본(187)·사람 라벨 원본(1,666행)은 test_set에 흡수돼 제거했습니다. test_set 구성·무결성은 [상위 datasets/README](../README.md) 참고.
