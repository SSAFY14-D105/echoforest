# -*- coding: utf-8 -*-
"""
AI 서버 부정어 탐지 테스트
"""
import requests
import io
import sys

# Windows 콘솔 UTF-8 출력 설정
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://localhost:8000/api/v1/analyze"

def test(text):
    try:
        res = requests.post(BASE_URL, json={"text": text}, timeout=10)
        d = res.json()
        neg = "X" if d['is_negative'] else "O"
        sev = d['severity']
        lab = d['label']
        print(f"[{neg}] sev:{sev} | {text:<25} -> {lab}")
    except Exception as e:
        print(f"[!] Error: {text} - {e}")

if __name__ == "__main__":
    print("=" * 55)
    print("AI Server Test")
    print("=" * 55)
    
    print("\n[Positive/Normal Words]")
    print("-" * 55)
    for w in ["hello", "good", "love", "thanks", "nice"]:
        test(w)
    
    print("\n[Mild Negative]")
    print("-" * 55)
    for w in ["babo", "stupid", "annoying"]:
        test(w)
    
    print("\n[Strong Profanity - Korean]")
    print("-" * 55)
    for w in ["ssibal", "gaesaekki", "byungsin", "jiral"]:
        test(w)
    
    print("\n[Korean Tests - Direct]")
    print("-" * 55)
    korean_words = [
        "안녕",
        "좋아",
        "사랑해",
        "바보",
        "씨발",
        "개새끼",
        "병신",
    ]
    for w in korean_words:
        test(w)
    
    print("\n" + "=" * 55)
    print("Test Complete")
