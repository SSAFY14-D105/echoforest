import os
import random
import pandas as pd
from collections import Counter
try:
    from kiwipiepy import Kiwi
except ImportError:
    Kiwi = None

# ==========================================
# 설정
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_FILE = os.path.join(BASE_DIR, "processed_data", "07_final", "final_train.tsv")
OUTPUT_DIR = os.path.join(BASE_DIR, "processed_data", "05_analysis")
SAMPLE_FILE = os.path.join(OUTPUT_DIR, "final_samples.txt")
KEYWORD_FILE = os.path.join(OUTPUT_DIR, "final_keywords.txt")

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)

def main():
    ensure_dir(OUTPUT_DIR)
    
    print(f"Loading dataset from {INPUT_FILE}...")
    try:
        df = pd.read_csv(INPUT_FILE, sep='\t')
        sentences = df['sentence'].dropna().tolist()
        print(f"Total sentences: {len(sentences)}")
    except Exception as e:
        print(f"Error loading file: {e}")
        return

    # ---------------------------------------------------------
    # 0. 라벨 분포 분석 (New)
    # ---------------------------------------------------------
    print("\n" + "="*40)
    print(" [0] Label Distribution Analysis")
    print("="*40)
    
    label_cols = ['악플/욕설', '기타_혐오', 'clean', '남탓', '감정표출', '좌절', '칭찬', '게임오더']
    
    # 전체 분포
    print("\n1. Overall Distribution:")
    stats = df[label_cols].sum().sort_values(ascending=False)
    for label, count in stats.items():
        ratio = count / len(df) * 100
        print(f" - {label}: {count} ({ratio:.1f}%)")
        
    # 소스별 분포
    if 'source' in df.columns:
        print("\n2. Distribution by Source:")
        source_stats = df.groupby('source')[label_cols].sum()
        print(source_stats)
        
        # 소스별 Clean 비율
        print("\n3. Clean Ratio by Source:")
        for source, group in df.groupby('source'):
            clean_count = group['clean'].sum()
            total = len(group)
            print(f" - {source}: {clean_count}/{total} ({clean_count/total*100:.1f}%)")

    # ---------------------------------------------------------
    # 1. 랜덤 샘플링
    # ---------------------------------------------------------
    print("\n" + "="*40)
    print(" [1] Random Sampling (Checking Data Quality)")
    print("="*40)
    
    with open(SAMPLE_FILE, 'w', encoding='utf-8') as f:
        f.write("Random Samples from Final Training Data\n")
        f.write("=======================================\n")
        
        # 전체에서 50개 뽑기
        samples = df.sample(n=min(50, len(df)))
        for idx, row in samples.iterrows():
            # 활성화된 라벨 찾기
            active_labels = [col for col in label_cols if row.get(col) == 1]
            label_str = ", ".join(active_labels) if active_labels else "None"
            
            f.write(f"[{row.get('source', 'unknown')}] {row['sentence']}  ->  ({label_str})\n")
            
    print(f"Saved 50 random samples to {SAMPLE_FILE}")

    # ---------------------------------------------------------
    # 2. 키워드 분석
    # ---------------------------------------------------------
    if Kiwi:
        print("\n" + "="*40)
        print(" [2] Analyzing Keywords (Noun/Verb/Adj)")
        print("="*40)
        
        kiwi = Kiwi()
        target_tags = {'NNG', 'NNP', 'VV', 'VA', 'IC', 'MAG'} 
        word_counts = Counter()
        
        for sent in sentences:
            try:
                tokens = kiwi.tokenize(str(sent))
                for token in tokens:
                    if token.tag in target_tags:
                        word = token.form
                        if token.tag in {'VV', 'VA'}: word += '다'
                        word_counts[word] += 1
            except: pass
            
        # 저장
        with open(KEYWORD_FILE, 'w', encoding='utf-8') as f:
            for word, count in word_counts.most_common(200):
                f.write(f"{word}\t{count}\n")
        print(f"Saved keyword stats to {KEYWORD_FILE}")
        
    else:
        print("\n[Skip] Kiwi not installed. Skipping keyword analysis.")

if __name__ == "__main__":
    main()
