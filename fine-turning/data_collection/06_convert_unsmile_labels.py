```python
import csv
import os

# 파일 경로 설정 (절대 경로 복구)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "processed_data", "00_Unsmile", "unsmile_train_clean_hybrid_11k.tsv")
OUTPUT_FILE = os.path.join(BASE_DIR, "processed_data", "00_Unsmile", "unsmile_converted_8label.tsv")

# -------------------------------------------------------------------------
# 키워드 정의 (자동 마킹용)
# -------------------------------------------------------------------------
KEYWORDS_BLAME = [
    "너 때문", "니 탓", "뭐하냐", "뭐하심", "왜 저래", "왜 그래", 
    "트롤", "생각 좀", "뇌가", "도대체", "뭐함", "누가", 
    "니가", "양심", "일부러", "사람이냐", "안하냐", "제대로",
    "죽겠", "던지", "구멍"
]

KEYWORDS_FRUSTRATION = [
    "하...", "미치겠", "답답", "환장", "혈압", 
    "안해", "못해먹겠", "망했", "가망", "어휴",
    "힘들", "포기", "아니 근데", "아오", "에바", "노답", "어떡하",
    "나 왜"
]

KEYWORDS_ANGER = [
    "화나", "열받", "짜증", "빡치", "개같", "역겹",
    "아 진짜", "진짜 아", "화난", "화나네", "화나죽겠네", "화나죽겠어", "화나죽겠네",
    "열받네", "열받아", "열받아죽겠네", "열받아죽겠어", "열받아죽겠네",
    "짜증나네", "짜증나", "짜증나죽겠네", "짜증나죽겠어", "짜증나죽겠네",
    "빡치네", "빡쳐", "빡쳐죽겠네", "빡쳐죽겠어", "빡쳐죽겠네",
    "개같네", "개같아",

]

KEYWORDS_PRAISE = [
    "나이스", "잘했어", "굳", "굿", "대박", "지렸", "캐리", 
    "천재", "완벽", "좋아", "훌륭", "인정", "사랑", "최고"
]

def convert_unsmile():
    print(f"Loading {INPUT_FILE}...")
    
    rows_to_save = []
    
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='\t')
            fieldnames = reader.fieldnames
            print("Original Columns:", fieldnames)
            
            other_hate_cols = ['여성/가족', '남성', '성소수자', '인종/국적', '연령', '지역', '종교', '기타 혐오']
            
            # 통계용
            stats = {
                'abuse': 0, 'hate': 0, 'clean': 0,
                'blame': 0, 'frust': 0, 'anger': 0, 'praise': 0
            }
            
            for row in reader:
                sentence = row.get('문장', '')
                if not sentence: continue
                
                # 1. 기존 라벨 확인
                val_abuse = row.get('악플/욕설', '0')
                is_abuse = 1 if (val_abuse == '1' or val_abuse == 1) else 0
                
                val_clean = row.get('clean', '0')
                is_clean = 1 if (val_clean == '1' or val_clean == 1) else 0
                
                is_other_hate = 0
                for col in other_hate_cols:
                    val = row.get(col, '0')
                    if val == '1' or val == 1:
                        is_other_hate = 1
                        break
                        
                # 2. 키워드 기반 자동 마킹
                is_blame = 1 if any(k in sentence for k in KEYWORDS_BLAME) else 0
                is_frust = 1 if any(k in sentence for k in KEYWORDS_FRUSTRATION) else 0
                is_anger = 1 if any(k in sentence for k in KEYWORDS_ANGER) else 0
                is_praise = 1 if any(k in sentence for k in KEYWORDS_PRAISE) else 0
                
                # 3. 논리적 충돌 해결 (Override)
                # 부정적인 라벨이 하나라도 있으면 Clean은 0이어야 함
                if is_abuse or is_other_hate or is_blame or is_frust or is_anger:
                    is_clean = 0
                    
                # 칭찬이 있으면 Clean(중립)은 0으로? -> 칭찬은 긍정이므로 중립 아님.
                if is_praise:
                    is_clean = 0
                
                # 통계 업데이트
                if is_abuse: stats['abuse'] += 1
                if is_other_hate: stats['hate'] += 1
                if is_clean: stats['clean'] += 1
                if is_blame: stats['blame'] += 1
                if is_frust: stats['frust'] += 1
                if is_anger: stats['anger'] += 1
                if is_praise: stats['praise'] += 1
                
                rows_to_save.append({
                    'sentence': sentence,
                    '악플/욕설': is_abuse,
                    '기타_혐오': is_other_hate,
                    'clean': is_clean,
                    '남탓': is_blame,
                    '감정표출': is_anger,
                    '좌절': is_frust,
                    '칭찬': is_praise,
                    '게임오더': 0  # New (Unsmile 데이터는 오더 없음)
                })
                
    except Exception as e:
        print(f"Error processing file: {e}")
        return

    print("\n--- Converted Statistics (8-Label System) ---")
    print(f"악플/욕설: {stats['abuse']}")
    print(f"기타_혐오: {stats['hate']}")
    print(f"clean: {stats['clean']}")
    print(f"남탓 (Auto): {stats['blame']}")
    print(f"감정표출 (Auto): {stats['anger']}")
    print(f"좌절 (Auto): {stats['frust']}")
    print(f"칭찬 (Auto): {stats['praise']}")
    print(f"게임오더: 0")
    print(f"Total Rows: {len(rows_to_save)}")
    
    # 저장
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
            headers = ['sentence', '악플/욕설', '기타_혐오', 'clean', '남탓', '감정표출', '좌절', '칭찬', '게임오더']
            writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
            writer.writeheader()
            writer.writerows(rows_to_save)
        print(f"\nSaved converted data to {OUTPUT_FILE}")
        print("Format: sentence | 악플/욕설 | 기타_혐오 | clean | 남탓 | 감정표출 | 좌절 | 칭찬 | 게임오더")
    except Exception as e:
         print(f"Error saving file: {e}")

if __name__ == "__main__":
    convert_unsmile()
