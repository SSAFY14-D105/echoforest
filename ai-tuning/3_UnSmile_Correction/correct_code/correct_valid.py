"""
UnSmile Valid 데이터셋 보정 스크립트
- Train과 동일한 키워드 기준으로 Valid 데이터도 보정
"""

import pandas as pd
import os

# 경로 설정
INPUT_PATH = 'UnSmile/UnSmile_Dataset_Drop_개인지칭/unsmile_valid_v1.0.tsv'
OUTPUT_DIR = '3_UnSmile_Correction'
OUTPUT_PATH = f'{OUTPUT_DIR}/unsmile_valid_corrected.tsv'

# Train과 동일한 키워드 목록
CORRECTION_KEYWORDS = [
    '빡치', '빡친', '빡쳐',
    '열받', '킹받',
    '답답',
    '지랄', '아가리',
    '트롤', '던지',
    '억까',
    '똑바로', '제대로',
    '정신차려', '정신안차려',
    '니 때문', '너 때문',
    '못하네', '못해',
]

print('=' * 60)
print('UnSmile Valid 데이터셋 보정 스크립트')
print('=' * 60)

# 1. 데이터 로드
valid = pd.read_csv(INPUT_PATH, sep='\t')
print(f'\n원본 Valid 데이터 로드: {len(valid)}건')
print(f'  - Clean: {valid["clean"].sum()}건')
print(f'  - 악플/욕설: {valid["악플/욕설"].sum()}건')

# 2. 보정 대상 식별
print('\n[Step 1] 보정 대상 식별 중...')
correction_indices = set()

for kw in CORRECTION_KEYWORDS:
    mask = (valid['clean'] == 1) & (valid['문장'].str.contains(kw, regex=False, na=False))
    matches = valid[mask]
    
    if len(matches) > 0:
        print(f'  [{kw}] - {len(matches)}건')
        correction_indices.update(matches.index.tolist())

print(f'\n총 보정 대상: {len(correction_indices)}건')

# 3. 라벨 수정
print('\n[Step 2] 라벨 수정 중...')
valid_corrected = valid.copy()

for idx in correction_indices:
    valid_corrected.at[idx, 'clean'] = 0
    valid_corrected.at[idx, '악플/욕설'] = 1

# 4. 결과 확인
print(f'\n보정 후 Valid 데이터:')
print(f'  - Clean: {valid_corrected["clean"].sum()}건')
print(f'  - 악플/욕설: {valid_corrected["악플/욕설"].sum()}건')

# 5. 저장
os.makedirs(OUTPUT_DIR, exist_ok=True)
valid_corrected.to_csv(OUTPUT_PATH, sep='\t', index=False, encoding='utf-8')
print(f'\n저장 완료: {OUTPUT_PATH}')

# 6. 보정 로그 저장
correction_log = valid.loc[list(correction_indices), ['문장']].copy()
correction_log['원본_clean'] = 1
correction_log['원본_악플/욕설'] = 0
correction_log['보정_clean'] = 0
correction_log['보정_악플/욕설'] = 1
correction_log.to_csv(f'{OUTPUT_DIR}/correction_log/correction_log_valid.csv', index=True, encoding='utf-8-sig')
print(f'보정 로그 저장: {OUTPUT_DIR}/correction_log/correction_log_valid.csv')

print('\n' + '=' * 60)
print('Valid 데이터셋 보정 완료!')
print('=' * 60)
