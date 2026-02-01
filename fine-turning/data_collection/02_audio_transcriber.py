
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
# (Min Silence, Thresh Offset, Keep Silence)
# ==========================================
EXPERIMENTS = [
    # {"min": 125, "thresh": -14, "keep": 200}, 
    # {"min": 150, "thresh": -14, "keep": 200},
    {"min": 250, "thresh": -14, "keep": 200},  # 타겟 설정: 250ms
]
# ==========================================

def transcribe_with_google_web_api(audio_path, settings, exp_file_suffix):
    r = sr.Recognizer()
    full_text = []

    # 설정값 로드
    MIN_SILENCE = settings["min"]
    THRESH_OFFSET = settings["thresh"]
    KEEP_SILENCE = settings["keep"]

    print(f"   [{exp_file_suffix}] Splitting... (Min: {MIN_SILENCE}ms, Thresh: {THRESH_OFFSET}dB)", end="", flush=True)
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

        # 파일명 충돌 방지를 위해 suffix 포함
        chunk_filename = os.path.join(TEMP_DIR, f"temp_{exp_file_suffix}_{i}.wav")
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
            
    header = f"[Settings] Min: {MIN_SILENCE}ms, Thresh: {THRESH_OFFSET}dB, Keep: {KEEP_SILENCE}ms\n"
    header += f"[Stats] Total Chunks: {len(chunks)}, Recognized Lines: {len(full_text)}\n"
    header += "-" * 50 + "\n"
    
    return header + "\n".join(full_text)

def run_all():
    audio_files = glob.glob(os.path.join(AUDIO_DIR, "*.wav"))
    if not audio_files:
        print("No .wav files found.")
        return

    print(f"Found {len(audio_files)} files.")
    print(f"Running {len(EXPERIMENTS)} experiments per file...")

    for audio_path in audio_files:
        filename = os.path.basename(audio_path)
        file_base = os.path.splitext(filename)[0]
        
        print(f"\n🎧 File: {filename}")
        
        for exp in EXPERIMENTS:
            # 파일명 생성 규칙: {원본}_{min}_{thresh(양수)}_{keep}.txt
            thresh_pos = abs(exp["thresh"]) # -20 -> 20
            exp_suffix = f"{exp['min']}_{thresh_pos}_{exp['keep']}"
            
            save_path = os.path.join(OUTPUT_DIR, f"{file_base}_{exp_suffix}.txt")

            if os.path.exists(save_path):
                print(f"   Skip {exp_suffix} (Exists)")
                continue

            try:
                result_text = transcribe_with_google_web_api(audio_path, exp, exp_suffix)
                if result_text:
                    with open(save_path, "w", encoding="utf-8") as f:
                        f.write(result_text)
                    print(f"      ✅ Saved: {file_base}_{exp_suffix}.txt")
            except Exception as e:
                print(f"      ❌ Error {exp_suffix}: {e}")
            
    try:
        os.rmdir(TEMP_DIR)
    except:
        pass

if __name__ == "__main__":
    run_all()
