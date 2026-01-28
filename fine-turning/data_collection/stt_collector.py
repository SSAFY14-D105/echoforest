
import os
import yt_dlp
import whisper
import torch
import time

# 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "raw_data") # 라벨링 전 원시 데이터 저장소
URL_LIST_FILE = os.path.join(BASE_DIR, "url_list.txt") # 링크 리스트 파일

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 모델 로드 (GPU 사용)
MODEL_SIZE = "small" 
print(f"Loading Whisper model ('{MODEL_SIZE}')...")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model(MODEL_SIZE, device=device)
print(f"Model loaded on {device.upper()}!")

def download_audio(url, idx):
    # 파일명을 인덱스 등으로 지정하여 중복 방지
    filename = f"temp_audio_{idx}"
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join(OUTPUT_DIR, filename),
        'quiet': True,
        # 403 Error 우회를 위한 헤더 추가
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        # 클라이언트 우회 (iOS 모드)
        'extractor_args': {
            'youtube': {
                'player_client': ['ios'],
            }
        }
    }
    
    print(f"[{idx}] Downloading audio from: {url}")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        return os.path.join(OUTPUT_DIR, filename + ".mp3")
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return None

def run_stt(audio_path):
    print("Transcribing audio... (This may take a while)")
    result = model.transcribe(audio_path, language='ko')
    
    # [청킹 개선] 통 텍스트가 아니라, 발화 단위(segment)로 줄바꿈해서 반환
    # 이렇게 하면 문장 단위로 데이터가 잘려서 라벨링하기 좋습니다.
    segments = [seg['text'].strip() for seg in result['segments']]
    return "\n".join(segments)

def process_url_list():
    if not os.path.exists(URL_LIST_FILE):
        print(f"No url_list.txt found at {URL_LIST_FILE}")
        return

    with open(URL_LIST_FILE, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    print(f"Found {len(urls)} URLs in list.")
    
    for idx, url in enumerate(urls, 1):
        try:
            print(f"\nProcessing {idx}/{len(urls)}: {url}")
            
            # 1. 오디오 다운로드
            audio_file = download_audio(url, idx)
            if not audio_file: continue
            
            # 2. STT 변환
            text_result = run_stt(audio_file)
            
            # 3. 결과 저장 (영상 ID나 순번으로 저장)
            # URL에서 video_id 추출 시도 (간단히)
            if "v=" in url:
                vid_id = url.split("v=")[1].split("&")[0]
            else:
                vid_id = f"video_{idx}"
                
            save_path = os.path.join(OUTPUT_DIR, f"stt_result_{vid_id}.txt")
            with open(save_path, "w", encoding="utf-8") as f:
                f.write(text_result)
            
            print(f"✅ Saved to: {save_path}")
            
            # 오디오 삭제 (용량 절약)
            if os.path.exists(audio_file):
                os.remove(audio_file)
                print(f"🗑️ Deleted temp audio: {audio_file}")
                
        except Exception as e:
            print(f"Failed to process {url}: {e}")
            
    print("\nAll tasks completed!")

if __name__ == "__main__":
    if os.path.exists(URL_LIST_FILE):
        print(f"Reading from {URL_LIST_FILE}...")
        process_url_list()
    else:
        print("No 'url_list.txt' found. Using manual input mode.")
        print("(Create 'url_list.txt' in the same folder for batch processing)")
        # 기존 수동 모드 (생략 또는 유지)
        while True:
            target_url = input("\nEnter YouTube URL (or 'q' to quit): ").strip()
            if target_url.lower() == 'q': break
            
            audio_file = download_audio(target_url, "manual")
            if audio_file:
                text = run_stt(audio_file)
                save_name = input("Save filename: ").strip() or "output"
                with open(os.path.join(OUTPUT_DIR, f"{save_name}.txt"), "w", encoding="utf-8") as f:
                    f.write(text)
                if os.path.exists(audio_file): os.remove(audio_file)
                print("Saved!")
