"""
01_youtube_downloader.py
========================
유튜브 영상에서 오디오만 추출하여 다운로드

[목적]
- 00_url_list.txt에 있는 유튜브 URL에서 오디오(wav)만 추출
- 게임 음성채팅 데이터 수집을 위한 첫 번째 단계

[입력] 00_url_list.txt (같은 폴더의 유튜브 URL 목록)
[출력] 이 폴더(01_download)에 audio_N.wav(로컬) + audio_N.opus(git/LFS 압축본)

[의존성] pip install yt-dlp
"""

import os
import subprocess
import yt_dlp

# 설정 (이 단계 폴더 = 01_download/ — 오디오·url·스크립트가 함께 있음)
HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = HERE                                       # wav/opus를 이 폴더에 저장
URL_LIST_FILE = os.path.join(HERE, "00_url_list.txt")

os.makedirs(AUDIO_DIR, exist_ok=True)

def download_audio_only(url, idx):
    filename = f"audio_{idx}"
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(AUDIO_DIR, filename), # 확장자는 알아서 붙음
        'noplaylist': True, # [중요] 플레이리스트에 있는 영상이라도 딱 그 영상 하나만 다운로드
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
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

def compress_to_opus(idx):
    """원본 wav → git 보관용 압축본(opus, ~32kbps). 원본 wav는 로컬 STT용으로만 유지."""
    wav = os.path.join(AUDIO_DIR, f"audio_{idx}.wav")
    opus = os.path.join(AUDIO_DIR, f"audio_{idx}.opus")
    if not os.path.exists(wav) or os.path.exists(opus):
        return
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav, "-c:a", "libopus", "-b:a", "32k", opus],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
        )
        print(f"   Compressed (git 보관용) → {os.path.basename(opus)}")
    except Exception as e:
        print(f"   (opus 압축 실패: {e})")

if __name__ == "__main__":
    if not os.path.exists(URL_LIST_FILE):
        print(f"Error: {URL_LIST_FILE} not found.")
        exit(1)

    with open(URL_LIST_FILE, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip()]
    
    print(f"Found {len(urls)} URLs. Starting download...")
    
    for idx, url in enumerate(urls, 1):
        filename_base = f"audio_{idx}"
        expected_wav = f"{filename_base}.wav"
        wav_path = os.path.join(AUDIO_DIR, expected_wav)
        
        # .part 파일이 있는지 확인 (파일명에 .part가 포함된 파일 검색)
        # yt-dlp는 보통 filename.extension.part 형태를 씀
        has_part_file = False
        for fname in os.listdir(AUDIO_DIR):
            if fname.startswith(filename_base) and ".part" in fname:
                has_part_file = True
                break
        
        # wav가 있고, part 파일(미완성본)이 없으면 다운로드는 건너뛰기 (압축본은 보장)
        if os.path.exists(wav_path) and not has_part_file:
            print(f"[{idx}] Skip download (Already exists): {expected_wav}")
        else:
            print(f"[{idx}] Downloading/Resuming...")
            download_audio_only(url, idx)

        # git 보관용 압축본(opus) 생성 (원본 wav는 로컬에만 유지)
        compress_to_opus(idx)
        
    print("\nAll downloads finished! Check this (01_download) folder.")
