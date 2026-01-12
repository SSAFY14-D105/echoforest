from faster_whisper import WhisperModel
import torch
import os

class Transcriber:
    def __init__(self, model_size="base"):
        # GPU 사용 가능 여부 확인
        # CUDA가 있으면 'cuda', 없으면 'cpu'로 자동 포지션 (하지만 v3 목표는 cuda임)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        
        print(f"Initializing Whisper Model [{model_size}] on [{device}] with [{compute_type}]...")
        
        self.model = WhisperModel(
            model_size, 
            device=device, 
            compute_type=compute_type
        )
        print("Model loaded successfully!")

    def transcribe(self, audio_path):
        # 빔서치 5, VAD 필터 켜기
        segments, info = self.model.transcribe(
            audio_path, 
            beam_size=5, 
            language="ko",
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        texts = []
        for segment in segments:
            texts.append(segment.text)
            
        full_text = " ".join(texts)
        return full_text.strip(), info
