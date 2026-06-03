# 06_prelabel — unSmile abuse/clean 사전라벨

`06_prelabel_unsmile.py`가 `../05_advanced_clean`의 문장에 unSmile을 돌려 abuse/clean **초안**을 붙입니다 → `review_candidates.tsv`(abuse 후보를 확률순 위로 정렬, `검수` 칼럼 비움).

⚠️ unSmile은 게임 오더를 abuse로 **오탐**하는 경향이 큼(이 프로젝트가 파인튜닝으로 푸는 바로 그 문제) → **사람 검수 필수**. 검수 확정분만 문장+10라벨로 추출해 `../datasets/train_collected`에 합침(누수검증 후).

라벨 정책(왜 10라벨 포맷이되 abuse/clean 이진인지)은 스크립트 docstring 참고.
