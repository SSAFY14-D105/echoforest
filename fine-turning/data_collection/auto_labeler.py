
import os
import glob
import pandas as pd
import torch
from transformers import TextClassificationPipeline, BertForSequenceClassification, AutoTokenizer

# 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(BASE_DIR, "raw_data")       # STT/수집된 텍스트 파일 위치
OUTPUT_FILE = os.path.join(BASE_DIR, "auto_labeled_result.csv") # 결과 저장 (엑셀용)

# UnSmile 공식 모델 (이미 학습된 모델)
MODEL_NAME = "smilegate-ai/kor_unsmile"

def load_model():
    print(f"Loading UnSmile model ({MODEL_NAME})...")
    device = 0 if torch.cuda.is_available() else -1
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = BertForSequenceClassification.from_pretrained(MODEL_NAME)
    
    # 파이프라인 생성 (텍스트 -> 라벨 예측을 쉽게 해줌)
    pipe = TextClassificationPipeline(
        model=model,
        tokenizer=tokenizer,
        device=device,
        return_all_scores=True # 모든 라벨의 점수 보기
    )
    return pipe

def run_auto_labeling():
    # 1. 입력 파일 찾기 (.txt)
    txt_files = glob.glob(os.path.join(INPUT_DIR, "*.txt"))
    if not txt_files:
        print(f"No .txt files found in {INPUT_DIR}")
        return

    # 2. 모델 로드
    pipe = load_model()
    
    results = []
    print(f"Found {len(txt_files)} files. Starting auto-labeling...")

    for file_path in txt_files:
        filename = os.path.basename(file_path)
        print(f"Processing: {filename}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()
            
        if not text: continue
        
        # 텍스트가 너무 길면 잘라서 처리해야 할 수도 있음 (여기선 앞부분 512토큰만 처리하거나 문장 단위 분리 필요)
        # 간단히 문장 단위(마침표/줄바꿈)로 쪼개서 라벨링
        sentences = [s.strip() for s in text.replace('.', '\n').split('\n') if s.strip()]
        
        for sent in sentences:
            # 예측 실행
            # pipe(sent) 결과 예시: [[{'label': '여성/가족', 'score': 0.01}, ...]]
            preds = pipe(sent)[0]
            
            # 라벨별 확률 대신 0 또는 1로 변환 (Threshold 0.6)
            # UnSmile 데이터셋과 동일한 컬럼명을 사용 ('문장', '여성/가족' 등)
            row = {'문장': sent}
            
            # 모든 스코어 확인
            max_score = 0
            predicted_lab = "clean"
            
            for p in preds:
                label_name = p['label']
                score = p['score']
                
                # clean 라벨은 제외하고 혐오 라벨만 체크
                if label_name == 'clean':
                    row['clean'] = 1 if score >= 0.6 else 0
                else:
                    # 혐오 라벨: 임계값 넘으면 1, 아니면 0
                    row[label_name] = 1 if score >= 0.6 else 0
                    if score > max_score and score >= 0.6:
                        max_score = score
                        predicted_lab = label_name

            # 만약 모든 혐오 라벨이 0이라면 clean을 1로 (안전을 위해)
            # 하지만 이미 clean 점수도 위에서 계산했으므로 그대로 둠
            
            # 사용자가 검수하기 편하게 예측 결과(텍스트)도 하나 추가
            row['[Auto_Check]'] = predicted_lab if max_score >= 0.6 else "clean"
            row['SourceFile'] = filename
                
            results.append(row)

    # 3. 결과 저장
    if results:
        df = pd.DataFrame(results)
        
        # 컬럼 순서 정리 (UnSmile 데이터셋과 최대한 비슷하게)
        # 문장, [Auto_Check], 여성/가족, 남성, ... , clean, 개인지칭, 연령, 지역, 종교, 인종/국적, 악플/욕설
        # (UnSmile 라벨 순서는 파일마다 조금씩 다를 수 있으나, 일반적으로 아래 순서 권장)
        label_cols = ['여성/가족', '남성', '성소수자', '인종/국적', '연령', '지역', '종교', '기타 혐오', '악플/욕설', 'clean', '개인지칭']
        
        # 데이터프레임에 없는 컬럼이 있다면 0으로 채움
        for loc in label_cols:
            if loc not in df.columns:
                df[loc] = 0
                
        final_cols = ['문장', '[Auto_Check]'] + label_cols + ['SourceFile']
        # 존재하는 컬럼만 선택
        final_cols = [c for c in final_cols if c in df.columns]
        
        df = df[final_cols]
        
        # CSV 저장
        df.to_csv(OUTPUT_FILE, index=False, encoding='utf-8-sig', sep='\t') # TSV 형태로 저장 (UnSmile 호환)
        print(f"\n✅ Auto-labeling complete! Saved to: {OUTPUT_FILE}")
        print("💡 Tip: TSV format saved. Open in Excel (Drag & Drop) to review.")
        print(f"   Column '[Auto_Check]' shows the most likely label.")

if __name__ == "__main__":
    run_auto_labeling()
