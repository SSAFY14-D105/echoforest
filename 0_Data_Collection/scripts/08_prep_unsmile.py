"""
08_prep_unsmile.py
==================
UnSmile 데이터셋 10라벨 → 3라벨 축소

[목적]
- 기존 UnSmile (10개 라벨) → 3개 라벨로 축소
  - 악플/욕설 → abuse
  - 성별/지역/인종/종교/기타 혐오 → hate
  - clean → clean
- 이후 09_relabel_unsmile.py에서 8라벨로 재분류

[입력] ../UnSmile/UnSmile_Clean/unsmile_train_clean_hybrid_11k.tsv
[출력] processed_data/05_external/unsmile_3label.tsv
"""
import csv
import os
import shutil
from datetime import datetime

# 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_FILE = os.path.join(BASE_DIR, "..", "UnSmile", "UnSmile_Clean", "unsmile_train_clean_hybrid_11k.tsv")
OUTPUT_FILE = os.path.join(BASE_DIR, "processed_data", "05_external", "unsmile_3label.tsv")
ARCHIVE_DIR = os.path.join(BASE_DIR, "processed_data", "archive", "05_external_history")

def convert_unsmile():
    """UnSmile 10라벨 → 3라벨 축소"""
    print(f"Loading {INPUT_FILE}...")
    
    rows_to_save = []
    
    # 10라벨 중 '기타 혐오'로 통합할 컬럼들
    hate_cols = ['여성/가족', '남성', '성소수자', '인종/국적', '연령', '지역', '종교', '기타 혐오']
    
    # 통계용
    stats = {'abuse': 0, 'hate': 0, 'clean': 0, 'total': 0}
    
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='\t')
            fieldnames = reader.fieldnames
            print(f"Original Columns: {fieldnames}")
            
            for row in reader:
                sentence = row.get('문장', '')
                if not sentence: 
                    continue
                
                # 1. 악플/욕설 확인
                val_abuse = row.get('악플/욕설', '0')
                is_abuse = 1 if (val_abuse == '1' or val_abuse == 1) else 0
                
                # 2. 기타 혐오 확인 (8개 컬럼 중 하나라도 1이면)
                is_hate = 0
                for col in hate_cols:
                    val = row.get(col, '0')
                    if val == '1' or val == 1:
                        is_hate = 1
                        break
                
                # 3. clean 확인
                val_clean = row.get('clean', '0')
                is_clean = 1 if (val_clean == '1' or val_clean == 1) else 0
                
                # 4. 논리적 충돌 해결: 부정 라벨이 있으면 clean = 0
                if is_abuse or is_hate:
                    is_clean = 0
                
                # 통계 업데이트
                if is_abuse: stats['abuse'] += 1
                if is_hate: stats['hate'] += 1
                if is_clean: stats['clean'] += 1
                stats['total'] += 1
                
                rows_to_save.append({
                    'sentence': sentence,
                    '욕설/악플': is_abuse,
                    '기타혐오': is_hate,
                    'clean': is_clean,
                })
                
    except Exception as e:
        print(f"Error processing file: {e}")
        return

    # 통계 출력
    print("\n" + "=" * 50)
    print("Phase 1: UnSmile 10라벨 → 3라벨 축소 완료")
    print("=" * 50)
    print(f"욕설/악플: {stats['abuse']:,} ({stats['abuse']/stats['total']*100:.1f}%)")
    print(f"기타혐오:  {stats['hate']:,} ({stats['hate']/stats['total']*100:.1f}%)")
    print(f"clean:     {stats['clean']:,} ({stats['clean']/stats['total']*100:.1f}%)")
    print(f"Total:     {stats['total']:,}")
    
    # 출력 폴더 생성
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    # 저장
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
            headers = ['sentence', '욕설/악플', '기타혐오', 'clean']
            writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
            writer.writeheader()
            writer.writerows(rows_to_save)
        print(f"\n✅ Saved to: {OUTPUT_FILE}")
        
        # 아카이브 저장
        if not os.path.exists(ARCHIVE_DIR):
            os.makedirs(ARCHIVE_DIR)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_file = os.path.join(ARCHIVE_DIR, f"unsmile_3label_{timestamp}.tsv")
        shutil.copy(OUTPUT_FILE, archive_file)
        print(f"📦 Archived to: {archive_file}")
        
    except Exception as e:
        print(f"Error saving file: {e}")

if __name__ == "__main__":
    convert_unsmile()
