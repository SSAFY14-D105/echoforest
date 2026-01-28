
import os
import glob
import whisper
import torch

# 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "raw_audio")   # 오디오 있는 곳
OUTPUT_DIR = os.path.join(BASE_DIR, "raw_data")    # 텍스트 저장할 곳

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 모델 설정
MODEL_SIZE = "small"
device = "cuda" if torch.cuda.is_available() else "cpu"

def load_model():
    print(f"Loading Whisper model ('{MODEL_SIZE}')...")
    model = whisper.load_model(MODEL_SIZE, device=device)
    print(f"Model loaded on {device.upper()}!")
    return model

def transcribe_all():
    # mp3 파일 찾기
    audio_files = glob.glob(os.path.join(AUDIO_DIR, "*.mp3"))
    if not audio_files:
        print(f"No .mp3 files found in {AUDIO_DIR}")
        return

    model = load_model()
    
    print(f"Found {len(audio_files)} audio files.")
    
    for audio_path in audio_files:
        filename = os.path.basename(audio_path)
        file_id = os.path.splitext(filename)[0]
        
        # 파일명 뒤에 _whisper 추가 (구분용)
        save_path = os.path.join(OUTPUT_DIR, f"{file_id}_whisper.txt")
        
        # 이미 변환된 파일이면 건너뛰기
        if os.path.exists(save_path):
            print(f"Skipping {filename} (Already transcribed)")
            continue
            
        print(f"Transcribing {filename}... ", end="", flush=True)
        
        try:
            result = model.transcribe(audio_path, language='ko')
            
            # 발화 단위(segment)로 줄바꿈 처리 - Whisper 기본 기능 사용
            segments = [seg['text'].strip() for seg in result['segments']]
            full_text = "\n".join(segments)
            
            with open(save_path, "w", encoding="utf-8") as f:
                f.write(full_text)
                
            print("Done!")
            
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    transcribe_all()
