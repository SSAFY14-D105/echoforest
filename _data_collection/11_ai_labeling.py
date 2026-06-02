"""
11_ai_labeling.py
=================
Gemini/GPT API를 사용한 AI 라벨링 (선택적 사용)

[목적]
- GMS API (GPT-4o-mini)를 사용하여 문장을 8라벨로 분류
- UnSmile 3라벨 힌트를 참고하여 더 정확한 분류
- 비용이 발생하므로 TEST_LIMIT로 제한

[입력]
- processed_data/05_external/unsmile_3label.tsv (힌트 있음)
- processed_data/04_anonymized/final_dataset.tsv (힌트 없음)

[출력] processed_data/06_ai_labeled/gemini_labeled_17k.tsv

[의존성] pip install requests tqdm
[비용 주의] GMS 크레딧 소모됨
"""

import os
import csv
import time
import json
import random
import requests
import shutil
from datetime import datetime
from tqdm import tqdm

# ==========================================
# 🔑 GMS 설정 (사용자 입력 필요)
# ==========================================
GMS_API_KEY = os.getenv("GMS_KEY") or "YOUR_GMS_KEY_HERE"
GMS_ENDPOINT = "https://gms.ssafy.io/gmsapi/api.openai.com/v1/chat/completions"
MODEL_NAME = "gpt-4o-mini"  # Best Balance (Smart & Cheap)

# ==========================================
# 📂 경로 설정
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 입력 1: UnSmile (3라벨 힌트 있음)
FILE_UNSMILE = os.path.join(BASE_DIR, "processed_data", "05_external", "unsmile_3label.tsv")
# 입력 2: STT (라벨 없음)
FILE_STT = os.path.join(BASE_DIR, "processed_data", "04_anonymized", "final_dataset.tsv")

# 출력
OUTPUT_DIR = os.path.join(BASE_DIR, "processed_data", "06_ai_labeled")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "gemini_labeled_17k.tsv")
ARCHIVE_DIR = os.path.join(BASE_DIR, "processed_data", "archive", "06_ai_labeled_history")

# 배치 설정
BATCH_SIZE = 50

# ==========================================
# 🧠 Prompts
# ==========================================
SYSTEM_PROMPT = """
You are an expert data labeler for a 'Cooperative Game Voice Chat Analysis System'.
Your task is to classify sentences into 8 categories (Multi-label).

**Input Format**:
You will receive a JSON list of sentences. Some objects have a 'hint' (existing labels).
- **HINT Rule**: If 'hint' is provided (e.g., abuse=1), you MUST start with these labels.
- **Context Rule**: Analyze the korean text to add missing labels (blame, order, anger, etc.).
- **Clean Rule**: 'clean' means "Neutral/Chat". If the sentence is 'praise' or 'order' or 'blame', then 'clean' must be removed (turn off).

**Target Labels (8 Classes)**:
1. abuse (욕설/패드립): Profanity, strong insults.
2. hate (기타혐오): Discrimination (Gender/Race/Region).
3. clean (일반대화): Neutral chat only. (NOT order, NOT praise).
4. blame (남탓/정치): Blaming teammates, aggressive criticism.
5. anger (감정표출): Expressing annoyance/anger without specific target.
6. frustration (좌절/한숨): Giving up, self-blame ("하...", "망했네").
7. praise (칭찬): Encouragement ("Nice", "Carry").
8. order (게임오더/전략): Tactical instructions ("Go mid", "Back").

**Few-Shot Examples (Batch)**:
Input:
[
  {"text": "야 개새끼야 오른쪽 가라고", "hint": {"abuse": 1}},
  {"text": "하 진짜 게임 못해먹겠네", "hint": {}},
  {"text": "나이스 캐리요", "hint": {"clean": 1}},
  {"text": "밥 먹고 올게", "hint": {"clean": 1}}
]

Output:
[
  {"labels": ["abuse", "order", "anger"]}, 
  {"labels": ["frustration", "anger"]},
  {"labels": ["praise"]},
  {"labels": ["clean"]}
]
(Explanation:
 1. Hint 'abuse' kept. added 'order' & 'anger'.
 2. No hint. Detected 'frustration' & 'anger'.
 3. Hint 'clean' REMOVED because 'praise' is detected.
 4. Pure chat -> 'clean' kept.)

**Strict Output Rule**:
- Return ONLY a valid JSON List of Objects.
- Each object must have a "labels" key.
"""

