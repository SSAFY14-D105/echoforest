import os
import glob
import re
import unicodedata
import shutil
from datetime import datetime
from kiwipiepy import Kiwi

# ==========================================
# 설정
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "processed_data", "02_merged_cleaned", "merged_stt_cleaned.tsv")
OUTPUT_FILE = os.path.join(BASE_DIR, "processed_data", "03_anonymized", "final_dataset.tsv")
ARCHIVE_DIR = os.path.join(BASE_DIR, "processed_data", "archive", "03_anonymized_history")

def clean_basic(text):
    """기본 전처리: 숫자, 기호, 자음 제거"""
    if not text: return ""
    text = str(text)
    
    # 0. 유니코드 정규화 (NFC) - 자소 분리 방지
    text = unicodedata.normalize('NFC', text)
    
    # 1. 숫자 제거 (사용자 요청으로 취소)
    # text = re.sub(r'\d+', '', text)
    
    # 2. 기호 제거
    text = re.sub(r'[!?,.\~"\';:\[\]\(\)\{\}\<\>\-\_\=\+\*\/]', '', text)
    
    # 3. 자음/모음만 있는 것 제거
    text = re.sub(r'[ㄱ-ㅎㅏ-ㅣ]+', '', text)
    
    # 4. 공백 정리
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def anonymize_with_kiwi(kiwi, text):
    """
    Kiwi를 사용하여 고유명사(NNP)를 [유저]로 치환
    """
    try:
        # 형태소 분석
        tokens = kiwi.tokenize(text)
        modified_tokens = []
        
        for token in tokens:
            # NNP(고유명사): 사람 이름, 지명, 닉네임 등
            # 익명화 대상:
            # 1. NNP (고유명사)
            # 2. 특정 닉네임이 일반 명사(NNG)로 잡혔을 경우를 대비해 텍스트 직접 비교
            
            is_target = False
            
            # 2글자 이상인 고유명사
            if token.tag == 'NNP' and len(token.form) >= 2:
                is_target = True
                
            # 우리가 등록한 단어 (후추 등)
            elif token.form in ['후추']:
                is_target = True
                
            if is_target:
                modified_tokens.append(('[유저]', 'NNP'))
            else:
                modified_tokens.append(token)
                
        # 토큰 다시 합칠 때 문법 규칙에 맞게 결합
        return kiwi.join(modified_tokens)
        
    except Exception as e:
        # 에러 나면 원본 반환
        return text

def main():
    print("Loading Kiwi Model... (This may take a moment)")
    try:
        kiwi = Kiwi()
        
    # 1. 사용자 사전 추가 (유튜버 닉네임 등) - NNP(고유명사)로 강제 등록
        # 중의적인 단어들도 일단 NNP로 등록해두고, 뒤에 조사를 보고 판단
        custom_users = ['후추', '악어', '남봉', '멋사', '핑맨', '리타', '만득', '너불', '수닝', '중력', '옥냥이', '천수', '아우니', '영태', '영태형'] 
        for word in custom_users:
            kiwi.add_user_word(word, tag='NNP', score=10)

    except Exception as e:
        print(f"Error loading Kiwi: {e}")
        print("Please install kiwipiepy: pip install kiwipiepy")
        return

    # ==========================================
    # 스마트 익명화 설정
    # ==========================================
    # 중의적인 닉네임 목록 (사람 이름일 수도, 일반 명사일 수도 있음)
    AMBIGUOUS_NAMES = {'중력', '후추', '악어'} 

    # 사람임을 암시하는 뒷 단어들 (엄격한 기준: 호칭/호격 조사만 허용)
    # 이/가/을/를 등 일반 조사는 '중력이 강하다' 같은 경우를 구분하기 어려우므로 제외
    STRICT_INDICATORS = {'아', '야', '님', '형', '오빠', '누나', '언니', '씨'}

    print(f"Loading input file: {INPUT_FILE}...")
    
    all_sentences = []
    
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
            
        print(f"Total lines to process: {len(lines)}")
        
        for idx, line in enumerate(lines):
            # 헤더 건너뛰기
            if idx == 0 and ("sentence" in line or "label" in line):
                continue
                
            parts = line.strip().split('\t')
            raw_text = parts[0] if parts else ""
            
            if not raw_text: continue
            
            # 1. 기본 정제
            cleaned = clean_basic(raw_text)
            if len(cleaned) < 2: continue
            
            # 2. 익명화 (스마트 로직)
            try:
                tokens = kiwi.tokenize(cleaned)
                modified_tokens = []
                
                i = 0
                while i < len(tokens):
                    token = tokens[i]
                    next_token = tokens[i+1] if i+1 < len(tokens) else None
                    
                    is_target = False
                    
                    # (1) 중의적인 이름 처리 (우선순위 높음)
                    # NNP 여부와 상관없이 형태(form)가 일치하면 검사 (사용자 사전에 등록했으므로 NNP일 것임)
                    if token.form in AMBIGUOUS_NAMES:
                        # 뒤에 확실한 호칭이 있어야만 사람으로 간주
                        if next_token and next_token.form in STRICT_INDICATORS:
                            is_target = True
                        else:
                            is_target = False # 그냥 일반 명사(물리적 중력, 향신료 후추 등)로 간주

                    # (2) 확실한 닉네임 (사용자 사전 등록됨, 중의적이지 않음)
                    elif token.form in custom_users:
                        is_target = True

                    # (3) 그 외 2글자 이상 고유명사 (NNP)
                    # Kiwi가 자동으로 닉네임이나 이름으로 인식한 경우
                    elif token.tag == 'NNP' and len(token.form) >= 2:
                        is_target = True
                    
                    # 치환 적용

                    # 치환 적용
                    if is_target:
                        modified_tokens.append(('[유저]', 'NNP'))
                    else:
                        modified_tokens.append(token)
                    
                    i += 1
                
                anonymized = kiwi.join(modified_tokens)
                all_sentences.append(anonymized)

            except Exception as e:
                # 에러 시 원본 사용 (단, 기본 정제는 된 상태)
                all_sentences.append(cleaned)
            
            if idx % 1000 == 0:
                print(f"Processing... {idx}/{len(lines)}")
                
    except Exception as e:
        print(f"Error reading input file: {e}")
        return

    # 중복 제거
    unique_sentences = sorted(list(set(all_sentences)))
    print(f"Total Unique Sentences after anonymization: {len(unique_sentences)}")
    
    # 저장
    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig') as f:
        f.write("sentence\tlabel\n")
        for sent in unique_sentences:
            f.write(f"{sent}\t\n")
            
    # 아카이브 저장
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_file = os.path.join(ARCHIVE_DIR, f"final_dataset_{timestamp}.tsv")
    shutil.copy(OUTPUT_FILE, archive_file)

    print("Done!")
    print(f"Archived to: {archive_file}")

if __name__ == "__main__":
    main()
