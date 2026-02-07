import pandas as pd

# 정제된 unSmile 데이터 로드
train = pd.read_csv('UnSmile/UnSmile_Dataset_Drop_개인지칭/unsmile_train_v1.0.tsv', sep='\t')

# 놓친 표현에서 추출한 키워드 목록 (게임 특유 + 은근한 비난)
keywords = [
    '빡치', '빡친', '열받', '킹받', '답답',
    '지랄', '아가리', '트롤', '빡쳐', '억까',
    '똑바로', '정신차려', '정신안차려', '제대로',
    '니 때문', '너 때문', '못하네', '못해',
]

print('=== unSmile 원본에서 clean=1이지만 키워드 포함된 문장들 ===')
print()

total_count = 0
results = []

for kw in keywords:
    # clean=1이면서 해당 키워드 포함
    mask = (train['clean'] == 1) & (train['문장'].str.contains(kw, na=False))
    matches = train[mask]
    
    if len(matches) > 0:
        print(f'### [{kw}] - {len(matches)}건')
        for idx, row in matches.head(10).iterrows():
            sent = row['문장'][:60]
            print(f"  {sent}")
            results.append({'키워드': kw, '문장': row['문장'], 'index': idx})
        if len(matches) > 10:
            print(f"  ... 외 {len(matches) - 10}건 더")
        total_count += len(matches)
        print()

print(f'\n총 {total_count}건 발견')

# CSV로 저장
if results:
    df = pd.DataFrame(results)
    df.to_csv('2_unSmile_보정_후보_목록.csv', index=False, encoding='utf-8-sig')
    print(f'저장: 2_unSmile_보정_후보_목록.csv')
