"""
04_7_convert_to_binary_labels.py
=================================
라벨을 다중 컬럼 이진 형식으로 변환 (학습 데이터용)

출력 형식:
  sentence	abuse	hate	clean	blame	anger	frustration	praise	order
  문장내용	0	0	1	0	0	0	0	0

입력: processed_data/04_anonymized_clean/final_dataset_labeled.tsv
출력: processed_data/04_anonymized_clean/final_dataset_binary.tsv
"""

import os
import csv

# ============================================================
# 경로 설정
# ============================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, "processed_data", "04_anonymized_clean", "final_dataset_labeled.tsv")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "processed_data", "04_anonymized_clean", "final_dataset_binary.tsv")

# ============================================================
# 라벨 순서 정의 (8라벨)
# ============================================================
LABEL_COLUMNS = [
    'abuse',       # 욕설/비속어
    'hate',        # 혐오 표현
    'clean',       # 일반 대화
    'blame',       # 비난
    'anger',       # 분노
    'frustration', # 좌절
    'praise',      # 칭찬/격려
    'order',       # 지시/명령
]


def load_tsv(filepath: str) -> list:
    """TSV 파일 로드 (UTF-8 BOM 처리)"""
    data = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            data.append(row)
    return data


def save_tsv_multi_column(data: list, filepath: str):
    """다중 컬럼 형식으로 TSV 저장"""
    fieldnames = ['sentence'] + LABEL_COLUMNS
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
        writer.writeheader()
        writer.writerows(data)


# ============================================================
# 메인 실행
# ============================================================

def main():
    print("=" * 60)
    print("🔢 라벨 → 다중 컬럼 이진 형식 변환")
    print("=" * 60)
    
    print("\n📋 출력 컬럼:")
    print(f"   sentence + {LABEL_COLUMNS}")
    
    # 입력 파일 확인
    if not os.path.exists(INPUT_PATH):
        print(f"\n❌ 입력 파일 없음: {INPUT_PATH}")
        return
    
    # 데이터 로드
    print(f"\n📂 입력: {INPUT_PATH}")
    data = load_tsv(INPUT_PATH)
    total_count = len(data)
    print(f"   총 데이터: {total_count:,}개")
    
    # 변환 수행
    print("\n🔄 변환 중...")
    
    converted_data = []
    for row in data:
        sentence = row.get('sentence', '')
        label = row.get('label', 'clean')
        
        # 각 라벨 컬럼에 대해 0 또는 1 설정
        new_row = {'sentence': sentence}
        for col in LABEL_COLUMNS:
            new_row[col] = 1 if col == label else 0
        
        converted_data.append(new_row)
    
    # 결과 저장
    save_tsv_multi_column(converted_data, OUTPUT_PATH)
    
    # 샘플 출력
    print("\n📝 변환 샘플 (처음 5개):")
    print("-" * 80)
    header = "sentence\t" + "\t".join(LABEL_COLUMNS)
    print(header)
    print("-" * 80)
    for row in converted_data[:5]:
        values = [row['sentence'][:30] + "..." if len(row['sentence']) > 30 else row['sentence']]
        values += [str(row[col]) for col in LABEL_COLUMNS]
        print("\t".join(values))
    
    print(f"\n✅ 저장 완료: {OUTPUT_PATH}")
    print(f"   총 {total_count:,}개 데이터 변환됨")
    print("=" * 60)


if __name__ == "__main__":
    main()
