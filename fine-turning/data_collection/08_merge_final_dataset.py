import csv
import os
import random
import shutil
from datetime import datetime

# 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILE_UNSMILE = os.path.join(BASE_DIR, "processed_data", "00_Unsmile", "unsmile_converted_8label.tsv")
FILE_AUTO = os.path.join(BASE_DIR, "processed_data", "05_auto_labeled", "gemini_labeled_17k.tsv")

OUTPUT_DIR = os.path.join(BASE_DIR, "processed_data", "06_final_training")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "final_train_monitor.tsv")
ARCHIVE_DIR = os.path.join(BASE_DIR, "processed_data", "archive", "06_final_history")

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def load_data(filepath, source_name):
    data = []
    if not os.path.exists(filepath):
        print(f"[{source_name}] File not found: {filepath}")
        return []
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='\t')
            for row in reader:
                # 소스 태그 추가 (나중에 분석용)
                row['source'] = source_name
                # 필요한 컬럼만 추출 (혹시 모를 공백 제거)
                clean_row = {k.strip(): v for k, v in row.items() if k}
                data.append(clean_row)
    except Exception as e:
        print(f"[{source_name}] Error loading: {e}")
    
    print(f"[{source_name}] Loaded {len(data)} rows.")
    return data

def main():
    print("=== Merging Datasets ===")
    
    # 1. 데이터 로드
    data_unsmile = load_data(FILE_UNSMILE, "unsmile")
    data_auto = load_data(FILE_AUTO, "gemini_17k")
    
    if not data_unsmile and not data_auto:
        print("No data loaded. Exiting.")
        return

    # 2. 합치기
    all_data = data_unsmile + data_auto
    print(f"Total Combined Rows: {len(all_data)}")
    
    # 3. 셔플 (학습 효율 위해)
    random.shuffle(all_data)
    
    # 4. 저장
    # 헤더: source 포함
    headers = ['sentence', '악플/욕설', '기타_혐오', 'clean', '남탓', '감정표출', '좌절', '칭찬', '게임오더', 'source']
    
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
            writer.writeheader()
            writer.writerows(all_data)
            
        print(f"Successfully saved final training data to: {OUTPUT_FILE}")
        
        # 간단 통계
        count_clean = sum(1 for r in all_data if str(r.get('clean')) == '1')
        print(f" - Clean Sample Count: {count_clean} ({count_clean/len(all_data)*100:.1f}%)")
        
        # 아카이브 저장
        if not os.path.exists(ARCHIVE_DIR):
            os.makedirs(ARCHIVE_DIR)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_file = os.path.join(ARCHIVE_DIR, f"final_train_{timestamp}.tsv")
        shutil.copy(OUTPUT_FILE, archive_file)

        print(f"Archived to: {archive_file}")
        
    except Exception as e:
        print(f"Error saving file: {e}")

if __name__ == "__main__":
    main()
