
import os
import glob
import speech_recognition as sr
from pydub import AudioSegment
from pydub.silence import split_on_silence

# 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "raw_audio")
OUTPUT_DIR = os.path.join(BASE_DIR, "raw_data")
TEMP_DIR = os.path.join(BASE_DIR, "temp_chunks_web")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# ==========================================
# 🧪 [실험실] 다양한 설정값을 여기에 추가하세요!
# ==========================================
EXPERIMENTS = [
    # 1번 실험: 아주 민감하게 (많이 잘림)
    {"id": "exp1_sensitive", "min_silence": 200, "thresh": -20, "keep": 200},
    
    # 2번 실험: 적당히 (밸런스)
    {"id": "exp2_balanced",  "min_silence": 400, "thresh": -16, "keep": 300},
    
    # 3번 실험: 둔감하게 (길게 이어짐)
    {"id": "exp3_relaxed",   "min_silence": 500, "thresh": -14, "keep": 400},
]
# ==========================================

def transcribe_with_google_web_api(audio_path, settings):
    r = sr.Recognizer()
    full_text = []

    # 설정값 로드
    MIN_SILENCE = settings["min_silence"]
    THRESH_OFFSET = settings["thresh"]
    KEEP_SILENCE = settings["keep"]
    EXP_ID = settings["id"]

    print(f"   [{EXP_ID}] Splitting... (Min: {MIN_SILENCE}ms, Thresh: {THRESH_OFFSET}dB)", end="", flush=True)
    sound = AudioSegment.from_file(audio_path)
    
    chunks = split_on_silence(
        sound,
        min_silence_len=MIN_SILENCE,
        silence_thresh=sound.dBFS + THRESH_OFFSET, 
        keep_silence=KEEP_SILENCE
    )
    print(f" -> {len(chunks)} chunks")
    
    for i, chunk in enumerate(chunks):
        if len(chunk) < 500: continue 

        chunk_filename = os.path.join(TEMP_DIR, f"temp_{EXP_ID}_{i}.wav")
        chunk.export(chunk_filename, format="wav")
        
        try:
            with sr.AudioFile(chunk_filename) as source:
                audio_listened = r.record(source)
                try:
                    text = r.recognize_google(audio_listened, language='ko-KR')
                    full_text.append(text)
                except sr.UnknownValueError:
                    pass 
                except sr.RequestError as e:
                    print(f"      [API Error] Chunk {i}: {e}")
        except Exception as e:
            print(f"      [File Error] {e}")

        try:
            if os.path.exists(chunk_filename):
                os.remove(chunk_filename)
        except PermissionError:
            pass
            
    header = f"[Experiment: {EXP_ID}]\n"
    header += f"Settings: Min Silence={MIN_SILENCE}ms, Thresh={THRESH_OFFSET}dB, Keep={KEEP_SILENCE}ms\n"
    header += f"Stats: {len(chunks)} Chunks, {len(full_text)} Recognized Lines\n"
    header += "-" * 50 + "\n"
    
    return header + "\n".join(full_text)

def run_all():
    audio_files = glob.glob(os.path.join(AUDIO_DIR, "*.mp3"))
    if not audio_files:
        print("No .mp3 files found.")
        return

    print(f"Found {len(audio_files)} files.")
    print(f"Running {len(EXPERIMENTS)} experiments per file...")

    for audio_path in audio_files:
        filename = os.path.basename(audio_path)
        file_base = os.path.splitext(filename)[0]
        
        print(f"\n🎧 File: {filename}")
        
        for exp in EXPERIMENTS:
            exp_id = exp["id"]
            save_path = os.path.join(OUTPUT_DIR, f"{file_base}_google_{exp_id}.txt")

            if os.path.exists(save_path):
                print(f"   Skip {exp_id} (Exists)")
                continue

            try:
                result_text = transcribe_with_google_web_api(audio_path, exp)
                if result_text:
                    with open(save_path, "w", encoding="utf-8") as f:
                        f.write(result_text)
                    print(f"      ✅ Saved: {file_base}_google_{exp_id}.txt")
            except Exception as e:
                print(f"      ❌ Error {exp_id}: {e}")
            
    try:
        os.rmdir(TEMP_DIR)
    except:
        pass

if __name__ == "__main__":
    run_all()
