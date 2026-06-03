# raw_data — STT 원시 출력 (커밋 제외)

`scripts/02_whisper_transcriber.py`가 `raw_audio`의 오디오를 faster-whisper(large-v3)로 변환한 결과가 `01_faster_whisper/audio_*.tsv`로 여기 쌓입니다. 출력은 `문장 + unSmile 10라벨 + 팀원사기저하` 템플릿(문장만 채워짐).

**재생성 가능한 중간 산출물이라 git에 커밋하지 않습니다**(`.gitignore`). 이후 `scripts/03~05`가 이걸 읽어 정제 → `processed_data/`로 넘깁니다.
