import csv
import os
import torch
import sys
from tqdm import tqdm

# Transformers 라이브러리 로드 (없으면 에러 메시지 출력)
try:
    from transformers import BertForSequenceClassification, AutoTokenizer, TextClassificationPipeline
except ImportError:
    print("Error: 'transformers' library not found.")
    print("Please install it: pip install transformers torch")
    sys.exit(1)

# 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "processed_data", "03_anonymized", "final_dataset.tsv")
OUTPUT_DIR = os.path.join(BASE_DIR, "processed_data", "05_auto_labeled")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "auto_labeled_17k.tsv")

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# -------------------------------------------------------------------------
# 키워드 정의 (Keyword Overrides)
# -------------------------------------------------------------------------
KEYWORDS_BLAME = [
    "너 때문", "니 탓", "뭐하냐", "뭐하심", "왜 저래", "왜 그래", 
    "트롤", "생각 좀", "뇌가", "도대체", "뭐함", "누가", 
    "니가", "양심", "일부러", "사람이냐", "안하냐", "제대로",
    "죽겠", "던지", "구멍"
]

KEYWORDS_FRUSTRATION = [
    "하...", "미치겠", "답답", "환장", "혈압", 
    "안해", "못해먹겠", "망했", "가망", "어휴", "한숨", 
    "힘들", "포기", "아니 근데", "아오", "에바", "노답", "어떡하",
    "나 왜"
]

KEYWORDS_ANGER = [
    "화나", "열받", "짜증", "빡치", "개같", "역겹",
    "아 진짜", "진짜 아", "화난", "화나네", "화나죽겠네", "화나죽겠어", "화나죽겠네",
    "열받네", "열받아", "열받아죽겠네", "열받아죽겠어", "열받아죽겠네",
    "짜증나네", "짜증나", "짜증나죽겠네", "짜증나죽겠어", "짜증나죽겠네",
    "빡치네", "빡쳐", "빡쳐죽겠네", "빡쳐죽겠어", "빡쳐죽겠네",
    "개같네", "개같아"
]

KEYWORDS_PRAISE = [
    "나이스", "잘했어", "굳", "굿", "대박", "지렸", "캐리", 
    "천재", "완벽", "좋아", "훌륭", "인정", "사랑", "최고"
]

def main():
    print("Initializing Unsmile Model...")
    model_name = "smilegate-ai/kor_unsmile"
    
    try:
        model = BertForSequenceClassification.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # GPU 사용 가능 시 사용
        device = 0 if torch.cuda.is_available() else -1
        print(f"Using Device: {'GPU' if device == 0 else 'CPU'}")
        
        pipe = TextClassificationPipeline(
            model=model,
            tokenizer=tokenizer,
            device=device,
            return_all_scores=True,
            function_to_apply='sigmoid'
        )
    except Exception as e:
        print(f"Failed to load model: {e}")
        return

    # 데이터 로드
    print(f"Loading data from {INPUT_FILE}...")
    sentences = []
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            # 헤더 제외하고 첫 번째 컬럼(문장)만 추출
            for line in lines[1:]:
                parts = line.strip().split('\t')
                if parts:
                    sentences.append(parts[0])
    except Exception as e:
        print(f"Error reading input file: {e}")
        return
        
    print(f"Processing {len(sentences)} sentences... (This may take a while)")
    
    labeled_rows = []
    batch_size = 32
    
    # 배치 처리
    for i in tqdm(range(0, len(sentences), batch_size)):
        batch_texts = sentences[i:i+batch_size]
        if not batch_texts: continue
        
        try:
            predictions = pipe(batch_texts)
        except Exception as e:
            print(f"Error in batch inference: {e}")
            continue
            
        for text, preds in zip(batch_texts, predictions):
            # 7개 라벨 초기화
            labels = {
                '악플/욕설': 0, '기타_혐오': 0, 'clean': 0,
                '남탓': 0, '감정표출': 0, '좌절': 0, '칭찬': 0
            }
            
            # 1. AI 예측 결과 반영 (Custom Threshold Strategy)
            # Strategy: Clean Probability < 82.7% (0.827) -> Consider as Negative
            # 즉, 아주 깨끗하지 않으면 잡티(욕설/혐오)가 있다고 판단.
            
            # 예측 결과에서 clean 점수 찾기 (Unsmile 모델은 Multi-class이므로 sigmoid가 아닐 경우 score 합이 1일 수 있음. 
            # 하지만 Pipeline 설정에서 sigmoid를 썼을 수 있으므로 각 라벨별 점수 확인)
            
            clean_score = 0.0
            max_neg_score = -1.0
            max_neg_label = ""
            
            # 예측값 순회
            for p in preds:
                lbl = p['label']
                score = p['score']
                
                if lbl == 'clean':
                    clean_score = score
                elif lbl != '개인지칭': # 개인지칭 무시
                    if score > max_neg_score:
                        max_neg_score = score
                        max_neg_label = lbl
            
            # 17.3 Rule 적용 (Clean Threshold = 0.827)
            if clean_score >= 0.827:
                labels['clean'] = 1
            else:
                # Clean하지 않다면, 가장 높은 점수의 부정 라벨 선택
                # 만약 부정 라벨 점수가 너무 낮다면? -> 그래도 Clean이 낮으면 혐오로 분류 (사용자 의도)
                if max_neg_label == '악플/욕설':
                    labels['악플/욕설'] = 1
                elif max_neg_label: # 그 외 모든 라벨
                    labels['기타_혐오'] = 1
                else: 
                    # 부정 라벨이 뚜렷하지 않지만 Clean도 낮은 경우 (희귀 케이스) -> 기타 혐오로 처리
                    labels['기타_혐오'] = 1

            
            # 2. 키워드 오버라이딩 (Override/Add)
            if any(k in text for k in KEYWORDS_BLAME): labels['남탓'] = 1
            if any(k in text for k in KEYWORDS_FRUSTRATION): labels['좌절'] = 1
            if any(k in text for k in KEYWORDS_ANGER): labels['감정표출'] = 1
            if any(k in text for k in KEYWORDS_PRAISE): labels['칭찬'] = 1
            
            # 3. 충돌 해결 (부정 라벨이 있으면 Clean 제거)
            negative_flags = ['악플/욕설', '기타_혐오', '남탓', '감정표출', '좌절']
            is_negative = any(labels[k] == 1 for k in negative_flags)
            
            if is_negative:
                labels['clean'] = 0
            
            if labels['칭찬'] == 1:
                labels['clean'] = 0 # 칭찬은 긍정이므로 중립(Clean) 아님
                
            # 아무 라벨도 없으면 Clean으로 처리
            if sum(labels.values()) == 0:
                labels['clean'] = 1
                
            # 결과 저장
            row = {'sentence': text}
            row.update(labels)
            labeled_rows.append(row)

    # 파일 저장
    print(f"Saving results to {OUTPUT_FILE}...")
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
            headers = ['sentence', '악플/욕설', '기타_혐오', 'clean', '남탓', '감정표출', '좌절', '칭찬']
            writer = csv.DictWriter(f, fieldnames=headers, delimiter='\t')
            writer.writeheader()
            writer.writerows(labeled_rows)
        print("Done!")
    except Exception as e:
        print(f"Error saving file: {e}")

if __name__ == "__main__":
    main()
