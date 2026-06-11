"""
03_text_clean.py
================
기본 텍스트 정제 및 병합

[목적]
- 여러 STT 결과 파일(audio_N.tsv)을 하나로 병합
- 숫자/기호/자모음·외국어 노이즈 제거
- 전역 중복 문장 제거 (여러 영상에 같은 문장이 있으면 source를 ;로 합침)

[입력] ../02_stt/audio_*.tsv
[출력] 이 폴더(03_clean)에 merged_stt_cleaned.tsv  (sentence \t source \t label)
       - source = 출신 영상 id(파일명 stem, 예: audio_1) → 영상별 추출/필터용.
         같은 문장이 여러 영상에 있으면 "audio_3;audio_7" 처럼 ;로 합쳐 보존.
"""

import os
import glob
import re

# ==========================================
# 설정
# ==========================================
HERE = os.path.dirname(os.path.abspath(__file__))      # 03_clean/
ROOT = os.path.dirname(HERE)                            # 0_Data_Collection
INPUT_DIR = os.path.join(ROOT, "02_stt")               # 02 단계의 STT tsv
OUTPUT_FILE = os.path.join(HERE, "merged_stt_cleaned.tsv")

def clean_text(text):
    """
    사용자 요청 전처리 규칙 적용:
    1. 숫자 제거
    2. 기호(! ?, . 등) 제거
    3. 자음/모음(ㅋㅋ) 제거
    4. 앞뒤 공백 제거
    """
    if not text: return ""
    text = str(text)
    
    # 0. Whisper 환각/반복 패턴 제거 (X2, X3 등)
    text = re.sub(r'[Xx]\d+', '', text)
    
    # (Web Speech 시절의 X-마스킹 욕설 복구 규칙 제거 — faster-whisper는 욕설을 원문 그대로 출력해 불필요)

    # 1. 숫자 제거 (사용자 요청으로 취소 - "1번님" 등의 표현 보존)
    # text = re.sub(r'\d+', '', text)
    
    # 1. 기호 및 특수문자 제거
    # STT 학습에 불필요한 문장부호 제거 (! ? . , 등)
    # [중요] 대괄호 [ ] 는 유저 태그용이므로 절대 삭제하지 않음!
    text = re.sub(r'[!?,.\~"\';:\(\)\{\}\<\>\-\_\=\+\*\/]', '', text)
    
    # 2. 자음/모음만 있는 것 제거 (ㄱ-ㅎ, ㅏ-ㅣ)
    text = re.sub(r'[ㄱ-ㅎㅏ-ㅣ]+', '', text)
    
    # 3. 외국어/노이즈 제거 (화이트리스트 방식)
    # 남길 문자: 한글(가-힣), 영어(a-zA-Z), 숫자(0-9), 공백(\s), 대괄호([])
    # 그 외(러시아어, 한자, 이모지 등)는 삭제
    text = re.sub(r'[^가-힣a-zA-Z0-9\s\[\]]', '', text)
    
    # 4. 다중 공백 하나로 줄이기
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def main():
    print(f"Loading TSV files from {INPUT_DIR}...")
    
    tsv_files = sorted(glob.glob(os.path.join(INPUT_DIR, "audio_*.tsv")))
    sent_to_sources = {}   # 정제된 문장 -> 출신 영상 id 집합 (전역 중복제거 + source 보존)
    raw_count = 0
    processed_files = 0

    for fpath in tsv_files:
        # 파일명 stem이 곧 출신 영상 id (예: audio_1.tsv -> "audio_1")
        source = os.path.splitext(os.path.basename(fpath))[0]
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # 파일별 처리
            for line in lines:
                # TSV 형식일 수 있으므로 탭으로 분리 후 첫 번째 컬럼 사용
                # 혹은 그냥 텍스트 파일일 경우 전체 사용
                parts = line.strip().split('\t')
                raw_text = parts[0] if parts else ""

                # 헤더 라인("문장", "TSV" 등 포함) 건너뛰기
                if "문장" in raw_text or "clean" in raw_text:
                    continue

                cleaned = clean_text(raw_text)

                # 너무 짧은 문장(1글자 이하)은 의미 없으므로 제외 (선택 사항)
                if len(cleaned) < 2:
                    continue

                raw_count += 1
                sent_to_sources.setdefault(cleaned, set()).add(source)

            processed_files += 1

        except Exception as e:
            print(f"Error reading {os.path.basename(fpath)}: {e}")

    print(f"Total raw sentences processed: {raw_count}")

    # 5. 전역 중복 제거 (문장 단위) — source는 집합으로 합쳐 보존
    unique_sentences = sorted(sent_to_sources.keys())

    print(f"Unique sentences after deduplication: {len(unique_sentences)}")

    # 저장 (TSV 포맷: sentence \t source \t label)
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig') as f:
        # 헤더 작성
        f.write("sentence\tsource\tlabel\n")

        for sent in unique_sentences:
            source_str = ";".join(sorted(sent_to_sources[sent]))
            # 라벨 자리는 비워둠 (나중에 채우기 위해)
            f.write(f"{sent}\t{source_str}\t\n")

    print("=" * 40)
    print(f"Processing Complete!")
    print(f" - Scanned Files: {processed_files}")
    print(f" - Result File: {OUTPUT_FILE}")
    print("=" * 40)

if __name__ == "__main__":
    main()
