import os
import csv
import time
import json
import shutil
import pandas as pd
from datetime import datetime
from tqdm import tqdm

try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
except ImportError:
    print("Error: 'google-generativeai' not installed.")
    print("Run: pip install google-generativeai")
    exit(1)

# ==========================================
# 설정
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "processed_data", "03_anonymized", "final_dataset.tsv")
OUTPUT_DIR = os.path.join(BASE_DIR, "processed_data", "05_auto_labeled")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "gemini_labeled_17k.tsv")
ARCHIVE_DIR = os.path.join(BASE_DIR, "processed_data", "archive", "05_auto_labeled_history")

BATCH_SIZE = 20  # 한 번에 20문장씩 처리 (속도/토큰 최적화)
MODEL_NAME = "gemini-1.5-flash" # 가성비/속도 최강 모델

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# API 키 설정 (환경변수 또는 직접 입력)
# os.environ["GOOGLE_API_KEY"] = "YOUR_KEY_HERE" 

def get_api_key():
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        print("\n[Input Required] Google Gemini API Key가 필요합니다.")
        key = input("Paste your API Key: ").strip()
        genai.configure(api_key=key)
    return key

def create_prompt(sentences):
    prompt = """
You are an AI moderator for a Korean online game (League of Legends style).
Analyze the following sentences and classify them into 8 categories.
Multi-label is allowed (e.g., Abuse + Blame).

Categories:
1. abuse: 욕설, 패드립, 심한 비속어 (Direct profanity)
2. hate: 혐오 발언 (여성/남성/지역/종교/장애인 등) (Hate speech)
3. clean: 일반적인 대화, 잡담, 정보 공유 (Neutral/Chat) - *Not game commands*
4. blame: 남 탓, 팀원 비난, 정치질 ("너 때문에", "뭐하냐")
5. anger: 단순 분노 표출, 짜증 ("아 진짜", "화나네") - 남을 탓하지 않고 감정만 표현
6. frustration: 좌절, 한숨, 포기 ("하...", "망했다", "서렌치자")
7. praise: 칭찬, 격려, 긍정 ("나이스", "잘한다")
8. order: 게임 오더, 전략 지시, 행동 요청 ("이리로 와", "오른쪽 가자", "점프해", "빼자")

**Output Format**: 
Return a STRICT JSON list of objects. No markdown formatting.
Example:
[
  {"id": 0, "labels": ["clean"]},
  {"id": 1, "labels": ["blame", "abuse"]},
  {"id": 2, "labels": ["order"]},
  {"id": 3, "labels": ["order", "praise"]}
]

Sentences to analyze:
"""
    for idx, sent in enumerate(sentences):
        prompt += f"{idx}. {sent}\n"
        
    return prompt

def main():
    # 1. API 키 확인
    if not os.getenv("GOOGLE_API_KEY"):
         get_api_key()
    
    # 모델 설정
    generation_config = {
        "temperature": 0.1, 
        "response_mime_type": "application/json",
    }
    
    # 안전 설정 해제
    safety_settings = {
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    }

    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        generation_config=generation_config,
        safety_settings=safety_settings
    )

    # 2. 데이터 로드
    print(f"Loading data from {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE, sep='\t')
    all_sentences = df['sentence'].dropna().tolist()
    total_len = len(all_sentences)
    print(f"Total Sentences: {total_len}")

    # 3. 기존 진행상황 확인
    processed_count = 0
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                processed_count = sum(1 for _ in f) - 1
            print(f"Found existing file with {processed_count} rows. Resuming...")
        except:
            processed_count = 0

    mode = 'a' if processed_count > 0 else 'w'
    
    # 헤더 8개로 수정
    headers = ['sentence', '악플/욕설', '기타_혐오', 'clean', '남탓', '감정표출', '좌절', '칭찬', '게임오더']
    
    with open(OUTPUT_FILE, mode, encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
        
        if processed_count == 0:
            writer.writeheader()
        
        # 배치 처리
        current_batch_start = processed_count
        
        pbar = tqdm(total=total_len, initial=processed_count)
        
        while current_batch_start < total_len:
            batch_end = min(current_batch_start + BATCH_SIZE, total_len)
            batch_sentences = all_sentences[current_batch_start:batch_end]
            
            prompt = create_prompt(batch_sentences)
            
            retry_count = 0
            success = False
            
            while not success and retry_count < 3:
                try:
                    response = model.generate_content(prompt)
                    result_json = json.loads(response.text)
                    
                    for item in result_json:
                        idx = item.get('id')
                        labels = item.get('labels', [])
                        
                        original_sent = batch_sentences[idx]
                        
                        row = {
                            'sentence': original_sent,
                            '악플/욕설': 1 if 'abuse' in labels else 0,
                            '기타_혐오': 1 if 'hate' in labels else 0,
                            'clean': 1 if 'clean' in labels else 0,
                            '남탓': 1 if 'blame' in labels else 0,
                            '감정표출': 1 if 'anger' in labels else 0,
                            '좌절': 1 if 'frustration' in labels else 0,
                            '칭찬': 1 if 'praise' in labels else 0,
                            '게임오더': 1 if 'order' in labels else 0, # New
                        }
                        writer.writerow(row)
                        
                    f.flush()
                    success = True
                    pbar.update(len(batch_sentences))
                    current_batch_start += BATCH_SIZE
                    time.sleep(1) 
                    
                except Exception as e:
                    print(f"\n[Error] Batch {current_batch_start}: {e}")
                    print("Retrying in 5 seconds...")
                    time.sleep(5)
                    retry_count += 1
            
            if not success:
                print(f"\n[Fail] Skipping batch starting at {current_batch_start}")
                current_batch_start += BATCH_SIZE 
                
        pbar.close()

    # 아카이브 저장
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_file = os.path.join(ARCHIVE_DIR, f"gemini_labeled_{timestamp}.tsv")
    shutil.copy(OUTPUT_FILE, archive_file)

    print(f"\nCompleted! Saved to {OUTPUT_FILE}")
    print(f"Archived to: {archive_file}")

if __name__ == "__main__":
    main()
