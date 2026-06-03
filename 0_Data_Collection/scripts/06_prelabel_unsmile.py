"""
06_prelabel_unsmile.py
======================
unSmile 모델로 abuse/clean **사전라벨** → 사람 검수용 tsv 생성

[목적]
- 정제된 STT 문장(05 출력)에 공식 unSmile(smilegate-ai/kor_unsmile)을 돌려
  abuse/clean 초안을 붙인다. 사람이 검수(확정)하면 학습/평가용 정답이 된다.
- 사전라벨은 어디까지나 '초안' — 사람 검수가 ground truth라 순환(circular) 없음.
- 출력 포맷은 train_collected.tsv 와 동일한 unSmile 10라벨(문장 + 10칼럼)에
  검수 편의를 위한 보조 칼럼(사전라벨·abuse_prob·검수)을 앞에 둔다.

[왜 10라벨 포맷이되 실제론 abuse/clean 이진인가]
- 포맷은 공식 unSmile·train_collected와 동일하게 10라벨을 유지한다(모델 호환·데이터 일관성).
- 그러나 게임 맥락에서 필요한 건 "부정 발언 탐지"뿐이고, 혐오 '대상' 세분류
  (여성/남성/성소수자/인종/연령/지역/종교)는 게임 채팅에 거의 안 나온다.
- unSmile은 multi-label이라 라벨을 독립적으로 예측 → 9개 혐오/욕설 라벨 중
  최대 확률이 THRESHOLD 이상이면 `악플/욕설=1`, 아니면 `clean=1`로 이진 축약한다.
- 기획서 핵심 목표도 "악플/욕설 Recall 개선"이라, 이 이진(욕설 vs clean)이면 충분하다.

[입력] processed_data/04_anonymized_clean/final_dataset_clean.tsv
[출력] processed_data/06_prelabeled/review_candidates.tsv

[의존성] pip install transformers torch
"""

import os
import csv
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_FILE = os.path.join(BASE_DIR, "processed_data", "04_anonymized_clean", "final_dataset_clean.tsv")
OUTPUT_DIR = os.path.join(BASE_DIR, "processed_data", "06_prelabeled")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "review_candidates.tsv")

MODEL_ID = "smilegate-ai/kor_unsmile"
THRESHOLD = 0.3   # 혐오/욕설 라벨 중 최대 확률이 이 값 이상이면 abuse 초안 (검수로 보정)

# train_collected.tsv 와 동일한 10라벨 컬럼 순서
LABEL_COLS = ['여성/가족', '남성', '성소수자', '인종/국적', '연령', '지역', '종교', '기타 혐오', '악플/욕설', 'clean']


def load_sentences(path):
    rows = []
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for r in reader:
            s = (r.get('sentence') or r.get('문장') or '').strip()
            if s:
                rows.append(s)
    # 입력 단계에서 이미 중복 제거되지만 한 번 더 보장
    return list(dict.fromkeys(rows))


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"입력 파일 없음: {INPUT_FILE}  (먼저 03~05 실행)")
        return

    sentences = load_sentences(INPUT_FILE)
    print(f"사전라벨 대상 문장: {len(sentences)}")

    print(f"unSmile 로딩... ({MODEL_ID})")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
    model.eval()
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.to(device)
    print(f"Device: {device}")

    id2label = model.config.id2label  # unSmile 라벨 이름
    # 혐오/욕설 판단에 쓸 라벨(=clean, 개인지칭 제외)
    abuse_label_idx = [i for i, name in id2label.items() if name not in ('clean', '개인지칭')]

    results = []
    for i, sent in enumerate(sentences):
        inputs = tokenizer(sent, return_tensors='pt', truncation=True, max_length=128).to(device)
        with torch.no_grad():
            probs = torch.sigmoid(model(**inputs).logits[0]).cpu().numpy()

        abuse_prob = float(max(probs[i] for i in abuse_label_idx))
        is_abuse = abuse_prob >= THRESHOLD

        row = {c: 0 for c in LABEL_COLS}
        if is_abuse:
            row['악플/욕설'] = 1
        else:
            row['clean'] = 1

        results.append({
            '문장': sent,
            '사전라벨': 'abuse' if is_abuse else 'clean',
            'abuse_prob': round(abuse_prob, 3),
            '검수': '',  # 사람이 O(맞음)/수정 라벨 기입
            **row,
        })
        if (i + 1) % 100 == 0:
            print(f"  {i+1}/{len(sentences)}")

    # abuse 후보를 위로 정렬(검수 효율: 소수 클래스부터 확인)
    results.sort(key=lambda r: -r['abuse_prob'])

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    fieldnames = ['문장', '사전라벨', 'abuse_prob', '검수'] + LABEL_COLS
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t')
        w.writeheader()
        w.writerows(results)

    n_abuse = sum(1 for r in results if r['사전라벨'] == 'abuse')
    print("=" * 50)
    print(f"사전라벨 완료 → {OUTPUT_FILE}")
    print(f" - 총 {len(results)}문장: abuse {n_abuse} / clean {len(results)-n_abuse} (threshold={THRESHOLD})")
    print(" - '검수' 칼럼을 채워 확정 후, 문장+10라벨만 추출해 train_collected에 합치면 됨")
    print("=" * 50)


if __name__ == "__main__":
    main()
