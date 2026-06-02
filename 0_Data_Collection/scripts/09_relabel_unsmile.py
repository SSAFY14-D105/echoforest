"""
09_relabel_unsmile.py
=====================
UnSmile 데이터셋 8라벨 재라벨링

[목적]
- 협동게임 맥락에 맞게 8라벨로 재분류
- 키워드 기반 자동 라벨링

[8가지 라벨]
- abuse: 욕설/비속어
- hate: 혐오 표현 (성별/지역/인종/종교)
- clean: 일반 대화
- blame: 비난
- anger: 분노
- frustration: 좌절
- praise: 칭찬/격려
- order: 지시/명령

[입력] processed_data/05_external/unsmile_converted_8label.tsv
[출력] processed_data/05_external/unsmile_relabeled.tsv
"""

import os
import csv
import re

# ============================================================
# 경로 설정
# ============================================================
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH = os.path.join(SCRIPT_DIR, "processed_data", "05_external", "unsmile_converted_8label.tsv")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "processed_data", "05_external", "unsmile_relabeled.tsv")

# ============================================================
# 8라벨 컬럼 정의
# ============================================================
LABEL_COLUMNS = ['abuse', 'hate', 'clean', 'blame', 'anger', 'frustration', 'praise', 'order']

# ============================================================
# 욕설 키워드 (abuse)
# ============================================================
ABUSE_KEYWORDS = [
    # 기본 욕설
    '시발', '씨발', '씨팔', '시팔', '씹', '존나', '졸라', '좆', '좇', '개새끼', '새끼', 
    '병신', '썅', '쌍', '미친', '미친놈', '미친년', '미친새끼', '지랄', '찐따', '또라이',
    '꺼져', '닥쳐', '뒤져', '죽어', '재기', '패버리', '뚝배기', '대가리', '머저리',
    '븅신', '등신', '멍청이', '바보', '돼지', '쓰레기', '걸레', '창녀', '창놈',
    '얼빠진', '빡친', '빡세', '빡대가리', '좃밥', '후팔', '시팔',
    # 변형/약식
    'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅈㄴ', 'ㅈㄹ', 'ㄲㅈ',
]

# ============================================================
# 혐오 키워드 (hate) - 성별/지역/인종/종교/성소수자 등
# ============================================================
HATE_KEYWORDS = [
    # 성별 혐오
    '김치녀', '김치년', '한남충', '한남', '보지', '자지', '냄져', '맘충', '꼴페미', '페미',
    '상폐', '피싸개', '쿵쾅이', '쿵쾅', '보빨', '좆국', '웜녀', '보지년',
    # 지역 혐오
    '홍어', '전라도', '경상도', '쌍도', '라도', '경상충', '전라충', 
    # 인종/외국인 혐오
    '짱깨', '짱개', '짱퀴', '조선족', '좆족', '튀기', '동남아', '흑형', '검둥이',
    '외노자', '난민', '베트콩', '파퀴', '필리피노',
    # 종교 혐오
    '개독', '이슬람', '무슬림', '개슬람', '땡중', '빨갱이',
    # 성소수자 혐오
    '똥꼬충', '게이', '레즈', '동성애', '트랜스젠더', '트젠', '젠신병', '퀴어',
    # 나이 혐오
    '틀딱', '급식충', '급식',
    # 장애인 비하
    '장애', '정신병',
]

# ============================================================
# 분노 키워드 (anger)
# ============================================================
ANGER_KEYWORDS = [
    '화나', '화난다', '빡치', '열받', '짜증', '어이없', '황당', '분노', '격분',
    '미치겠', '돌겠', '터지겠', '또라이', '뭐야', '아이씨', '에이씨',
    '으악', '아악', '씹', '진짜', '하', '아', '으', '에휴', '아휴',
]

# ============================================================
# 비난 키워드 (blame)
# ============================================================
BLAME_KEYWORDS = [
    '왜그래', '뭐하냐', '못하', '왜안', '때문에', '탓', '잘못', '니가', '네가',
    '왜이래', '어떻게', '안하냐', '왜안해', '한심', '무능', '그것도못해',
    '책임', '네탓', '니탓', '지탓', '저탈', '문제', '걔', '쟤', '얘',
]

