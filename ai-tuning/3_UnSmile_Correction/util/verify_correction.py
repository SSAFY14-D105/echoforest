"""보정 결과 확인 스크립트"""
import pandas as pd

print('=' * 60)
print('보정 결과 확인')
print('=' * 60)

# 원본 데이터
orig_train = pd.read_csv('UnSmile/UnSmile_Dataset_Drop_개인지칭/unsmile_train_v1.0.tsv', sep='\t')
orig_valid = pd.read_csv('UnSmile/UnSmile_Dataset_Drop_개인지칭/unsmile_valid_v1.0.tsv', sep='\t')

# 보정 데이터
corr_train = pd.read_csv('3_UnSmile_Correction/unsmile_train_corrected.tsv', sep='\t')
corr_valid = pd.read_csv('3_UnSmile_Correction/unsmile_valid_corrected.tsv', sep='\t')

# 보정 로그
log_train = pd.read_csv('3_UnSmile_Correction/correction_log/correction_log_train.csv')
log_valid = pd.read_csv('3_UnSmile_Correction/correction_log/correction_log_valid.csv')

print()
print('[Train 데이터셋]')
print(f'  원본: {len(orig_train)}건 (Clean: {orig_train["clean"].sum()}, 악플: {orig_train["악플/욕설"].sum()})')
print(f'  보정: {len(corr_train)}건 (Clean: {corr_train["clean"].sum()}, 악플: {corr_train["악플/욕설"].sum()})')
print(f'  보정된 문장: {len(log_train)}건')

print()
print('[Valid 데이터셋]')
print(f'  원본: {len(orig_valid)}건 (Clean: {orig_valid["clean"].sum()}, 악플: {orig_valid["악플/욕설"].sum()})')
print(f'  보정: {len(corr_valid)}건 (Clean: {corr_valid["clean"].sum()}, 악플: {corr_valid["악플/욕설"].sum()})')
print(f'  보정된 문장: {len(log_valid)}건')

print()
print('[변화량]')
train_diff = orig_train['clean'].sum() - corr_train['clean'].sum()
valid_diff = orig_valid['clean'].sum() - corr_valid['clean'].sum()
print(f'  Train: Clean -{train_diff}건, 악플 +{train_diff}건')
print(f'  Valid: Clean -{valid_diff}건, 악플 +{valid_diff}건')
