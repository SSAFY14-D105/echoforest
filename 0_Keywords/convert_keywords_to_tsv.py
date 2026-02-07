import json
import pandas as pd
import os

# 파일 경로 설정
keywords_path = r'C:/SSAFY/S14P11D105/0_Keywords/keywords.json'
output_path = r'C:/SSAFY/S14P11D105/1_Keywords_test_인식률_테스트/keywords_unsmile_format.tsv'

# JSON 파일 로드
with open(keywords_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 데이터 추출
rows = []

# clean 문장 처리
for sentence in data.get('clean_sentences', []):
    rows.append({
        '문장': sentence,
        '여성/가족': 0, '남성': 0, '성소수자': 0, '인종/국적': 0, '연령': 0, 
        '지역': 0, '종교': 0, '기타 혐오': 0, '악플/욕설': 0, 'clean': 1
    })

# negative 문장 처리 (악플/욕설)
for sentence in data.get('negative_sentences', []):
    rows.append({
        '문장': sentence,
        '여성/가족': 0, '남성': 0, '성소수자': 0, '인종/국적': 0, '연령': 0, 
        '지역': 0, '종교': 0, '기타 혐오': 0, '악플/욕설': 1, 'clean': 0
    })

# DataFrame 생성
df = pd.DataFrame(rows)

# 컬럼 순서 지정 (unSmile 데이터셋 형식)
columns = ['문장', '여성/가족', '남성', '성소수자', '인종/국적', '연령', '지역', '종교', '기타 혐오', '악플/욕설', 'clean']
df = df[columns]

# TSV 파일로 저장
os.makedirs(os.path.dirname(output_path), exist_ok=True)
df.to_csv(output_path, sep='\t', index=False, encoding='utf-8')

print(f"변환 완료: {len(df)}개의 문장이 저장되었습니다.")
print(f"저장 위치: {output_path}")
print("\n[데이터 미리보기]")
print(df.head())
