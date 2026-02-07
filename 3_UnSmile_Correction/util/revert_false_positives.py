"""
잘못 보정된 문장 되돌리기 스크립트
- False positive로 판단된 문장들을 원래 clean=1로 복구
"""

import pandas as pd

# 잘못 보정된 인덱스들 (Train)
FALSE_POSITIVE_TRAIN = [
    4628,   # 주 예수보다 더 귀한것은 없네... (종교 찬양)
    12568,  # 아가야... 웃음을 멈추지 못해... (위로 메시지)
    11811,  # 워렌버핏 말... 챙기지 못해... (중립 인용)
    2089,   # 주 예수보다 더 귀한 것은 없네... (찬송가)
    8131,   # 퀴어로 사는 것까지 말리진 못해도... (양보 표현)
    8133,   # 액정기술이 발달하지 못해서... (기술 설명)
    14160,  # 소주+삼겹살 포기못해 (자기 고백)
    12149,  # 토플 라이팅 못해도 20이상... (칭찬)
    7418,   # 제대로 된 ai구나 (칭찬)
]

# 잘못 보정된 인덱스들 (Valid)
FALSE_POSITIVE_VALID = [
    226,    # AI도 키보드... 되어야하는거 아니냐? (중립 의문)
    3141,   # 성인지 감수성... 제대로 가지길 (중립 조언)
    2286,   # 마스크만 제대로 써도... (사실 전달)
]

print('=' * 60)
print('잘못 보정된 문장 되돌리기')
print('=' * 60)

# 1. Train 처리
print('\n[Train 데이터셋]')
train = pd.read_csv('3_UnSmile_Correction/unsmile_train_corrected.tsv', sep='\t')
print(f'처리 전: Clean={train["clean"].sum()}, 악플/욕설={train["악플/욕설"].sum()}')

reverted_train = 0
for idx in FALSE_POSITIVE_TRAIN:
    if idx in train.index:
        train.at[idx, 'clean'] = 1
        train.at[idx, '악플/욕설'] = 0
        reverted_train += 1
        print(f'  되돌림 [{idx}]: {train.at[idx, "문장"][:40]}...')

train.to_csv('3_UnSmile_Correction/unsmile_train_corrected.tsv', sep='\t', index=False, encoding='utf-8')
print(f'되돌린 문장: {reverted_train}건')
print(f'처리 후: Clean={train["clean"].sum()}, 악플/욕설={train["악플/욕설"].sum()}')

# 2. Valid 처리
print('\n[Valid 데이터셋]')
valid = pd.read_csv('3_UnSmile_Correction/unsmile_valid_corrected.tsv', sep='\t')
print(f'처리 전: Clean={valid["clean"].sum()}, 악플/욕설={valid["악플/욕설"].sum()}')

reverted_valid = 0
for idx in FALSE_POSITIVE_VALID:
    if idx in valid.index:
        valid.at[idx, 'clean'] = 1
        valid.at[idx, '악플/욕설'] = 0
        reverted_valid += 1
        print(f'  되돌림 [{idx}]: {valid.at[idx, "문장"][:40]}...')

valid.to_csv('3_UnSmile_Correction/unsmile_valid_corrected.tsv', sep='\t', index=False, encoding='utf-8')
print(f'되돌린 문장: {reverted_valid}건')
print(f'처리 후: Clean={valid["clean"].sum()}, 악플/욕설={valid["악플/욕설"].sum()}')

print('\n' + '=' * 60)
print(f'완료! Train {reverted_train}건, Valid {reverted_valid}건 되돌림')
print('=' * 60)
