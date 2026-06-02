"""
05_text_clean_advanced.py
=========================
STT 데이터셋 고급 클리닝

[목적]
- 노이즈 필터링 (짧은 문장, 숫자만 있는 문장)
- 영어 혼합/STT 환각 오류 제거
- 반복 표현 정리
- 중복 문장 제거

[입력] processed_data/04_anonymized/final_dataset.tsv
[출력] processed_data/04_anonymized_clean/final_dataset_clean.tsv
"""

import os
import re
import csv
from collections import Counter

# ============================================================
# 경로 설정
# ============================================================
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH = os.path.join(SCRIPT_DIR, "processed_data", "04_anonymized", "final_dataset.tsv")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "processed_data", "04_anonymized_clean")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "final_dataset_clean.tsv")

# ============================================================
# 클리닝 설정
# ============================================================
MIN_CHAR_LENGTH = 5          # 최소 글자 수 (이하 제거)
MIN_KOREAN_RATIO = 0.3       # 최소 한글 비율 (이하 제거)
MAX_REPEAT_COUNT = 3         # 동일 단어 연속 반복 허용 횟수
MAX_ENGLISH_RATIO = 0.5      # 최대 영어 비율 (초과 시 제거)

# 제거할 패턴
NOISE_PATTERNS = [
    r'^[\d\s\.]+$',                    # 숫자와 공백만 있는 문장
    r'^[A-Za-z\s]+$',                  # 영어만 있는 문장
    r'^[\d\s]+[가-힣]{1,2}$',          # 숫자 + 짧은 한글 (예: "05 지금")
    r'^[A-Za-z]{1,3}\s',               # 영어 1~3자로 시작하는 경우
    r'^\d+$',                          # 순수 숫자만
    r'^[가-힣]{1}$',                   # 한 글자만 있는 경우
]

# STT 환각/오류 키워드 (Whisper 오인식 패턴)
STT_HALLUCINATION_KEYWORDS = [
    "anal", "RPdish", "dochite", "alphathe", "ister", "perdition",
    "bittor", "Leyme", "cantidad", "Allegro", "Tydmg", "cos요리",
]

# ============================================================
# 클리닝 함수들
# ============================================================

def get_korean_ratio(text: str) -> float:
    """한글 비율 계산"""
    if not text:
        return 0.0
    korean_chars = len(re.findall(r'[가-힣]', text))
    total_chars = len(re.sub(r'\s', '', text))  # 공백 제외
    return korean_chars / total_chars if total_chars > 0 else 0.0


def get_english_ratio(text: str) -> float:
    """영어 비율 계산"""
    if not text:
        return 0.0
    english_chars = len(re.findall(r'[A-Za-z]', text))
    total_chars = len(re.sub(r'\s', '', text))
    return english_chars / total_chars if total_chars > 0 else 0.0


def is_noise_pattern(text: str) -> bool:
    """노이즈 패턴 체크"""
    for pattern in NOISE_PATTERNS:
        if re.match(pattern, text.strip()):
            return True
    return False


def has_stt_hallucination(text: str) -> bool:
    """STT 환각 키워드 포함 여부"""
    for keyword in STT_HALLUCINATION_KEYWORDS:
        if keyword.lower() in text.lower():
            return True
    return False


def reduce_repetition(text: str, max_repeat: int = MAX_REPEAT_COUNT) -> str:
    """연속 반복 표현 축소"""
    # 단어 단위로 분리
    words = text.split()
    if len(words) < 2:
        return text
    
    result = []
    prev_word = None
    repeat_count = 0
    
    for word in words:
        if word == prev_word:
            repeat_count += 1
            if repeat_count < max_repeat:
                result.append(word)
        else:
            result.append(word)
            prev_word = word
            repeat_count = 0
    
    return ' '.join(result)


def clean_sentence(text: str) -> str:
    """문장 단위 클리닝"""
    if not text or not isinstance(text, str):
        return ""
    
    # 앞뒤 공백 제거
    text = text.strip()
    
    # [유저] 태그 주변 공백 정리
    text = re.sub(r'\s*\[유저\]\s*', ' [유저] ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 반복 표현 축소
    text = reduce_repetition(text)
    
    return text


def should_keep(text: str) -> tuple:
    """
    해당 문장을 유지할지 결정
    Returns: (유지 여부, 제거 사유)
    """
    if not text or not isinstance(text, str):
        return False, "빈 문장"
    
    text = text.strip()
    
    # 1. 최소 길이 체크
    if len(text) < MIN_CHAR_LENGTH:
        return False, f"너무 짧음 ({len(text)}자)"
    
    # 2. 노이즈 패턴 체크
    if is_noise_pattern(text):
        return False, "노이즈 패턴"
    
    # 3. 한글 비율 체크
    korean_ratio = get_korean_ratio(text)
    if korean_ratio < MIN_KOREAN_RATIO:
        return False, f"한글 비율 낮음 ({korean_ratio:.1%})"
    
    # 4. 영어 비율 체크
    english_ratio = get_english_ratio(text)
    if english_ratio > MAX_ENGLISH_RATIO:
        return False, f"영어 비율 높음 ({english_ratio:.1%})"
    
    # 5. STT 환각 체크
    if has_stt_hallucination(text):
        return False, "STT 환각 키워드"
    
    return True, ""


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
    print("🧹 STT 데이터셋 고급 클리닝 시작")
    print("=" * 60)
    
    # 입력 파일 확인
    if not os.path.exists(INPUT_PATH):
        print(f"❌ 입력 파일 없음: {INPUT_PATH}")
        return
    
    # 출력 디렉토리 생성
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 데이터 로드
    print(f"\n📂 입력: {INPUT_PATH}")
    data = load_tsv(INPUT_PATH)
    original_count = len(data)
    print(f"   원본 데이터: {original_count:,}개")
    
    # 클리닝 수행
    print("\n🔄 클리닝 중...")
    
    removal_reasons = Counter()
    cleaned_data = []
    seen_sentences = set()
    
    for row in data:
        sentence = row.get('sentence', '')
        label = row.get('label', '')
        
        # 클리닝
        cleaned = clean_sentence(sentence)
        
        # 유지 여부 판단
        keep, reason = should_keep(cleaned)
        
        if not keep:
            removal_reasons[reason] += 1
            continue
        
        # 중복 체크
        if cleaned in seen_sentences:
            removal_reasons['중복 문장'] += 1
            continue
        
        seen_sentences.add(cleaned)
        cleaned_data.append({
            'sentence': cleaned,
            'label': label if label else ''
        })
    
    # 결과 저장
    save_tsv(cleaned_data, OUTPUT_PATH)
    
    # 통계 출력
    final_count = len(cleaned_data)
    removed_count = original_count - final_count
    
    print("\n" + "=" * 60)
    print("📊 클리닝 결과")
    print("=" * 60)
    print(f"   원본 데이터:     {original_count:>8,}개")
    print(f"   제거된 데이터:   {removed_count:>8,}개 ({removed_count/original_count*100:.1f}%)")
    print(f"   최종 데이터:     {final_count:>8,}개 ({final_count/original_count*100:.1f}%)")
    
    print("\n📋 제거 사유별 통계:")
    for reason, count in removal_reasons.most_common():
        print(f"   - {reason}: {count:,}개")
    
    print(f"\n✅ 저장 완료: {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
