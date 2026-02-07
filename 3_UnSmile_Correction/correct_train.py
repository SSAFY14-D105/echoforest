"""
UnSmile 데이터셋 보정 스크립트 (Step 3)
- Baseline 테스트에서 발견된 인식률 저하 표현들을 재라벨링
- clean=1이지만 게임 관련 공격적 표현이 포함된 문장 → 악플/욕설=1로 변경
"""

import pandas as pd
import os

# 경로 설정
INPUT_PATH = 'UnSmile/UnSmile_Dataset_Drop_개인지칭/unsmile_train_v1.0.tsv'
OUTPUT_DIR = '3_UnSmile_Correction'
OUTPUT_PATH = f'{OUTPUT_DIR}/unsmile_train_corrected.tsv'

# 놓친 표현에서 추출한 키워드 목록 (게임 특유 + 은근한 비난)
# Baseline 테스트 False Negative 분석 결과 기반
CORRECTION_KEYWORDS = [
    '빡치', '빡친', '빡쳐',  # 분노 표현
    '열받', '킹받',           # 분노 표현
    '답답',                   # 비난 표현
    '지랄', '아가리',         # 욕설
    '트롤', '던지',           # 게임 비난
    '억까',                   # 억지 까기
    '똑바로', '제대로',       # 비난
    '정신차려', '정신안차려', # 비난
    '니 때문', '너 때문',     # 탓하기
    '못하네', '못해',         # 비난
]

print('=' * 60)
print('UnSmile 데이터셋 보정 스크립트')
print('=' * 60)

# 1. 데이터 로드
train = pd.read_csv(INPUT_PATH, sep='\t')
print(f'\n원본 데이터 로드: {len(train)}건')
print(f'  - Clean: {train["clean"].sum()}건')
print(f'  - 악플/욕설: {train["악플/욕설"].sum()}건')

# 2. 보정 대상 식별
print('\n[Step 1] 보정 대상 식별 중...')
correction_indices = set()

for kw in CORRECTION_KEYWORDS:
    # clean=1이면서 해당 키워드 포함
    mask = (train['clean'] == 1) & (train['문장'].str.contains(kw, regex=False, na=False))
    matches = train[mask]
    
    if len(matches) > 0:
        print(f'  [{kw}] - {len(matches)}건')
        correction_indices.update(matches.index.tolist())

print(f'\n총 보정 대상: {len(correction_indices)}건')

# 3. 라벨 수정
print('\n[Step 2] 라벨 수정 중...')
train_corrected = train.copy()

for idx in correction_indices:
    # clean=0, 악플/욕설=1로 변경
    train_corrected.at[idx, 'clean'] = 0
    train_corrected.at[idx, '악플/욕설'] = 1

# 4. 결과 확인
print(f'\n보정 후 데이터:')
print(f'  - Clean: {train_corrected["clean"].sum()}건')
print(f'  - 악플/욕설: {train_corrected["악플/욕설"].sum()}건')

# 5. 저장
os.makedirs(OUTPUT_DIR, exist_ok=True)
train_corrected.to_csv(OUTPUT_PATH, sep='\t', index=False, encoding='utf-8')
print(f'\n저장 완료: {OUTPUT_PATH}')

# 6. 보정 로그 저장
correction_log = train.loc[list(correction_indices), ['문장']].copy()
correction_log['원본_clean'] = 1
correction_log['원본_악플/욕설'] = 0
correction_log['보정_clean'] = 0
correction_log['보정_악플/욕설'] = 1
correction_log.to_csv(f'{OUTPUT_DIR}/correction_log.csv', index=True, encoding='utf-8-sig')
print(f'보정 로그 저장: {OUTPUT_DIR}/correction_log.csv')

print('\n' + '=' * 60)
print('보정 완료!')
print('=' * 60)
