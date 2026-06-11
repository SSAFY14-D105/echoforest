"""
_audit_anonymize.py — 04 익명화(닉네임 토큰 제거) 감사 (유틸리티, 파이프라인 아님)
==========================================================================
03 출력에서 04가 어느 행의 닉네임을 제거하는지(before→after)를 보여주고,
그 행들이 unSmile이 욕설로 오탐하는 hard-negative(clean 오더)임을 확인한다.
→ "행 삭제 대신 토큰만 제거"가 hard-negative를 보존함을 검증.

04 함수/상수를 그대로 import (로직 드리프트 방지).
주의: unSmile(GPU)을 쓰므로 STT 등 다른 GPU 작업과 동시 실행 금지.
"""
import os
import csv
import importlib.util
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MERGED = os.path.join(ROOT, "03_clean", "merged_stt_cleaned.tsv")

spec = importlib.util.spec_from_file_location("anon04", os.path.join(HERE, "04_text_anonymize.py"))
anon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(anon)


def load_merged(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [(r.get("sentence") or "").strip() for r in csv.DictReader(f, delimiter="\t")]


def registered_hits(kiwi, text):
    return [t.form for t in kiwi.tokenize(text)
            if t.form in anon.CUSTOM_USERS and t.form not in anon.AMBIGUOUS_NAMES]


def main():
    kiwi = anon.Kiwi()
    for w in anon.CUSTOM_USERS:
        kiwi.add_user_word(w, tag="NNP", score=10)

    sents = load_merged(MERGED)
    considered, stripped, emptied = 0, [], 0
    trig = Counter()
    for s in sents:
        cleaned = anon.clean_basic(s)
        if len(cleaned) < 2:
            continue
        considered += 1
        after, n = anon.strip_personal_references(kiwi, cleaned)
        if n > 0:
            stripped.append((cleaned, after))
            for h in registered_hits(kiwi, cleaned):
                trig[h] += 1
            if len(after) < 2:
                emptied += 1

    # unSmile: 닉네임 제거된 행이 hard-negative(오탐 clean)인지 확인
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    MODEL, THR = "smilegate-ai/kor_unsmile", 0.3
    tk = AutoTokenizer.from_pretrained(MODEL)
    md = AutoModelForSequenceClassification.from_pretrained(MODEL)
    md.eval()
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    md.to(dev)
    abuse_idx = [i for i, n in md.config.id2label.items() if n not in ("clean", "개인지칭")]

    def abuse_prob(s):
        if not s:
            return 0.0
        x = tk(s, return_tensors="pt", truncation=True, max_length=128).to(dev)
        with torch.no_grad():
            p = torch.sigmoid(md(**x).logits[0]).cpu().numpy()
        return float(max(p[i] for i in abuse_idx))

    hard_neg = []
    for before, after in stripped:
        a = abuse_prob(after)
        if a >= THR:
            hard_neg.append((round(a, 3), before, after))

    print("=" * 70)
    print(f"03 입력(2자+): {considered} / 닉네임 제거된 행: {len(stripped)} "
          f"({len(stripped)/considered*100:.1f}%)" if considered else "입력 없음")
    print(f"  - 제거 후 비어서 제외: {emptied}")
    print(f"  - 제거 후에도 abuse(>= {THR})로 보이는 hard-negative: {len(hard_neg)}")
    print(f"    ← 예전 '행 삭제' 정책이면 사라졌을 clean 오더. 이제 보존 → fine-tuning이 '오더≠욕설' 학습.")
    print("-" * 70)
    print("트리거 닉네임 분포(상위 15):")
    for name, c in trig.most_common(15):
        print(f"   {name}: {c}")
    print("-" * 70)
    print("닉네임 제거 before → after (최대 20):")
    for before, after in stripped[:20]:
        print(f"   {before}")
        print(f"     → {after}")
    print("=" * 70)


if __name__ == "__main__":
    main()
