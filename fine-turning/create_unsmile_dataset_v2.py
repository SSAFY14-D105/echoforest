import pandas as pd
import json
import os

# 1. 파일 경로 설정
base_path = r"C:\Users\SSAFY\Desktop\SSAFY\02_second_semester\05_Project\01_공통프로젝트\03_S14P11D105_ai"
input_tsv = os.path.join(base_path, r"fine-turning\unsmile\train\unsmile_train_v1.0.tsv")
output_tsv = os.path.join(base_path, r"fine-turning\unsmile\train\unsmile_train_v2.0.tsv")
keywords_json = r"C:\Users\SSAFY\Desktop\SSAFY\02_second_semester\05_Project\01_공통프로젝트\07_S14PD015_stt_model_test\01_AI\02_Sentiment_Analysis\keywords.json"

print(f"🔄 데이터 처리 시작...")

# 2. 기존 TSV 로드
try:
    df = pd.read_csv(input_tsv, sep='\t')
    print(f"✅ 기존 데이터 로드 성공! ({len(df)}개 문장)")
except Exception as e:
    print(f"❌ 데이터 로드 실패: {e}")
    exit()

# 3. 'negative_morale' 컬럼 추가 (기존 데이터는 0)
df['negative_morale'] = 0

# 컬럼 순서 재배치: 'clean' 뒤에 'negative_morale' 위치시키기
cols = list(df.columns)
# negative_morale을 리스트에서 잠시 제거 (맨 뒤에 추가되었을 테니)
if 'negative_morale' in cols:
    cols.remove('negative_morale')

# clean 인덱스 찾기
try:
    clean_idx = cols.index('clean')
    # clean 뒤에 삽입
    cols.insert(clean_idx + 1, 'negative_morale')
except ValueError:
    # clean 컬럼이 없으면 그냥 맨 뒤에 둠
    cols.append('negative_morale')

df = df[cols]
print(f"📊 컬럼 구조 변경 완료: {len(cols)}개 컬럼 (negative_morale 추가됨)")

# 4. 추가 데이터 준비
new_rows = []

# 4-1. Negative Morale 데이터 (from keywords.json)
try:
    with open(keywords_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        nm_sentences = data.get('negative_morale_sentences', [])
        
    print(f"📥 비꼬기/사기저하 문장 {len(nm_sentences)}개 로드됨")
    
    for sent in nm_sentences:
        row = {col: 0 for col in cols} # 기본 0으로 초기화
        row['문장'] = sent
        row['negative_morale'] = 1
        row['clean'] = 0 # 부정적인 라벨이므로 clean은 0
        new_rows.append(row)
        
except Exception as e:
    print(f"⚠️ keywords.json 로드 중 오류: {e}")

# 4-2. Clean Counterparts (대조군 - 중요!!)
# 단어에 대한 편향을 막기 위해, 같은 단어를 썼지만 뜻은 좋은 문장들을 추가합니다.
clean_counterparts = [
    "와 모니터 화질 진짜 좋다 어디 거야?",
    "키보드 소리 너무 찰진데? 기계식임?",
    "아 배고파 죽겠다 점심 뭐 먹지",
    "와 이 노래 죽이는데? 제목 좀 알려줘",
    "오늘 날씨 죽인다 놀러 가고 싶다",
    "나 죽을 뻔했네 휴 다행이다",
    "혼자서도 잘해요 짝짝짝",
    "님 혼자 다 잡으셨네요 대박 ㄷㄷ", 
    "와 피지컬 대단하시네요 부럽다",
    "포기하지 않는 열정이 정말 대단해요",
    "못하는 게 없네 만능이다 진짜",
    "이보다 더 완벽할 순 없어 최고야",
    "와 진짜 너무 잘해서 할 말이 없네 ㅋㅋ", 
    "님 덕분에 많이 배우고 갑니다 감사합니다", 
    "서렌 치지 말고 끝까지 해보자 파이팅",
    "뭐지? 렉 걸렸나 봐 화면이 안 움직여",
    "아 모르겠다 그냥 찍어야지 ㅋㅋ",
    "진짜 왜 그래? 무슨 일 있어?", 
    "필요 없어? 그럼 내가 가질게 ㅋㅋ",
    "잘 안 들리는데 마이크 켜져 있어?",
    "혹시 모니터 144hz 써? 부드러워 보인다",
    "손가락 다친 건 좀 괜찮아?",
    "다음 판 돌리자 고고",
    "오픈마인드네 성격 좋다",
    "즐겜 유저 환영합니다 ^^",
    "와 실력이 진짜 프로급이시네요",
    "팀원들 덕분에 이겼습니다 버스 감사요",
    "게임 참 재밌게 하시네요 보기 좋아요",
    "아깝다 다음엔 꼭 이기자",
    "다들 너무 고생했어 수고했어",
    "우리 팀 합이 잘 맞네",
    "그쪽으로 가면 위험해 조심해",
    "맵 리딩 진짜 잘하시네요",
    "시간 가는 줄 모르고 했네 ㅋㅋ",
    "모니터 켜져 있어? 화면 공유 좀 해줘",
    "키보드 손으로 치는 거 맞아? 타자 진짜 빠르네", 
    "와 피지컬 지린다 (진심)",
    "나갈 때 문 좀 닫아줘",
    "혹시 마우스 켜져 있어?",
    "와 진짜 창의적이다 아이디어 좋네",
    "내일은 더 잘할 수 있을 거야",
    "실수는 누구나 하는 거지 괜찮아",
]

print(f"🛡️ 대조군(Clean) 문장 {len(clean_counterparts)}개 생성됨")

for sent in clean_counterparts:
    row = {col: 0 for col in cols}
    row['문장'] = sent
    row['clean'] = 1 # 클린 데이터이므로 1
    row['negative_morale'] = 0 
    new_rows.append(row)

# 5. 병합 및 저장
if new_rows:
    df_new = pd.DataFrame(new_rows)
    # 컬럼 순서 맞추기 (안전을 위해)
    df_new = df_new[cols]
    
    df_final = pd.concat([df, df_new], ignore_index=True)
    
    # 탭으로 구분된 파일로 저장
    df_final.to_csv(output_tsv, sep='\t', index=False)
    print(f"💾 저장 완료: {output_tsv}")
    print(f"📈 최종 데이터 개수: {len(df_final)}개 (기존 {len(df)} + 추가 {len(df_new)})")
    
    # 샘플 출력
    print("\n[샘플 데이터 확인]")
    print(df_final[['문장', 'clean', 'negative_morale']].tail(5))
else:
    print("⚠️ 추가할 데이터가 없습니다.")
