import os
import csv
import random
import re

# ==========================================
# 설정
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_FILE = os.path.join(BASE_DIR, "processed_data", "07_final", "final_train.tsv")
OUTPUT_FILE = os.path.join(BASE_DIR, "processed_data", "04_candidates", "test_set_candidates_1000.tsv")


TARGET_COUNT = 1500  # 추출 목표 개수



# -------------------------------------------------------------------------
# 키워드 정의 (5-Class 분류를 위한 힌트용)
# -------------------------------------------------------------------------

# 1. 욕설 (Abuse)
KEYWORDS_ABUSE = [
    "시발", "씨발", "병신", "개새", "미친", "존나", "졸라", 
    "새끼", "련", "년", "놈", "닥쳐", "아가리", "뒤져",
    "시팔"
]

# 2. 남 탓 / 비난 (Blame) - 타인을 향한 공격적 언어
KEYWORDS_BLAME = [
    "너 때문", "니 탓", "뭐하냐", "뭐하심", "왜 저래", "왜 그래", 
    "트롤", "생각 좀", "뇌가", "도대체", "뭐함", "누가", 
    "니가", "양심", "일부러", "사람이냐", "안하냐", "제대로"
]

# 3. 좌절 / 짜증 / 자책 (Frustration) - 상황이나 자신에 대한 부정
KEYWORDS_FRUSTRATION = [
    "아 진짜", "하...", "미치겠", "답답", "환장", "혈압", 
    "안해", "못해먹겠", "망했", "가망", "어휴", "한숨", 
    "짜증", "화나", "열받", "힘들", "포기", "아니 근데", 
    "아오", "에바", "노답", "어떡하", "제발", "나 왜"
]

# 4. 칭찬 (Praise) - 긍정적 데이터
KEYWORDS_PRAISE = [
    "나이스", "잘했어", "굳", "굿", "대박", "지렸", "캐리", 
    "천재", "완벽", "좋아", "훌륭", "인정", "사랑"
]

# 5. 게임 진행 (Clean)
KEYWORDS_GAME_STATUS = [
    "오른쪽", "왼쪽", "점프", "기다려", "가자", "조심", "확인",
    "깼다", "성공", "오케이", "먹어", "살려", "피해", "밀어", 
    "당겨", "준비", "브리핑", "위로", "아래", "버튼"
]

def get_length_category(text):
    length = len(text)
    if 5 <= length <= 15: return "short"
    if 16 <= length <= 60: return "medium"
    if length > 60: return "long"
    return "ignore"

def main():
    print(f"Loading from {INPUT_FILE}...")
    
    unique_lines = []
    
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
            unique_lines = list(set([line.strip().split('\t')[0] for line in lines[1:] if line.strip()]))
    except Exception as e:
        print(f"Error: {e}")
        return
        
    print(f"Total pool: {len(unique_lines)}")
    
    # Pool 분류
    pool_abuse = []
    pool_blame = []
    pool_frust = []
    pool_praise = []
    pool_clean = []
    pool_general = []
    
    for text in unique_lines:
        length_cat = get_length_category(text)
        if length_cat == "ignore": continue
        
        # Priority 순서대로 검사
        if any(k in text for k in KEYWORDS_ABUSE):
            pool_abuse.append(text)
            continue
            
        if any(k in text for k in KEYWORDS_BLAME):
            pool_blame.append(text)
            continue
            
        if any(k in text for k in KEYWORDS_FRUSTRATION):
            pool_frust.append(text)
            continue
            
        if any(k in text for k in KEYWORDS_PRAISE):
            pool_praise.append(text)
            continue
            
        if any(k in text for k in KEYWORDS_GAME_STATUS):
            pool_clean.append(text)
            continue
            
        pool_general.append(text)
        
    print(f" - Abuse: {len(pool_abuse)}")
    print(f" - Blame: {len(pool_blame)}")
    print(f" - Frustration: {len(pool_frust)}")
    print(f" - Praise: {len(pool_praise)}")
    print(f" - Clean/Game: {len(pool_clean)}")
    print(f" - General: {len(pool_general)}")
    
    final_list = []
    
    # 샘플링 전략 (총 1500개)
    # 부정적인 데이터를 우선 확보하여 라벨링 다양성 확보
    
    s_abuse = random.sample(pool_abuse, min(len(pool_abuse), 300))
    s_blame = random.sample(pool_blame, min(len(pool_blame), 400))
    s_frust = random.sample(pool_frust, min(len(pool_frust), 400))
    s_praise = random.sample(pool_praise, min(len(pool_praise), 200))
    
    final_list.extend([(t, "Abuse") for t in s_abuse])
    final_list.extend([(t, "Blame") for t in s_blame])
    final_list.extend([(t, "Frustration") for t in s_frust])
    final_list.extend([(t, "Praise") for t in s_praise])
    
    # 남은 자리는 Clean과 General로 채움
    remaining = TARGET_COUNT - len(final_list)
    if remaining > 0:
        q_clean = remaining // 2
        q_gen = remaining - q_clean
        
        s_clean = random.sample(pool_clean, min(len(pool_clean), q_clean))
        s_gen = random.sample(pool_general, min(len(pool_general), q_gen))
        
        final_list.extend([(t, "Clean") for t in s_clean])
        final_list.extend([(t, "General") for t in s_gen])
    
    random.shuffle(final_list)
    
    OUTPUT_FINAL = os.path.join(BASE_DIR, "processed_data", "04_candidates", "final_candidates_1500_v3.tsv")
    
    with open(OUTPUT_FINAL, 'w', encoding='utf-8-sig') as f:
        f.write("sentence\tlabel\tcategory_hint\n")
        
        for text, hint in final_list:
             f.write(f"{text}\t\t{hint}\n")
            
    print(f"Selected Total: {len(final_list)}")
    print(f"Saved candidate list to {OUTPUT_FINAL}")
    print("Hints provided: Abuse, Blame, Frustration, Praise, Clean, General")

if __name__ == "__main__":
    main()
