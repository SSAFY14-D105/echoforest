import pandas as pd
import re
import os

# 설정
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../unsmile/train"))
INPUT_FILE = os.path.join(DATA_DIR, "unsmile_train_v1.0.tsv")
OUTPUT_FILE = os.path.join(DATA_DIR, "unsmile_train_clean_hybrid.tsv") # 하이브리드 모드

def clean_text_hybrid(text):
    if not isinstance(text, str):
        return None
    
    # Rule 1. 자음/모음 단독 표기 (ㅋㅋ, ㅎㅎ, ㅠㅠ) 포함 시 -> 문장 전체 삭제
    # (감정적 뉘앙스가 강해 단순 제거 시 의미 왜곡 우려)
    if re.search(r'[ㄱ-ㅎㅏ-ㅣ]', text):
        return None 
        
    # Rule 2. 특수문자/문장부호 (?!.,) -> 단순 제거하고 문장은 살림
    # (Web Speech API 포맷 맞추기 용도. 의미 변화 적음)
    # 정규식: 알파벳, 숫자, 한글, 공백만 남기고 다 제거
    cleaned_text = re.sub(r'[^\w\s]', '', text)
    
    # 다중 공백 정리
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    
    if len(cleaned_text) < 2: # 너무 짧아지면 삭제 (예: "." -> "")
        return None
        
    return cleaned_text

def main():
    print(f"🔄 Unsmile 데이터 전처리 (하이브리드 모드): {INPUT_FILE}")
    print("   1. 자음/모음(ㅋㅋ,ㅠㅠ) 포함 문장 -> 🗑️ 삭제")
    print("   2. 특수문자(!,?) 포함 문장 -> ✂️ 기호만 제거하고 생존")
    
    # 파일 로드 (경로 에러 방지)
    try:
        df = pd.read_csv(INPUT_FILE, sep='\t')
    except:
        try:
             INPUT_FILE_ALT = "../../unsmile/train/unsmile_train_v1.0.tsv"
             df = pd.read_csv(INPUT_FILE_ALT, sep='\t')
             print(f"   (경로 우회 로드 성공: {INPUT_FILE_ALT})")
        except Exception as e:
            print(f"❌ 데이터 로드 실패: {e}")
            return

    original_count = len(df)
    
    # 전처리 적용
    print("🧹 데이터 정제 중...")
    
    # apply 적용 후 None이 아닌 것만 필터링
    df['cleaned_text'] = df['문장'].apply(clean_text_hybrid)
    
    # 살아남은 문장들만 선택
    df_clean = df.dropna(subset=['cleaned_text']).copy()
    
    # 문장 컬럼 교체
    df_clean['문장'] = df_clean['cleaned_text']
    df_clean = df_clean.drop(columns=['cleaned_text'])
    
    cleaned_count = len(df_clean)
    dropped_count = original_count - cleaned_count
    
    print(f"\n✅ 정제 완료: {original_count}개 -> {cleaned_count}개")
    print(f"🗑️ 삭제된 문장: {dropped_count}개 (삭제율: {dropped_count/original_count*100:.1f}%)")
    
    # 저장
    df_clean.to_csv(OUTPUT_FILE, sep='\t', index=False)
    print(f"💾 저장 완료: {OUTPUT_FILE}")
    
    # 샘플 출력
    if cleaned_count > 0:
        print("\n[살아남은 문장 샘플 (특수문자 제거됨)]")
        print(df_clean[['문장']].head(10))

if __name__ == "__main__":
    main()
