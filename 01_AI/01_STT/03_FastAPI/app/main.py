from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from app.transcriber import Transcriber
import time
import shutil
import os

app = FastAPI()

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모델 초기화 (서버 시작 시 로드)
# "tiny", "base", "small", "medium", "large-v3" 중 선택
MODEL_SIZE = "base" 
transcriber = Transcriber(model_size=MODEL_SIZE)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AI Server is running"}

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    start_time = time.time()
    
    # 1. 파일 임시 저장
    temp_filename = f"temp_{file.filename}_{int(start_time)}.webm"
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. 모델 추론
        text, info = transcriber.transcribe(temp_filename)
        
        # 3. 결과 반환
        process_time = time.time() - start_time
        return {
            "text": text,
            "language": info.language,
            "probability": info.language_probability,
            "latency_ms": int(process_time * 1000)
        }
    
    finally:
        # 4. 임시 파일 삭제
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
