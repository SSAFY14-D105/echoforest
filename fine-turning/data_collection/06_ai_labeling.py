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
GMS_ENDPOINT = "https://gms.ssafy.io/gmsapi/api.openai.com/v1/responses"
MODEL_NAME = "gpt-5.2-pro"  # High reasoning model

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

# 배치 설정 (Pro 모델은 느리므로 배치 사이즈를 적절히 유지)
BATCH_SIZE = 10 

# ==========================================
# 🧠 Prompts
# ==========================================
SYSTEM_PROMPT = """
You are an expert data labeler for a 'Cooperative Game Voice Chat Analysis System'.
Your task is to classify sentences into 8 categories (Multi-label).

**Input Format**:
You will receive a list of sentences. Some may have 'HINT' provided.
- If 'HINT' exists (e.g., abuse=1), MUST respect it as Ground Truth.
- Analyze context to fill in missing labels (blame, order, anger, etc.).

**Target Labels (8 Classes)**:
1. abuse (욕설/패드립): Profanity, strong insults (Hint overrides this).
2. hate (기타혐오): Discrimination (Gender/Race/Region) (Hint overrides this).
3. clean (일반대화): Casual chat, unrelated to game strategy/negativity.
4. blame (남탓/정치): Blaming teammates, aggressive criticism.
5. anger (감정표출): Expressing annoyance/anger without specific target.
6. frustration (좌절/한숨): Giving up, self-blame ("하...", "망했네").
7. praise (칭찬): Encouragement ("Nice", "Carry").
8. order (게임오더/전략): Tactical instructions ("Go mid", "Back").

**Example**:
Input: {"text": "야 개새끼야 오른쪽 가라고", "hint": {"abuse": 1}}
Output: ["abuse", "order", "anger"] (Respects abuse=1, detects order & anger)

Input: {"text": "하 진짜 게임 못해먹겠네", "hint": {}}
Output: ["frustration", "anger"]

Input: {"text": "나이스 캐리요", "hint": {"clean": 1}}
Output: ["praise"] (Hint says clean, but praise is specific positive nuance. If context is strictly praise, remove clean or keep neutral. For this system, Praise is NOT clean. So override clean if needed, BUT respect abuse/hate hints strictly.)

**Strict Rule**:
- Output ONLY a JSON list of objects.
"""

# ==========================================
# 🛠️ Helper Functions
# ==========================================

def call_gms_api(prompt_messages):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GMS_API_KEY}"
    }
    
    # Construct input for GMS (It assumes Chat Completion structure or similar)
    # The user provided example uses 'input' field for simple prompt, 
    # but GMS likely supports messages for chat models. 
    # Let's try the standard chat format if possible, or fallback to simple string.
    # Given the example: "input": "Tell me..."
    
    # We will combine system + user into one big string for the 'input' field 
    # because the example shows a simple "input" field.
    
    full_prompt = f"{SYSTEM_PROMPT}\n\nTask:\n{prompt_messages}"
    
    payload = {
        "model": MODEL_NAME,
        "input": full_prompt
    }
    
    try:
        response = requests.post(GMS_ENDPOINT, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        
        # Parse output (Assuming OpenAI-like response structure or specific GMS structure)
        # Standard OpenAI: choices[0].message.content
        # GMS Example output not shown, but usually follows OpenAI or is direct text.
        # Let's assume it returns text in 'choices' or direct 'output'
        
        # *Critial*: GMS responses endpoint might differ. 
        # Debugging: let's print keys if unknown.
        if 'choices' in result:
             return result['choices'][0]['message']['content']
        elif 'output' in result: # Some custom wrappers
             return result['output']
        else:
             # Fallback: try to find any text field
             return str(result)
             
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
    
    # [COST SAFETY] 테스트용 제한 (비용 확인 후 제거하세요!)
    TEST_LIMIT = 20
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
