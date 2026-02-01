import os
import glob
import re
import pandas as pd

# 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DATA_DIR = os.path.join(BASE_DIR, "raw_data")
OUTPUT_FILE = os.path.join(BASE_DIR, "youtube_filtered_data.tsv")

# 키워드 리스트 (게임 채팅 특화)
NEGATIVE_KEYWORDS = [
    "아니", "왜", "뭐하", "진짜", "미치", "돌겠", "사람", "이게", "하..", "하아", 
    "좀", "제발", "답답", "노답", "수준", "차이", "던지", "트롤", "서렌", "15", 
    "오픈", "정글", "미드", "원딜", "탑", "서폿", "안해", "하기싫", "역겹", 
    "토나", "쓰레기", "벌레", "개못", "못하", "이걸", "죽여", "죽고", "망했", 
    "터졌", "끝났", "GG", "지지", "나가", "닥쳐", "시끄", "잼민", "급식", 
    "정치", "탓", "남탓", "그만", "역전", "말좀", "듣질", "개", "씹", "좆", 
    "병신", "ㅅㅂ", "ㅂㅅ", "ㅈㄹ", "ㅁㅊ", "이런", "저런", "저게", "맞냐"
]

CLEAN_KEYWORDS = [
    "나이스", "좋아", "잘했", "굿", "감사", "고맙", "죄송", "미안", "사과", 
    "괜찮", "할수", "파이팅", "화이팅", "수고", "고생", "인정", "대박", "와우", 
    "멋지", "훌륭", "캐리", "버스", "사랑", "축하", "환영", "반가", "오케이", 
    "ㅇㅋ", "ㄱㄱ", "고고", "침착", "천천히", "같이", "함께", "도와", "살려"
]

def clean_text(text):
    # 1. 특수문자 제거 (Web Speech API 포맷) -> 단, 의미 파악을 위해 로깅엔 원본이 좋을수도 있지만, 최종셋을 위해 제거
    # 여기선 '분류'를 위해 놔두고, 저장할 때 제거하는 전략 사용? 
    # 아니오, 일단 Web Speech API 시뮬레이션을 위해 특수문자는 제거하고 판단합니다.
    text = re.sub(r'[^\w\s]', '', text)
    return text.strip()

def get_label(text):
    # 비꼬기/부정 키워드 확인
    for kw in NEGATIVE_KEYWORDS:
        if kw in text:
            return "negative_morale"  # 일단 후보군 (나중에 수동 검수)
            
    # Clean 키워드 확인
    for kw in CLEAN_KEYWORDS:
        if kw in text:
            return "clean" # 대조군 후보
            
    return None # 특징 없는 문장은 탈락

def main():
    print("🔍 고품질 데이터 필터링 시작...")
    
    # 파일 찾기
    files = glob.glob(os.path.join(RAW_DATA_DIR, "*.txt"))
    if not files:
        print("❌ .txt 파일을 찾을 수 없습니다.")
        return

    all_data = []
    
    for file_path in files:
        filename = os.path.basename(file_path)
        # 메타데이터 라인 건너뛰기 로직 필요 (1-3줄)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"⚠️ 파일 읽기 실패 ({filename}): {e}")
            continue
            
        for line in lines:
            line = line.strip()
            # 메타데이터 건너뛰기
            if line.startswith("[Settings]") or line.startswith("[Stats]") or line.startswith("---"):
                continue
            if not line:
                continue
                
            # 1. 길이 컷
            if len(clean_text(line)) < 3: # 2글자 이하 삭제 (게임챗은 짧은게 많지만, 고품질을 위해)
                continue
                
            # 2. 텍스트 정제
            cleaned = clean_text(line)
            
            # 3. 라벨링 및 필터링
            label = get_label(cleaned)
            
            if label:
                # 4. 저장 (파일명 포함하여 추적 용이하게)
                all_data.append({
                    "문장": cleaned,
                    "라벨": label,
                    "파일명": filename,
                    "원본": line
                })

    # DataFrame 변환
    df = pd.DataFrame(all_data)
    
    if df.empty:
        print("❌ 필터링 된 데이터가 없습니다. 기준을 완화하세요.")
        return
        
    # 통계
    print(f"\n📊 필터링 결과:")
    print(f"   전체 문장 수: {len(df)}")
    print(df['라벨'].value_counts())
    
    # 중복 제거
    df = df.drop_duplicates(subset=['문장'])
    print(f"   중복 제거 후: {len(df)}")
    
    # 저장
    df.to_csv(OUTPUT_FILE, sep='\t', index=False)
    print(f"\n💾 저장 완료: {OUTPUT_FILE}")
    print("\n[샘플 데이터]")
    print(df[['문장', '라벨']].head(10))

if __name__ == "__main__":
    main()
