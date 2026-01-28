
import os
import re
import pandas as pd

# 경로 설정
# 현재: fine-turning/preprocessing/preprocess_stt.py
# 목표: fine-turning/unsmile/train/...
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # fine-turning 폴더

# 입력 파일 (원본)
TRAIN_FILE = os.path.join(BASE_DIR, 'unsmile', 'train', 'unsmile_train_v1.0.tsv')
VALID_FILE = os.path.join(BASE_DIR, 'unsmile', 'train', 'unsmile_valid_v1.0.tsv')

# 출력 폴더 (unsmile 폴더 내에 생성)
OUTPUT_DIR = os.path.join(BASE_DIR, 'unsmile', 'train_stt')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 로그 파일 경로
LOG_FILE = os.path.join(OUTPUT_DIR, 'preprocessing_log.txt')

def clean_text_for_stt(text):
    if pd.isna(text):
        return ""
    # 1. 자음/모음만 있는 경우 제거 (예: ㅋㅋ, ㅠㅠ, ㅎㅎ, ㅂㄷㅂㄷ)
    text = re.sub(r'[ㄱ-ㅎㅏ-ㅣ]+', '', str(text))
    
    # 2. 다중 공백을 하나의 공백으로 줄임
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def process_and_save(input_path, output_filename, log_f):
    dataset_name = os.path.basename(input_path)
    print(f"Processing {dataset_name}...")
    log_f.write(f"\n{'='*50}\n")
    log_f.write(f"Dataset: {dataset_name}\n")
    log_f.write(f"{'='*50}\n")
    
    try:
        df = pd.read_csv(input_path, sep='\t')
        total_count = len(df)
        
        # 변경 전후 비교를 위해 원본 저장
        df['original_문장'] = df['문장'].astype(str)
        df['cleaned_문장'] = df['문장'].apply(clean_text_for_stt)
        
        # 1. 변경된 행 찾기
        changed_rows = df[
            (df['original_문장'] != df['cleaned_문장']) & 
            (df['cleaned_문장'].str.len() > 0)
        ]
        
        # 2. 삭제 대상 (빈 문장이 된 경우)
        empty_rows = df[df['cleaned_문장'].str.len() == 0]
        
        # 3. 너무 짧은 문장 (1글자)
        short_rows = df[df['cleaned_문장'].str.len() == 1]
        
        # --- [통계 기록] ---
        log_f.write(f"[Stats]\n")
        log_f.write(f" - Total Rows: {total_count}\n")
        log_f.write(f" - Modified (Consonants Removed): {len(changed_rows)} rows\n")
        log_f.write(f" - Deleted (Empty after clean): {len(empty_rows)} rows\n")
        log_f.write(f" - Warning (1 char left): {len(short_rows)} rows\n")
        log_f.write(f" - Final Saved Rows: {total_count - len(empty_rows)}\n\n")

        # --- [상세 로그 1: 삭제된 문장] ---
        if len(empty_rows) > 0:
            log_f.write(f"[Details: DELETED Rows] ({len(empty_rows)})\n")
            log_f.write("-" * 60 + "\n")
            for idx, row in empty_rows.iterrows():
                # 라벨 추출 (컬럼명 중 1인 것)
                labels = [col for col in df.columns[1:-2] if row[col] == 1]
                label_str = ", ".join(labels) if labels else "Clean"
                log_f.write(f"Line {idx:<5} | {label_str:<20} | \"{row['original_문장']}\"\n")
            log_f.write("-" * 60 + "\n\n")
            
        # --- [상세 로그 2: 1글자 문장] ---
        if len(short_rows) > 0:
            log_f.write(f"[Details: SHORT Rows (1 char)] ({len(short_rows)})\n")
            log_f.write("-" * 60 + "\n")
            for idx, row in short_rows.iterrows():
                labels = [col for col in df.columns[1:-2] if row[col] == 1]
                label_str = ", ".join(labels) if labels else "Clean"
                log_f.write(f"Line {idx:<5} | {label_str:<20} | \"{row['original_문장']}\" -> \"{row['cleaned_문장']}\"\n")
            log_f.write("-" * 60 + "\n\n")
            
        # --- [상세 로그 3: 변경된 문장 전체 (Change Log)] ---
        if len(changed_rows) > 0:
            log_f.write(f"[Details: MODIFIED Rows (Consonants removed)] ({len(changed_rows)})\n")
            log_f.write("-" * 60 + "\n")
            for idx, row in changed_rows.iterrows():
                log_f.write(f"Line {idx:<5} | \"{row['original_문장']}\" -> \"{row['cleaned_문장']}\"\n")
            log_f.write("-" * 60 + "\n\n")

        # 실제 삭제 수행 및 저장
        df = df[df['cleaned_문장'].str.len() > 0]
        
        # 컬럼 원복
        df['문장'] = df['cleaned_문장']
        df = df.drop(columns=['original_문장', 'cleaned_문장'])
        
        # 저장
        output_path = os.path.join(OUTPUT_DIR, output_filename)
        df.to_csv(output_path, sep='\t', index=False)
        print(f"Saved to {output_path} (Removed {len(empty_rows)} lines)")
        
    except FileNotFoundError:
        print(f"Error: File not found at {input_path}")

# 실행
if __name__ == "__main__":
    with open(LOG_FILE, 'w', encoding='utf-8') as log_f:
        print("=== STT Preprocessing Start ===")
        log_f.write("STT Preprocessing Full Report\n")
        
        process_and_save(TRAIN_FILE, 'unsmile_train_stt.tsv', log_f)
        process_and_save(VALID_FILE, 'unsmile_valid_stt.tsv', log_f)
        
        print("=== Complete ===")
        print(f"Check the log file: {LOG_FILE}")
