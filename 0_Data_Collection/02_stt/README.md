# 02_stt — faster-whisper STT

`02_whisper_transcriber.py`가 `../01_download`의 오디오를 faster-whisper large-v3(GPU)로 변환 → `audio_N.tsv`. 발화 단위 청킹 + Kiwi 문장 분리. 헤더는 unSmile 10라벨(= `train_collected`와 동일), 문장만 채워짐.

다음: `../03_clean`이 이 tsv를 정제.
