"""
04_text_anonymize.py
====================
개인지칭(닉네임) **토큰만 제거** (행은 유지)

[목적]
- 유튜버/플레이어 닉네임 등 개인지칭을 `[유저]`로 치환하지도, 행을 통째로 삭제하지도 않고
  **그 토큰(이름 + 동반 호칭)만 문장에서 제거**한다.
- 왜 '행 삭제'가 아니라 '토큰 제거'인가:
  닉네임이 든 문장은 대개 "기우자 대가리로 올라가" 같은 **게임 오더**인데, 이는 unSmile이
  욕설로 오탐하는 **hard-negative(욕설처럼 보이는 clean)** 다. 행을 지우면 모델이 "오더≠욕설"을
  배울 가장 중요한 예시를 잃는다(이 프로젝트 fine-tuning의 핵심). 그래서 이름만 빼고 문장은 살린다.
  → "기우자 대가리로 올라가" → "대가리로 올라가" (privacy 해결 + `[유저]` 토큰도 안 씀 + hard-negative 보존)
- Kiwi 형태소로 [등록 닉네임] / [고유명사(NNP)+호칭] / [중의어+호칭]을 탐지해 그 토큰만 제거.

[입력] ../03_clean/merged_stt_cleaned.tsv  (sentence \t source \t label)
[출력] 이 폴더(04_anonymize)에 final_dataset.tsv  (sentence \t source \t label, 닉네임 토큰만 제거)
       - source(출신 영상 id) 보존; 중복 병합 시 ;로 합침. 닉네임만 있던 행은 비어서 제외.

[의존성] pip install kiwipiepy
"""

import os
import re
import csv
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


def reference_spans(kiwi, text):
    """개인지칭(이름 + 동반 호칭) 토큰의 (start, end) 문자 스팬 목록.

    Kiwi NNP는 외래어·감탄사·게임명(나이스/캐리/피코파크 등)도 오태깅하므로
    bare NNP만으로 잡지 않는다. 사람 호명의 취지에 맞춰
    [등록 닉네임] 또는 [고유명사/중의어 + 호칭/호격] 일 때만 개인지칭으로 본다.
    """
    try:
        tokens = kiwi.tokenize(text)
    except Exception:
        return []  # 분석 실패 시 보수적으로 아무것도 제거 안 함

    spans = []
    for i, token in enumerate(tokens):
        next_token = tokens[i + 1] if i + 1 < len(tokens) else None
        next_is_title = bool(next_token and next_token.form in STRICT_INDICATORS)

        # (1) 중의어(중력/후추/악어): 뒤에 호칭 있을 때만 사람
        # (2) 등록 닉네임(중의어 제외): 항상
        # (3) 고유명사(NNP, 2자+) + 호칭/호격: 사람 호명 (bare NNP는 게임명·외래어 오태깅 많아 제외)
        if token.form in AMBIGUOUS_NAMES:
            is_ref = next_is_title
        elif token.form in CUSTOM_USERS:
            is_ref = True
        elif token.tag == 'NNP' and len(token.form) >= 2 and next_is_title:
            is_ref = True
        else:
            is_ref = False

        if is_ref:
            spans.append((token.start, token.start + token.len))
            # 이름 뒤에 붙은 호칭(님/야/형…)·조사(이/은/을/요…)까지 함께 제거 — 댕글링 방지
            j = i + 1
            while j < len(tokens):
                t = tokens[j]
                if t.form in STRICT_INDICATORS or t.tag.startswith('J'):
                    spans.append((t.start, t.start + t.len))
                    j += 1
                else:
                    break

    return spans


def has_personal_reference(kiwi, text):
    """개인지칭 포함 여부 (감사/호환용)."""
    return bool(reference_spans(kiwi, text))


def strip_personal_references(kiwi, text):
    """개인지칭(이름+호칭) 토큰만 제거하고 문장은 유지. (stripped_text, 제거_토큰수) 반환.

    행을 삭제하지 않는 이유는 모듈 docstring 참고(hard-negative 오더 보존).
    """
    spans = sorted(set(reference_spans(kiwi, text)), reverse=True)
    if not spans:
        return text, 0
    chars = list(text)
    for s, e in spans:
        del chars[s:e]
    stripped = re.sub(r'\s+', ' ', ''.join(chars)).strip()
    return stripped, len(spans)


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
        with open(INPUT_FILE, 'r', encoding='utf-8-sig', newline='') as f:
            rows = list(csv.DictReader(f, delimiter='\t'))
    except Exception as e:
        print(f"Error reading input file: {e}")
        return

    sent_to_sources = {}   # 정제 문장 -> 출신 영상 id 집합
    stripped_samples = []
    stripped_rows = 0      # 닉네임이 제거된 행 수
    emptied = 0            # 닉네임만 있어 비워져 제외된 행
    kept_rows = 0

    for i, row in enumerate(rows):
        raw_text = (row.get('sentence') or '').strip()
        source = (row.get('source') or '').strip()
        if not raw_text:
            continue

        cleaned = clean_basic(raw_text)
        if len(cleaned) < 2:
            continue

        # 개인지칭(이름+호칭) 토큰만 제거하고 문장은 유지 (hard-negative 오더 보존)
        stripped, n_removed = strip_personal_references(kiwi, cleaned)
        if n_removed > 0:
            stripped_rows += 1
            if len(stripped_samples) < 20:
                stripped_samples.append((cleaned, stripped))
            cleaned = stripped

        if len(cleaned) < 2:   # 닉네임만 있던 행 → 비면 제외
            emptied += 1
            continue

        kept_rows += 1
        srcs = sent_to_sources.setdefault(cleaned, set())
        for s in source.split(';'):
            if s:
                srcs.add(s)

        if i % 1000 == 0:
            print(f"Processing... {i}/{len(rows)}")

    unique_sentences = sorted(sent_to_sources.keys())

    # 저장
    print(f"Saving to {OUTPUT_FILE}...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig') as f:
        f.write("sentence\tsource\tlabel\n")
        for sent in unique_sentences:
            source_str = ";".join(sorted(sent_to_sources[sent]))
            f.write(f"{sent}\t{source_str}\t\n")

    total_in = kept_rows + emptied
    print("=" * 50)
    print("개인지칭(닉네임) 제거 결과 — 행 삭제 아님, 토큰만 제거")
    print(f" - 입력 문장:          {total_in}")
    print(f" - 닉네임 제거된 행:    {stripped_rows}")
    print(f" - 비어서 제외된 행:    {emptied}")
    print(f" - 유지(중복제거 전):   {kept_rows}")
    print(f" - 최종(중복제거 후):   {len(unique_sentences)}")
    print("-" * 50)
    print("닉네임 제거 샘플(원문 → 결과, 최대 20):")
    for orig, strp in stripped_samples:
        print(f"   {orig}")
        print(f"     → {strp}")
    print("=" * 50)


if __name__ == "__main__":
    main()
