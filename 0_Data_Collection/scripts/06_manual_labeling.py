"""
06_manual_labeling.py
=====================
키워드 기반 수동 라벨링

[목적]
- 한국어 게임 음성 채팅에 맞춘 패턴 매칭
- Gemini 사용하지 않음 (오프라인 처리)

[8가지 라벨]
- abuse: 욕설/비속어
- hate: 혐오 표현
- clean: 일반 대화
- blame: 비난
- anger: 분노
- frustration: 좌절/한숨
- praise: 칭찬
- order: 지시/명령

[입력] processed_data/04_anonymized_clean/final_dataset_clean.tsv
[출력] processed_data/04_anonymized_clean/final_dataset_labeled.tsv
"""

import os
import csv
import re
from collections import Counter

# ============================================================
# 경로 설정
# ============================================================
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH = os.path.join(SCRIPT_DIR, "processed_data", "04_anonymized_clean", "final_dataset_clean.tsv")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "processed_data", "04_anonymized_clean", "final_dataset_labeled.tsv")

# ============================================================
# 한국어 키워드 사전 (게임 음성 채팅 기반)
# ============================================================

# 1. 욕설/비속어 (abuse) - 강한 욕설
ABUSE_KEYWORDS = [
    # 기본 욕설
    '씨발', '시발', '씨bal', '씨팔', '시팔', '씨바', '시바', 'ㅅㅂ', 'ㅆㅂ',
    '개새끼', '개새기', '개쌔끼', '새끼', '쌔끼', '썅', '썅년', '썅놈',
    '병신', '븅신', 'ㅂㅅ', '빙신', '미친놈', '미친년', '미친새끼', '미친것',
    '지랄', '좆', '존나', '졸라', 'ㅈㄴ', '좃', '자지', '보지',
    '니미', '느금마', '느금', 'ㄴㄱㅁ', '엄창', '애미', '애비',
    '꺼져', '닥쳐', '죽어', '뒤져', '디져', '뒤지', '디지', '뒈져',
    '호구', '호로', '호로새끼', '쓰레기', '똥', '개같', '찐따', '찐빠',
    '멍청', '바보', '등신', '또라이', '돌아이', '미쳤',
    # 변형
    '시ㅂ', 'ㅅ발', '개ㅅㄲ', '시bal', '개색', '개쓰레기',
    '짜증', '열받', '빡치', '빡쳐', '빡간다', '개빡',
]

# 2. 혐오 표현 (hate) - 차별/비하
HATE_KEYWORDS = [
    # 성별 혐오
    '한남', '한녀', '김치녀', '김치남', '된장녀', '맘충', '틀딱',
    # 지역/국가 혐오
    '쪽발이', '짱깨', '흑형', '깜둥이',
    # 장애 비하
    '장애인', '애자', '병자', '정신병', '정병',
    # 외모 비하
    '못생', '뚱뚱', '뚱땡', '돼지',
]

# 3. 비난 (blame) - 남 탓하기
BLAME_KEYWORDS = [
    '니 때문', '네 때문', '너 때문', '탓이야', '잘못이야', '니가 그래서',
    '왜 그래', '왜 그러', '뭐하냐', '뭐해', '못하냐', '못해',
    '제대로 해', '제대로 좀', '똑바로', '잘 좀', '왜 안 해',
    '니가 해', '네가 해', '왜 죽어', '왜 틀려', '왜 못해',
    '실수', '잘못', '바보같이', '멍청하게',
]

# 4. 분노 (anger) - 화남/격앙
ANGER_KEYWORDS = [
    '화나', '열받', '짜증나', '미치겠', '돌겠', '환장',
    '아 진짜', '아 씨', '아이씨', '에이씨', '아오', 'ㅏ 진짜',
    '아악', '으악', '아아아', '으아아',
    '뭐야', '이게 뭐야', '왜 이래', '왜 이러',
    '말이 되냐', '말이 돼', '이게 말이', '어이없',
    '진짜 아', '진짜로', '실화냐', '실화야',
]

# 5. 좌절 (frustration) - 아쉬움/포기
FRUSTRATION_KEYWORDS = [
    '아깝다', '아쉽다', '아쉬워', '아깝네',
    '안돼', '안 돼', '못해', '못하겠', '포기', '그만',
    '힘들어', '지쳐', '지친다', '피곤',
    '망했', '끝났', '글렀', '죽었',
    '어떡해', '어떻게', '큰일', '망함',
    '하아', '휴', '에휴', '아이고', '아이구',
    '억울', '분하다',
]

# 6. 칭찬 (praise) - 긍정/격려
PRAISE_KEYWORDS = [
    '잘했', '잘한다', '잘해', '잘하네', '잘함',
    '좋아', '좋았어', '좋다', '좋네', '좋아요',
    '멋지', '멋있', '대박', '쩐다', '쩔어', '미쳤다',
    'ㄱㄱ', '굿', 'good', 'nice', 'gg', 'GG', '오케이', '오게',
    '화이팅', '파이팅', '힘내', '응원',
    '고마워', '고맙다', '감사', 'ㄳ', 'ㄱㅅ',
    '최고', '짱', '대단', '훌륭',
    '그래', '그렇지', '그치', '그거지', '맞아',
    '살았다', '성공', '클리어', '깼다', '이겼',
]

