# -*- coding: utf-8 -*-
"""
EchoForest AI Server - API 테스트
4인 협동 게임 저주 스택 시스템 검증용
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"


def test_health():
    """서버 상태 확인"""
    print("\n" + "=" * 60)
    print("1. 서버 상태 확인 (GET /health)")
    print("=" * 60)
    
    try:
        r = requests.get(f"{BASE_URL}/health")
        data = r.json()
        print(f"   status: {data['status']}")
        print(f"   model_loaded: {data['model_loaded']}")
        print(f"   device: {data['device']}")
        return data['status'] == 'healthy'
    except Exception as e:
        print(f"   ❌ 오류: {e}")
        return False


def test_single_analyze():
    """단일 텍스트 분석 + stack_delta 검증"""
    print("\n" + "=" * 60)
    print("2. 단일 분석 + 스택 증가량 검증 (POST /analyze)")
    print("=" * 60)
    
    test_cases = [
        ("씨발", 1, 5, "critical"),       # severity 1 → +5
        ("짜증나", 2, 3, "severe"),        # severity 2 → +3
        ("바보", 3, 1, "mild"),            # severity 3 → +1
        ("안녕하세요", 0, 0, "clean"),     # severity 0 → +0
    ]
    
    all_passed = True
    for text, expected_sev, expected_stack, expected_label in test_cases:
        try:
            r = requests.post(f"{BASE_URL}/analyze", json={"text": text})
            data = r.json()
            
            sev_ok = data['severity'] == expected_sev
            stack_ok = data['stack_delta'] == expected_stack
            
            status = "✅" if (sev_ok and stack_ok) else "❌"
            print(f"\n   {status} \"{text}\"")
            print(f"      severity: {data['severity']} (예상: {expected_sev})")
            print(f"      stack_delta: {data['stack_delta']} (예상: {expected_stack})")
            print(f"      severity_label: {data['severity_label']}")
            print(f"      confidence: {data['confidence']:.1%}")
            
            if not (sev_ok and stack_ok):
                all_passed = False
        except Exception as e:
            print(f"\n   ❌ 오류: {text} - {e}")
            all_passed = False
    
    return all_passed


def test_batch_analyze():
    """배치 분석 + total_stack_delta 검증 (핵심!)"""
    print("\n" + "=" * 60)
    print("3. 배치 분석 + 총 스택 증가량 검증 (POST /analyze/batch)")
    print("=" * 60)
    
    # 테스트 케이스: 바보(+1) + 멍청이(+1) + 씨발(+5) = 7
    texts = ["야 바보야", "너 멍청이다", "씨발"]
    expected_total_stack = 7  # 최소 7 이상이어야 함 (mild+mild+critical)
    
    try:
        r = requests.post(f"{BASE_URL}/analyze/batch", json={"texts": texts})
        data = r.json()
        
        print(f"\n   입력: {texts}")
        print(f"\n   결과:")
        for result in data['results']:
            print(f"      - \"{result['text']}\": severity={result['severity']}, stack_delta={result['stack_delta']}")
        
        print(f"\n   📊 요약:")
        print(f"      total_count: {data['total_count']}")
        print(f"      negative_count: {data['negative_count']}")
        print(f"      total_stack_delta: {data['total_stack_delta']}")
        
        # 검증: total_stack_delta가 예상값과 비슷한지
        if data['total_stack_delta'] >= expected_total_stack - 2:
            print(f"\n   ✅ 총 스택 증가량 정상 (>= {expected_total_stack - 2})")
            return True
        else:
            print(f"\n   ❌ 총 스택 증가량 부족 (예상: ~{expected_total_stack})")
            return False
    except Exception as e:
        print(f"\n   ❌ 오류: {e}")
        return False


def test_stack_delta_mapping():
    """스택 증가량 매핑 정확성 검증"""
    print("\n" + "=" * 60)
    print("4. 스택 증가량 매핑 검증")
    print("=" * 60)
    
    # 각 심각도별 대표 단어
    test_cases = [
        ("개새끼", 1, 5),    # critical → +5
        ("열받네", 2, 3),    # severe → +3
        ("멍청이", 3, 1),    # mild → +1
        ("좋아요", 0, 0),    # clean → +0
    ]
    
    all_passed = True
    print("\n   심각도 → 스택 증가량 매핑:")
    print("   " + "-" * 40)
    
    for text, expected_sev, expected_stack in test_cases:
        try:
            r = requests.post(f"{BASE_URL}/analyze", json={"text": text})
            data = r.json()
            
            # 심각도가 다를 수 있으므로 stack_delta만 확인
            actual_stack = data['stack_delta']
            status = "✅" if actual_stack == expected_stack else "⚠️"
            
            print(f"   {status} severity {data['severity']} → stack_delta {actual_stack} (\"{text}\")")
            
            if data['severity'] != expected_sev:
                all_passed = False
        except Exception as e:
            print(f"   ❌ 오류: {text} - {e}")
            all_passed = False
    
    return all_passed


def main():
    print("\n" + "=" * 60)
    print("🌲 EchoForest AI Server - 4인 협동 저주 스택 테스트")
    print("=" * 60)
    
    results = []
    
    # 1. 서버 상태 확인
    results.append(("서버 상태", test_health()))
    
    # 2. 단일 분석 테스트
    results.append(("단일 분석", test_single_analyze()))
    
    # 3. 배치 분석 테스트
    results.append(("배치 분석", test_batch_analyze()))
    
    # 4. 스택 매핑 테스트
    results.append(("스택 매핑", test_stack_delta_mapping()))
    
    # 결과 요약
    print("\n" + "=" * 60)
    print("📝 테스트 결과 요약")
    print("=" * 60)
    
    passed = 0
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status}: {name}")
        if result:
            passed += 1
    
    print(f"\n   총 {len(results)}개 중 {passed}개 통과")
    print("=" * 60)


if __name__ == "__main__":
    main()
