"""
02_whisper_transcriber.py
=========================
Whisper 모델로 오디오를 텍스트로 변환 (STT)

[목적]
- raw_audio/*.wav 오디오 파일을 텍스트로 변환
- faster-whisper (large-v3) 모델 사용
- GPU 가속 지원 (CUDA)

[입력] raw_audio/*.wav
[출력] raw_data/01_faster_whisper/*.tsv

[의존성] pip install faster-whisper kiwipiepy torch
"""

import os
import glob
import torch
from faster_whisper import WhisperModel
from kiwipiepy import Kiwi

# ==========================================
# 설정 (Configuration)
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, "raw_audio")       # 원본 오디오 폴더
OUTPUT_DIR = os.path.join(BASE_DIR, "raw_data", "01_faster_whisper")    # 결과 텍스트 저장 폴더

# [수정됨] NVIDIA 라이브러리 경로 자동 탐색 및 등록 (CUDA 12 호환성 강화)
def setup_nvidia_paths():
    if os.name != 'nt':
        return

    print("Checking NVIDIA/CUDA libraries for Windows...")
    libs_to_add = set()
    
    # site-packages 위치 찾기
    import site
    site_dirs = []
    try: site_dirs.extend(site.getsitepackages())
    except AttributeError: pass
    try: site_dirs.append(site.getusersitepackages())
    except AttributeError: pass

    # 필수 DLL 파일명 패턴
    target_dlls = ['cublas64_12.dll', 'cudnn64_8.dll', 'cudnn64_9.dll']
    found_dlls = {}

    for site_pkg in site_dirs:
        # 1. nvidia 패키지 검색 (가장 일반적)
        nvidia_dir = os.path.join(site_pkg, 'nvidia')
        if os.path.exists(nvidia_dir):
            for root, dirs, files in os.walk(nvidia_dir):
                for file in files:
                    if file in target_dlls or (file.startswith('cudnn') and file.endswith('.dll')):
                        # 해당 DLL이 있는 폴더를 추가
                        libs_to_add.add(root)
                        found_dlls[file] = root
                
                # bin 폴더는 무조건 후보로 추가
                if 'bin' in dirs:
                    libs_to_add.add(os.path.join(root, 'bin'))

        # 2. torch/lib 검색
        torch_lib = os.path.join(site_pkg, 'torch', 'lib')
        if os.path.exists(torch_lib):
            libs_to_add.add(torch_lib)

    # 3. DLL 디렉토리 등록
    added = 0
    for lib_path in libs_to_add:
        if os.path.exists(lib_path):
            try:
                # 3.1 Python DLL 로드 경로 추가
                os.add_dll_directory(lib_path)
                
                # 3.2 시스템 PATH에도 추가 (CTranslate2 등 일부 라이브러리는 PATH를 참조할 수 있음)
                if lib_path not in os.environ['PATH']:
                    os.environ['PATH'] = lib_path + ';' + os.environ['PATH']
                
                added += 1
            except Exception as e:
                pass

    if 'cublas64_12.dll' in found_dlls:
        print(f"✅ Found cublas64_12.dll at: {found_dlls['cublas64_12.dll']}")
    else:
        print("⚠️ cublas64_12.dll not found in standard nvidia paths. GPU inference might fail.")

    if added > 0:
        print(f"✅ Registered {added} NVIDIA/CUDA library paths (dll_directory + PATH).")

setup_nvidia_paths()

# Whisper 모델 설정
import ctranslate2
cuda_count = ctranslate2.get_cuda_device_count()

if torch.cuda.is_available() and cuda_count > 0:
    DEVICE = "cuda"
    COMPUTE_TYPE = "float16"
    print(f"✅ GPU Mode Active: Found {cuda_count} device(s). Using float16.")
else:
    DEVICE = "cpu"
    COMPUTE_TYPE = "int8"
    print(f"⚠️ GPU not found or CTranslate2 cannot see it. Falling back to CPU (int8).")
    print(f"   (torch.cuda.is_available={torch.cuda.is_available()}, ctranslate2.get_cuda_device_count={cuda_count})")

# 모델 크기
MODEL_SIZE = "large-v3" 