# 7. 지시/명령 (order) - 게임 내 지시
ORDER_KEYWORDS = [
    '가', '가라', '가자', '가세요', '갑시다', '고고', '고고고', 'ㄱㄱ', 'gg',
    '와', '와라', '오세요', '이리와', '와봐',
    '해', '해라', '해봐', '하세요', '해주세요', '해줘',
    '봐', '봐라', '봐봐', '보세요', '봐주세요',
    '눌러', '누르세요', '눌러봐',
    '점프', '뛰어', '뛰어봐', '점프해',
    '올라가', '내려가', '올라와', '내려와',
    '밀어', '밀어줘', '당겨', '당겨줘',
    '기다려', '멈춰', '스톱', 'stop', '잠깐',
    '비켜', '피해', '조심', '주의',
    '빨리', '어서', '서둘러', '급해',
    '천천히', '살살', '조심히',
    '같이', '함께', '따라', '따라와',
    '들어가', '나가', '나와', '들어와',
]


# ============================================================
# 라벨링 함수
# ============================================================

def contains_keyword(text: str, keywords: list) -> bool:
    """텍스트에 키워드가 포함되어 있는지 확인"""
    text_lower = text.lower()
    for keyword in keywords:
        if keyword.lower() in text_lower:
            return True
    return False


def count_keywords(text: str, keywords: list) -> int:
    """텍스트에서 키워드 매칭 수 카운트"""
    text_lower = text.lower()
    count = 0
    for keyword in keywords:
        if keyword.lower() in text_lower:
            count += 1
    return count


def classify_sentence(text: str) -> str:
    """
    문장을 8가지 라벨 중 하나로 분류
    우선순위: abuse > hate > anger > blame > frustration > praise > order > clean
    """
    if not text or not isinstance(text, str):
        return "clean"
    
    text = text.strip()
    
    # 1. 욕설/비속어 체크 (최우선)
    if contains_keyword(text, ABUSE_KEYWORDS):
        return "abuse"
    
    # 2. 혐오 표현 체크
    if contains_keyword(text, HATE_KEYWORDS):
        return "hate"
    
    # 3. 분노 체크
    if contains_keyword(text, ANGER_KEYWORDS):
        return "anger"
    
    # 4. 비난 체크
    if contains_keyword(text, BLAME_KEYWORDS):
        return "blame"
    
    # 5. 좌절 체크
    if contains_keyword(text, FRUSTRATION_KEYWORDS):
        return "frustration"
    
    # 6. 칭찬 체크
    if contains_keyword(text, PRAISE_KEYWORDS):
        return "praise"
    
    # 7. 지시/명령 체크
    # 지시는 문장 끝에 오는 경우가 많으므로 특별 처리
    if contains_keyword(text, ORDER_KEYWORDS):
        return "order"
    
    # 8. 위 모든 조건에 해당 안 되면 clean
    return "clean"


def load_tsv(filepath: str) -> list:
    """TSV 파일 로드 (UTF-8 BOM 처리)"""
    data = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            data.append(row)
    return data


def save_tsv(data: list, filepath: str):
    """TSV 파일 저장"""
    if not data:
        return
    
    fieldnames = list(data[0].keys())
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
        writer.writeheader()
        writer.writerows(data)


# ============================================================
# 메인 실행
# ============================================================

def main():
    print("=" * 60)
    print("🏷️  수동 한국어 키워드 기반 라벨링 시작")
    print("=" * 60)
    
    # 입력 파일 확인
    if not os.path.exists(INPUT_PATH):
        print(f"❌ 입력 파일 없음: {INPUT_PATH}")
        return
    
    # 데이터 로드
    print(f"\n📂 입력: {INPUT_PATH}")
    data = load_tsv(INPUT_PATH)
    total_count = len(data)
    print(f"   총 데이터: {total_count:,}개")
    
    # 라벨링 수행
    print("\n🔄 라벨링 중...")
    
    label_counts = Counter()
    labeled_data = []
    
    for row in data:
        sentence = row.get('sentence', '')
        label = classify_sentence(sentence)
        
        labeled_data.append({
            'sentence': sentence,
            'label': label
        })
        
        label_counts[label] += 1
    
    # 결과 저장
    save_tsv(labeled_data, OUTPUT_PATH)
    
    # 통계 출력
    print("\n" + "=" * 60)
    print("📊 라벨링 결과")
    print("=" * 60)
    print(f"   총 데이터: {total_count:,}개")
    
    print("\n📋 라벨별 통계:")
    for label, count in sorted(label_counts.items(), key=lambda x: -x[1]):
        percentage = count / total_count * 100
        bar = "█" * int(percentage / 2)
        print(f"   {label:12s}: {count:>6,}개 ({percentage:5.1f}%) {bar}")
    
    print(f"\n✅ 저장 완료: {OUTPUT_PATH}")
    print("=" * 60)
    
    # 샘플 출력
    print("\n📝 라벨별 샘플 (각 3개):")
    print("-" * 60)
    
    samples_per_label = {}
    for item in labeled_data:
        label = item['label']
        if label not in samples_per_label:
            samples_per_label[label] = []
        if len(samples_per_label[label]) < 3:
            samples_per_label[label].append(item['sentence'][:50])
    
    for label in ['abuse', 'hate', 'anger', 'blame', 'frustration', 'praise', 'order', 'clean']:
        if label in samples_per_label:
            print(f"\n[{label}]")
            for sample in samples_per_label[label]:
                print(f"  - {sample}...")


if __name__ == "__main__":
    main()
