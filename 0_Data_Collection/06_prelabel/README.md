# 06_prelabel — unSmile abuse/clean 사전라벨

`06_prelabel_unsmile.py`가 `../05_advanced_clean`의 문장에 unSmile을 돌려 abuse/clean **초안**을 붙입니다 → `review_candidates.tsv`(abuse 후보를 확률순 위로 정렬, `검수` 칼럼 비움, `source`로 출신 영상 추적).

⚠️ unSmile 사전라벨은 **초안**일 뿐 — 게임 욕설을 놓치기도(Recall 한계, base 0.6466) 하고 게임 상황("죽어 죽어" 류)을 욕설로 오탐하기도 해서 **사람 검수 필수**. 검수 확정분만 문장+10라벨로 추출해 `../datasets/train_collected`에 합침(누수검증 후).

라벨 정책(왜 10라벨 포맷이되 abuse/clean 이진인지)은 스크립트 docstring 참고.