def main():
    # 1. 출력 디렉토리 생성
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Kiwi 초기화 (문장 분리기)
    print("Loading Kiwi (Sentence Splitter)...")
    kiwi = Kiwi()
    
    # 2. 모델 로드
    print(f"Loading Whisper Model ({MODEL_SIZE}) on {DEVICE}...")
    try:
        model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    except Exception as e:
        print(f"Error loading model: {e}")
        print("Tip: GPU VRAM이 부족하면 MODEL_SIZE를 'medium'이나 'small'로 줄여보세요.")
        return

    # 3. 오디오 파일 목록 가져오기 (.wav)
    audio_files = glob.glob(os.path.join(AUDIO_DIR, "*.wav"))
    audio_files.sort() # 순서대로 처리
    
    print(f"Found {len(audio_files)} audio files.")

    for idx, audio_path in enumerate(audio_files, 1):
        filename = os.path.basename(audio_path)
        file_id = os.path.splitext(filename)[0] # 확장자 제거 (예: audio_1)
        output_path = os.path.join(OUTPUT_DIR, f"{file_id}.tsv")
        
        # 이미 처리된 파일 건너뛰기 (필요시 주석 처리)
        if os.path.exists(output_path):
            print(f"[{idx}/{len(audio_files)}] Skip (Already exists): {filename}")
            continue

        print(f"\n[{idx}/{len(audio_files)}] Processing: {filename}")
        
        try:
            # 3-1. Transcribe (Whisper)
            # [수정됨] 욕설/비속어 수집을 위한 프롬프트 강화 및 필터링 해제 시도
            print("   - Transcribing & Chunking (Allowing profanity)...")
            
            segments, info = model.transcribe(
                audio_path, 
                beam_size=5, 
                language="ko",
                initial_prompt="욕설, 비속어, 은어, 나쁜 말을 검열하지 말고 들리는 대로 정확하게 적어주세요.",
                condition_on_previous_text=False
            )
            
            print(f"   - Detected language: {info.language} (Probability: {info.language_probability:.2f})")
            
            # [수정됨] .tsv 파일로 실시간 진행 상황 저장
            # 1. 먼저 진행 중에는 Raw 데이터를 .tsv에 씁니다.
            # 2. 모든 변환이 끝나면 Kiwi로 다듬어진 문장으로 덮어씁니다.
            chunks = []
            print(f"   - Saving progress directly to {os.path.basename(output_path)} every 100 segments...")
            
            # Unsmile 데이터셋 형식 헤더 (개인지칭 -> 팀원사기저하 변경)
            TSV_HEADER = "문장\t여성/가족\t남성\t성소수자\t인종/국적\t연령\t지역\t종교\t기타 혐오\t악플/욕설\tclean\t팀원사기저하"
            
            # 'w' 모드로 열어서 시작 (기존 내용 있으면 날아감)
            with open(output_path, "w", encoding="utf-8") as f:
                # 헤더 기록
                f.write(TSV_HEADER + "\n")
                
                for i, segment in enumerate(segments, 1):
                    text = segment.text.strip()
                    print(f"     [{segment.start:.1f}s -> {segment.end:.1f}s] {text}")
                    chunks.append(text)
                    
                    # 실시간 기록 (문장만 깔끔하게)
                    f.write(text + "\n")
                    
                    # 100문장마다 강제 저장
                    if i % 100 == 0:
                        f.flush()
                        os.fsync(f.fileno())
                        print(f"     [Auto-Save] Saved {i} segments.")
            
            full_text = " ".join(chunks)
            
            # 3-2. Sentence Splitting (Kiwi)
            # 모든 텍스트가 모이면 Kiwi로 문맥에 맞게 다시 쪼갭니다.
            print("   - Refining sentences with Kiwi...")
            sentences = [s.text for s in kiwi.split_into_sents(full_text)]
            
            # 3-3. Final Save (덮어쓰기)
            # Kiwi로 깔끔하게 정리된 문장들로 최종 저장
            with open(output_path, "w", encoding="utf-8") as f:
                # 헤더 다시 기록
                f.write(TSV_HEADER + "\n")
                
                for sent in sentences:
                    clean_sent = sent.strip()
                    if len(clean_sent.replace(" ", "")) < 2:
                        continue
                    # 최종 문장만 기록
                    f.write(clean_sent + "\n")
                    
            print(f"   - Done! Saved {len(sentences)} sentences to {os.path.basename(output_path)}")
            
        except Exception as e:
            print(f"   - Failed to process {filename}: {e}")

if __name__ == "__main__":
    print("Pre-requisites: pip install faster-whisper kss torch")
    main()
