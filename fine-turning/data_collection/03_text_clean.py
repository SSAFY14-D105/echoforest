"""
03_text_clean.py
================
기본 텍스트 정제 및 병합

[목적]
- 여러 STT 결과 파일을 하나로 병합
- 숫자/기호/자모음 제거
- 마스킹된 욕설 복구 (X → 실제 단어)
- 중복 문장 제거

[입력] raw_data/01_faster_whisper/*.tsv
[출력] processed_data/03_cleaned/merged_stt_cleaned.tsv
"""

import os
import glob
import re
import shutil
from datetime import datetime

# ==========================================
# 설정
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(BASE_DIR, "raw_data", "01_faster_whisper")
OUTPUT_FILE = os.path.join(BASE_DIR, "processed_data", "03_cleaned", "merged_stt_cleaned.tsv")
ARCHIVE_DIR = os.path.join(BASE_DIR, "processed_data", "archive", "03_cleaned_history")

def clean_text(text):
    """
    사용자 요청 전처리 규칙 적용:
    1. 숫자 제거
    2. 기호(! ?, . 등) 제거
    3. 자음/모음(ㅋㅋ) 제거
    4. 앞뒤 공백 제거
    """
    if not text: return ""
    text = str(text)
    
    # 0. Whisper 환각/반복 패턴 제거 (X2, X3 등)
    text = re.sub(r'[Xx]\d+', '', text)
    
    # 0-1. 마스킹된 욕설 복구 (X -> 실제 욕설)
    # 학습 효율을 위해 적나라한 표현으로 통일 (확실한 패턴만)
    text = re.sub(r'[Xx]\s*될\s*뻔', '좆 될 뻔', text) # X 될 뻔 -> 좆 될 뻔
    text = re.sub(r'씨[Xx]', '씨발', text)          # 씨X -> 씨발
    text = re.sub(r'[Xx]발', '시발', text)
    text = re.sub(r'[Xx]끼', '새끼', text)
    text = re.sub(r'개[Xx]+', '개새끼', text) 
    text = re.sub(r'[Xx]신', '병신', text)
    text = re.sub(r'[Xx]나', '존나', text)

    # 0-1.5 어미가 붙은 욕설 (시X아, 새X야 등) - 우선순위 높음
    # 사용자 요청 패턴 추가 (구체적 문맥)
    text = re.sub(r'이\s*새[Xx]는', '이 새끼는', text)
    text = re.sub(r'새[Xx]가', '새끼가', text)
    text = re.sub(r'[Xx]{2}들이랑', '새끼들이랑', text)
    text = re.sub(r'[Xx]{2}들아', '새끼들아', text)
    text = re.sub(r'시[Xx]{2}들', '시발련들', text)
    text = re.sub(r'시[Xx]{2}(?=[\s.,!?~]|$)', '시발련', text) # 단독 시XX -> 시발련
    
    # 앞뒤 공백 존X -> 존나 (Lookbehind 에러 수정: 두 단계로 분리)
    text = re.sub(r'^존[Xx](?=[\s.,!?~]|$)', '존나', text)  # 문장 맨 앞
    text = re.sub(r'([\s])존[Xx](?=[\s.,!?~]|$)', r'\1존나', text) # 앞에 공백 있음
    
    # X됐... / X같... 시리즈 (앞뒤 공백/경계 조건)
    # 예: "아 X됐다" -> "아 좆됐다", "기분 X같네" -> "기분 좆같네"
    text = re.sub(r'(^|[\s])[Xx]됐(?=[다어네])', r'\1좆됐', text) # X됐다, X됐어, X됐네
    text = re.sub(r'(^|[\s])[Xx]같(?=[네아은])', r'\1좆같', text) # X같네, X같아, X같은
    
    # 사용자 요청: 문맥("이")이 있어 확실한 경우
    text = re.sub(r'이\s*새[Xx]야', '이 새끼야', text)
    text = re.sub(r'이\s*새[Xx]아', '이 새끼아', text)
    
    text = re.sub(r'시[Xx]아', '시발아', text)
    text = re.sub(r'새[Xx]야', '새끼야', text)
    text = re.sub(r'새[Xx]아', '새끼아', text)

    # 0-2. 애매한 패턴 (시X, 새X) - 뒤에 글자가 안 붙을 때만 변환 (Lookahead)
    # 예: "아 시X" -> "아 시발" (O) / "시X하자" -> 변환 X
    text = re.sub(r'시[Xx](?=[\s.,!?~]|$)', '시발', text)
    text = re.sub(r'새[Xx](?=[\s.,!?~]|$)', '새끼', text)
    
    # 1. 숫자 제거 (사용자 요청으로 취소 - "1번님" 등의 표현 보존)
    # text = re.sub(r'\d+', '', text)
    
    # 1. 기호 및 특수문자 제거
    # STT 학습에 불필요한 문장부호 제거 (! ? . , 등)
    # [중요] 대괄호 [ ] 는 유저 태그용이므로 절대 삭제하지 않음!
    text = re.sub(r'[!?,.\~"\';:\(\)\{\}\<\>\-\_\=\+\*\/]', '', text)
    
    # 2. 자음/모음만 있는 것 제거 (ㄱ-ㅎ, ㅏ-ㅣ)
    text = re.sub(r'[ㄱ-ㅎㅏ-ㅣ]+', '', text)
    
    # 3. 외국어/노이즈 제거 (화이트리스트 방식)
    # 남길 문자: 한글(가-힣), 영어(a-zA-Z), 숫자(0-9), 공백(\s), 대괄호([])
    # 그 외(러시아어, 한자, 이모지 등)는 삭제
    text = re.sub(r'[^가-힣a-zA-Z0-9\s\[\]]', '', text)
    
    # 4. 다중 공백 하나로 줄이기
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def main():
    print(f"Loading TSV files from {INPUT_DIR}...")
    
    tsv_files = glob.glob(os.path.join(INPUT_DIR, "audio_*.tsv"))
    all_sentences = []
    
    processed_files = 0
    
    for fpath in tsv_files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            # 파일별 처리
            for line in lines:
                # TSV 형식일 수 있으므로 탭으로 분리 후 첫 번째 컬럼 사용
                # 혹은 그냥 텍스트 파일일 경우 전체 사용
                parts = line.strip().split('\t')
                raw_text = parts[0] if parts else ""
                
                # 헤더 라인("문장", "TSV" 등 포함) 건너뛰기
                if "문장" in raw_text or "clean" in raw_text:
                    continue
                
                cleaned = clean_text(raw_text)
                
                # 너무 짧은 문장(1글자 이하)은 의미 없으므로 제외 (선택 사항)
                if len(cleaned) < 2:
                    continue
                    
                all_sentences.append(cleaned)
            
            processed_files += 1
            
        except Exception as e:
            print(f"Error reading {os.path.basename(fpath)}: {e}")

    print(f"Total raw sentences processed: {len(all_sentences)}")
    
    # 5. 중복 제거
    unique_sentences = sorted(list(set(all_sentences)))
    
    print(f"Unique sentences after deduplication: {len(unique_sentences)}")
    
    # 저장 (TSV 포맷: sentence \t label)
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig') as f:
        # 헤더 작성
        f.write("sentence\tlabel\n")
        
        for sent in unique_sentences:
            # 라벨 자리는 비워둠 (나중에 채우기 위해)
            f.write(f"{sent}\t\n")
            
    # 6. 아카이브 저장 (History)
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_file = os.path.join(ARCHIVE_DIR, f"merged_cleaned_{timestamp}.tsv")
    shutil.copy(OUTPUT_FILE, archive_file)
    
    print("=" * 40)
    print(f"Processing Complete!")
    print(f" - Scanned Files: {processed_files}")
    print(f" - Result File: {OUTPUT_FILE}")
    print(f" - Archived to: {archive_file}")
    print("=" * 40)

if __name__ == "__main__":
    main()