def call_gms_api(prompt_messages):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GMS_API_KEY}"
    }
    
    # GMS 'v1/chat/completions' format
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "developer", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Task:\n{prompt_messages}"}
        ]
    }
    
    try:
        response = requests.post(GMS_ENDPOINT, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        content = None
        if 'choices' in result:
             content = result['choices'][0]['message']['content']
        elif 'output' in result: 
             content = result['output']
        else:
             content = str(result)
             
        # [Fix] Handle List response
        if isinstance(content, list):
            # If it's a list of strings, join them
            if content and isinstance(content[0], str):
                content = "\n".join(content)
            else:
                content = json.dumps(content, ensure_ascii=False)
                
        return str(content)
             
    except Exception as e:
        print(f"API Error: {e}")
        return None

def load_data():
    all_data = []
    
    # 1. Load UnSmile (With Hints)
    if os.path.exists(FILE_UNSMILE):
        print(f"Loading UnSmile: {FILE_UNSMILE}")
        with open(FILE_UNSMILE, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter='\t')
            for row in reader:
                # Hint 구성
                hint = {}
                if row.get('욕설/악플') == '1': hint['abuse'] = 1
                if row.get('기타혐오') == '1': hint['hate'] = 1
                if row.get('clean') == '1': hint['clean'] = 1
                
                all_data.append({
                    "text": row['sentence'],
                    "source": "unsmile",
                    "hint": hint
                })
    
    # 2. Load STT (No Hints)
    if os.path.exists(FILE_STT):
        print(f"Loading STT: {FILE_STT}")
        with open(FILE_STT, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter='\t')
            for row in reader:
                all_data.append({
                    "text": row['sentence'],
                    "source": "stt",
                    "hint": {} # 빈 힌트
                })
                
    print(f"Total Combined Data: {len(all_data)} rows")
    random.shuffle(all_data) # 섞어주기
    return all_data

def main():
    global GMS_API_KEY
    if "YOUR_GMS_KEY" in GMS_API_KEY:
        GMS_API_KEY = input("🔑 Enter your GMS API Key: ").strip()
        
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    data = load_data()
    
    # 기존에 하던 거 있으면 이어하기 (Skip logic)
    processed_sentences = set()
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter='\t')
            next(reader, None)
            for row in reader:
                if row: processed_sentences.add(row[0])
    
    print(f"Already processed: {len(processed_sentences)}")
    data_to_process = [d for d in data if d['text'] not in processed_sentences]
    print(f"Remaining to process: {len(data_to_process)}")

    # CSV Writer 준비
    f_mode = 'a' if os.path.exists(OUTPUT_FILE) else 'w'
    
    # [COST SAFETY] 테스트용 제한 (비용 확인용: 50개만 실행)
    TEST_LIMIT = 50 # 배치 1회분
    total_processed_session = 0
    
    with open(OUTPUT_FILE, f_mode, encoding='utf-8', newline='') as f:
        headers = ['sentence', '악플/욕설', '기타_혐오', 'clean', '남탓', '감정표출', '좌절', '칭찬', '게임오더', 'source']
        writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
        if f_mode == 'w':
            writer.writeheader()

        # Batch Processing
        for i in tqdm(range(0, len(data_to_process), BATCH_SIZE)):
            # [COST SAFETY] 리미트 체크
            if total_processed_session >= TEST_LIMIT:
                print(f"\n🛑 [TEST MODE] {TEST_LIMIT}개 처리 후 안전하게 중단합니다.")
                print("1. GMS 대시보드에서 크레딧 차감을 확인하세요.")
                print("2. 비용이 괜찮다면 코드에서 'TEST_LIMIT = 999999'로 수정하고 다시 실행하세요.")
                break
                
            batch = data_to_process[i : i + BATCH_SIZE]
            
            # Prepare Prompt
            batch_input = []
            for item in batch:
                batch_input.append({
                    "text": item['text'],
                    "hint": item['hint']
                })
            
            prompt_text = json.dumps(batch_input, ensure_ascii=False, indent=2)
            
            # Call API
            response_text = call_gms_api(prompt_text)
            
            # [DEBUG] 첫 번째 응답만 화면에 출력 (문제 확인용)
            if total_processed_session == 0 and response_text:
                print("\n[DEBUG] API Response (first 500 chars):")
                print(response_text[:500])
                print("=" * 50)
            
            if not response_text:
                print("API failed, skipping batch...")
                continue
                
            # Parse Response
            try:
                # LLM might return Markdown ```json ... ```
                clean_json = response_text.replace("```json", "").replace("```", "").strip()
                results = json.loads(clean_json)
                
                # Validation
                if len(results) != len(batch):
                    print(f"Warning: Batch size mismatch (Sent: {len(batch)}, Recv: {len(results)})")
                    continue
                    
                for item, res in zip(batch, results):
                    labels = res.get('labels', [])
                    
                    row = {
                        'sentence': item['text'],
                        'source': item['source'],
                        '악플/욕설': 1 if 'abuse' in labels else 0,
                        '기타_혐오': 1 if 'hate' in labels else 0,
                        'clean': 1 if 'clean' in labels else 0,
                        '남탓': 1 if 'blame' in labels else 0,
                        '감정표출': 1 if 'anger' in labels else 0,
                        '좌절': 1 if 'frustration' in labels else 0,
                        '칭찬': 1 if 'praise' in labels else 0,
                        '게임오더': 1 if 'order' in labels else 0,
                    }
                    writer.writerow(row)
                    total_processed_session += 1
                    f.flush() # 실시간 저장
                    
            except json.JSONDecodeError:
                print(f"JSON Parsing Error: {response_text[:100]}...")
            except Exception as e:
                print(f"Error processing batch: {e}")
                
            time.sleep(0.5) # Rate Limit 방지

    print("Done! Archived history...")
    if not os.path.exists(ARCHIVE_DIR): os.makedirs(ARCHIVE_DIR)
    shutil.copy(OUTPUT_FILE, os.path.join(ARCHIVE_DIR, f"labeled_{datetime.now().strftime('%Y%m%d_%H%M%S')}.tsv"))

if __name__ == "__main__":
    main()