# ============================================================
# 좌절 키워드 (frustration)
# ============================================================
FRUSTRATION_KEYWORDS = [
    '아깝', '아쉽', '안돼', '안되', '못해', '힘들', '지쳤', '포기', '그만',
    '어떻게', '어떡해', '어쩌', '모르겠', '답답', '막막', '한숨',
    '우울', '슬프', '눈물', '약오르', '개판',
]

# ============================================================
# 칭찬 키워드 (praise)
# ============================================================
PRAISE_KEYWORDS = [
    '잘했', '좋아', '좋았', '최고', '짱', '대박', '굿', '나이스', '오케이', 'ok',
    '멋져', '멋있', '잘한다', '화이팅', '파이팅', '응원', '칭찬', '쵝오',
    '실력', '프로', '쩔어', '쩐다', '레전드', '그렇지', '역시',
    '인정', '오', '와', '우와', 'ㅋㅋ',
]

# ============================================================
# 지시 키워드 (order)
# ============================================================
ORDER_KEYWORDS = [
    '가라', '가세요', '가자', '와라', '와줘', '해라', '하세요', '해봐',
    '가만있어', '움직여', '멈춰', '올라가', '내려가', '올라와', '내려와',
    '밀어', '당겨', '점프', '눌러', '빼', '피해', '조심',
    '기다려', '빨리', '천천히', '같이', '따라와', '비켜',
    '봐', '봐라', '보세요', '들어', '듣고',
]


def classify_sentence(sentence: str) -> str:
    """
    문장을 협동게임 맥락에서 8라벨로 분류
    우선순위: abuse > hate > anger > blame > frustration > praise > order > clean
    """
    sentence_lower = sentence.lower()
    
    # 1순위: abuse (욕설)
    for kw in ABUSE_KEYWORDS:
        if kw in sentence_lower:
            return 'abuse'
    
    # 2순위: hate (혐오)
    for kw in HATE_KEYWORDS:
        if kw in sentence_lower:
            return 'hate'
    
    # 3순위: anger (분노)
    for kw in ANGER_KEYWORDS:
        if kw in sentence_lower:
            return 'anger'
    
    # 4순위: blame (비난)
    for kw in BLAME_KEYWORDS:
        if kw in sentence_lower:
            return 'blame'
    
    # 5순위: frustration (좌절)
    for kw in FRUSTRATION_KEYWORDS:
        if kw in sentence_lower:
            return 'frustration'
    
    # 6순위: praise (칭찬)
    for kw in PRAISE_KEYWORDS:
        if kw in sentence_lower:
            return 'praise'
    
    # 7순위: order (지시)
    for kw in ORDER_KEYWORDS:
        if kw in sentence_lower:
            return 'order'
    
    # 기본: clean
    return 'clean'


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
    print("🔄 UnSmile 데이터셋 8라벨 재라벨링")
    print("=" * 60)
    
    # 입력 파일 확인
    if not os.path.exists(INPUT_PATH):
        print(f"\n❌ 입력 파일 없음: {INPUT_PATH}")
        return
    
    # 데이터 로드
    print(f"\n📂 입력: {INPUT_PATH}")
    data = load_tsv(INPUT_PATH)
    total_count = len(data)
    print(f"   총 데이터: {total_count:,}개")
    
    # 재라벨링 수행
    print("\n🔄 재라벨링 중...")
    
    relabeled_data = []
    label_counts = {label: 0 for label in LABEL_COLUMNS}
    
    for row in data:
        sentence = row.get('sentence', '')
        
        # 협동게임 맥락에서 재분류
        new_label = classify_sentence(sentence)
        label_counts[new_label] += 1
        
        # 새로운 다중 컬럼 형식으로 변환
        new_row = {'sentence': sentence}
        for col in LABEL_COLUMNS:
            new_row[col] = 1 if col == new_label else 0
        
        relabeled_data.append(new_row)
    
    # 결과 저장
    save_tsv_multi_column(relabeled_data, OUTPUT_PATH)
    
    # 통계 출력
    print("\n📊 라벨별 통계:")
    print("-" * 40)
    for label in LABEL_COLUMNS:
        count = label_counts[label]
        pct = (count / total_count) * 100
        bar = '█' * int(pct / 2)
        print(f"   {label:12s}: {count:>6,}개 ({pct:5.1f}%) {bar}")
    
    print(f"\n✅ 저장 완료: {OUTPUT_PATH}")
    print(f"   총 {total_count:,}개 데이터 재라벨링됨")
    print("=" * 60)


if __name__ == "__main__":
    main()
