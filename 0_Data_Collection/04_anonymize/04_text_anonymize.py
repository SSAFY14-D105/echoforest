"""
04_text_anonymize.py
====================
개인지칭(고유명사 닉네임) **행 제거**

[목적]
- 유튜버/플레이어 닉네임 등 고유명사가 들어간 문장을 `[유저]`로 치환하지 않고
  **행 자체를 삭제**한다 (공식 unSmile의 `Drop_개인지칭` 정제 방식과 동일).
- 이유: `[유저]` 토큰은 train_collected(518)에도, 실서비스 입력에도 없어서
  학습/평가에 인공 토큰 skew를 만든다. 그래서 치환이 아니라 제거.
- Kiwi 형태소로 고유명사(NNP)·등록 닉네임을 탐지.

[입력] ../03_clean/merged_stt_cleaned.tsv
[출력] 이 폴더(04_anonymize)에 final_dataset.tsv  (개인지칭 행 제거됨)

[의존성] pip install kiwipiepy
"""

import os
import re
import unicodedata
from kiwipiepy import Kiwi

# ==========================================
# 설정
# ==========================================
HERE = os.path.dirname(os.path.abspath(__file__))      # 04_anonymize/
ROOT = os.path.dirname(HERE)                            # 0_Data_Collection
INPUT_FILE = os.path.join(ROOT, "03_clean", "merged_stt_cleaned.tsv")
OUTPUT_FILE = os.path.join(HERE, "final_dataset.tsv")

# 사용자 사전(닉네임). 호칭 없는 bare 닉네임도 잡으려면 영상마다 화자명을 여기 추가할 것.
CUSTOM_USERS = [
    # 기존 수집 화자
    '후추', '악어', '남봉', '멋사', '핑맨', '리타', '만득', '너불', '수닝', '중력', '옥냥이',
    '천수', '아우니', '영태', '영태형', '침착맨', '김도', '철면수심', '풍월량', '풍월야',
    '단군', '당군', '옹냥이', '승바', '강군',
    # PicoPark 파일럿 화자 (영상별로 갱신)
    '위이스마', '레게노', '레께노', '앨리스', '기우자', '리즈마', '연호', '윤녀', '윤호',
]

# 중의어(사람 이름일 수도, 일반 명사일 수도) — 뒤에 호칭이 올 때만 사람으로 간주
# 김치=음식, 중력=물리, 후추=향신료, 악어=동물
AMBIGUOUS_NAMES = {'중력', '후추', '악어', '김치'}
# 사람임을 암시하는 호격/호칭 (엄격 기준)
STRICT_INDICATORS = {'아', '야', '님', '형', '오빠', '누나', '언니', '씨'}


def clean_basic(text):
    """기본 전처리: 유니코드 정규화, 기호/자모 제거, 공백 정리"""
    if not text:
        return ""
    text = unicodedata.normalize('NFC', str(text))
    text = re.sub(r'[!?,.\~"\';:\[\]\(\)\{\}\<\>\-\_\=\+\*\/]', '', text)  # 기호
    text = re.sub(r'[ㄱ-ㅎㅏ-ㅣ]+', '', text)                              # 자음/모음만
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def has_personal_reference(kiwi, text):
    """문장에 개인지칭(사람을 호명/지칭)이 있으면 True → 그 행은 삭제 대상.

    Kiwi NNP는 외래어·감탄사·게임명(나이스/캐리/피코파크 등)도 오태깅하므로
    bare NNP만으로 삭제하지 않는다. 공식 '개인지칭'의 취지(사람 호명)에 맞춰
    [등록 닉네임] 또는 [고유명사 + 호칭/호격] 일 때만 개인지칭으로 본다.
    """
    try:
        tokens = kiwi.tokenize(text)
    except Exception:
        return False  # 분석 실패 시 보수적으로 유지

    for i, token in enumerate(tokens):
        next_token = tokens[i + 1] if i + 1 < len(tokens) else None
        next_is_title = bool(next_token and next_token.form in STRICT_INDICATORS)

        # (1) 중의어(중력/후추/악어): 뒤에 호칭이 있을 때만 사람 (예: "중력아 비켜" O / "중력이 세다" X)
        if token.form in AMBIGUOUS_NAMES:
            if next_is_title:
                return True
            continue

        # (2) 등록된 닉네임(중의어 제외): 항상 개인지칭
        if token.form in CUSTOM_USERS:
            return True

        # (3) 고유명사(NNP) + 호칭/호격 동반 → 사람 호명 (예: 기우자님, 민호야, 엘리스님)
        #     bare NNP는 게임명·외래어 오태깅이 많아 제외
        if token.tag == 'NNP' and len(token.form) >= 2 and next_is_title:
            return True

    return False


def main():
    print("Loading Kiwi Model...")
    try:
        kiwi = Kiwi()
        for word in CUSTOM_USERS:
            kiwi.add_user_word(word, tag='NNP', score=10)
    except Exception as e:
        print(f"Error loading Kiwi: {e}  (pip install kiwipiepy)")
        return

    print(f"Loading input file: {INPUT_FILE}...")
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading input file: {e}")
        return

    kept, dropped_samples = [], []
    dropped = 0

    for idx, line in enumerate(lines):
        if idx == 0 and ("sentence" in line or "label" in line):
            continue  # 헤더
        raw_text = line.strip().split('\t')[0] if line.strip() else ""
        if not raw_text:
            continue

        cleaned = clean_basic(raw_text)
        if len(cleaned) < 2:
            continue

        # 개인지칭 행이면 삭제
        if has_personal_reference(kiwi, cleaned):
            dropped += 1
            if len(dropped_samples) < 20:
                dropped_samples.append(cleaned)
            continue

        kept.append(cleaned)

        if idx % 1000 == 0:
            print(f"Processing... {idx}/{len(lines)}")

    unique_sentences = sorted(set(kept))

    # 저장
    print(f"Saving to {OUTPUT_FILE}...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig') as f:
        f.write("sentence\tlabel\n")
        for sent in unique_sentences:
            f.write(f"{sent}\t\n")

    total_in = dropped + len(kept)
    print("=" * 50)
    print("개인지칭 행 제거 결과")
    print(f" - 입력 문장:        {total_in}")
    print(f" - 개인지칭 행 삭제:  {dropped} ({dropped/total_in*100:.1f}%)" if total_in else " - 입력 없음")
    print(f" - 유지(중복제거 전): {len(kept)}")
    print(f" - 최종(중복제거 후): {len(unique_sentences)}")
    print("-" * 50)
    print("삭제된 문장 샘플(최대 20):")
    for s in dropped_samples:
        print(f"   ✗ {s}")
    print("=" * 50)


if __name__ == "__main__":
    main()
