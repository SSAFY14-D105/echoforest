
import os
import yt_dlp

# 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "raw_audio")   # 오디오 저장소
URL_LIST_FILE = os.path.join(BASE_DIR, "url_list.txt")

os.makedirs(AUDIO_DIR, exist_ok=True)

def download_audio_only(url, idx):
    filename = f"audio_{idx}"
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(AUDIO_DIR, filename), # 확장자는 알아서 붙음
        'noplaylist': True, # [중요] 플레이리스트에 있는 영상이라도 딱 그 영상 하나만 다운로드
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        # 403 Error Bypass (Android Client) - 초기 성공 설정
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        'extractor_args': {
            'youtube': {
                'player_client': ['android'],
            }
        },
        'quiet': False 
    }
    
    print(f"\n[{idx}] Downloading: {url}")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            duration = info.get('duration_string', 'unknown')
            title = info.get('title', 'unknown')
            print(f"   Done! Title: {title} / Duration: {duration}")
            
    except Exception as e:
        print(f"   Failed: {e}")

if __name__ == "__main__":
    if not os.path.exists(URL_LIST_FILE):
        print(f"Error: {URL_LIST_FILE} not found.")
        exit(1)

    with open(URL_LIST_FILE, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    print(f"Found {len(urls)} URLs. Starting download...")
    
    for idx, url in enumerate(urls, 1):
        download_audio_only(url, idx)
        
    print("\nAll downloads finished! Check 'raw_audio' folder.")
