# raw_data — STT 원시 출력 (git 보존)

`scripts/02_whisper_transcriber.py`가 `raw_audio`의 오디오를 faster-whisper(large-v3)로 변환한 결과가 `01_faster_whisper/audio_*.tsv`로 여기 쌓입니다. 헤더는 `문장 + unSmile 10라벨`(= `train_collected.tsv`와 동일), 문장만 채워짐(라벨은 `06` 사전라벨+검수로).

수집 소스: 〈메아리의 숲〉 플레이 녹화 STT + YouTube 협동게임 STT (둘 다). **작은 텍스트라 git에 커밋해 보존**합니다(원본 영상이 삭제돼도 전사본 유지). 이후 `scripts/03~05`가 정제 → `processed_data/`로 넘깁니다.
