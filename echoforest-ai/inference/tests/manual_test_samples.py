# -*- coding: utf-8 -*-
"""
EchoForest AI Server - 수동 샘플 테스트
개발 중 빠른 동작 확인용
"""
import requests
import sys

# Windows 콘솔 UTF-8 출력 설정
try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

BASE_URL = "http://localhost:8000/api/v1/analyze"


def test(text, expected_type=""):
    """단일 텍스트 분석"""
    try:
        res = requests.post(BASE_URL, json={"text": text}, timeout=10)
        d = res.json()
        
        neg = "🔴" if d['is_negative'] else "🟢"
        sev = d['severity']
        stack = d['stack_delta']
        label = d['severity_label']
        
        print(f"{neg} sev:{sev} +{stack}스택 | {text:<20} → {label}")
        
    except Exception as e:
        print(f"❌ Error: {text} - {e}")


def main():
    print("=" * 60)
    print("🌲 EchoForest AI Server - 수동 샘플 테스트")
    print("=" * 60)
    
    print("\n[정상 발화 - 0스택]")
    print("-" * 60)
    for w in ["안녕하세요", "좋아요", "사랑해", "고마워", "잘했어", "화이팅"]:
        test(w)
    
    print("\n[경미한 부정어 - +1스택 (mild)]")
    print("-" * 60)
    for w in ["바보", "멍청이", "미치겠다", "귀찮아"]:
        test(w)
    
    print("\n[중간 욕설 - +3스택 (severe)]")
    print("-" * 60)
    for w in ["짜증나", "열받네", "닥쳐", "꺼져"]:
        test(w)
    
    print("\n[강한 욕설 - +5스택 (critical)]")
    print("-" * 60)
    for w in ["씨발", "개새끼", "병신", "지랄"]:
        test(w)
    
    print("\n[게임 상황 문장 테스트]")
    print("-" * 60)
    for w in ["야 바보야 왜 그래", "아 짜증나 죽겠네", "씨발 뭐하냐", "잘했어 최고야"]:
        test(w)
    
    print("\n" + "=" * 60)
    print("테스트 완료!")
    print("스택 증가량: clean=0, mild=+1, severe=+3, critical=+5")
    print("=" * 60)


if __name__ == "__main__":
    main()
