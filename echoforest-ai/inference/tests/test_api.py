import requests
import json

def test_api():
    tests = [
        ("씨발", "critical - 심한 욕설"),
        ("개빡친다", "mild/severe - 신조어"),
        ("개빡치네", "mild/severe - 신조어"),
        ("화가난다", "mild/severe - 부정 표현"),
        ("화가나네", "mild/severe - 부정 표현"),
        ("짜증난다", "mild/severe - 부정 표현"),
        ("짜증나네", "mild/severe - 부정 표현"),
        ("졸라 짜증나", "mild/severe - 부정 표현"),
        ("킹받네", "mild/severe - 신조어"),
        ("안녕하세요", "clean - 정상 발화"),
    ]
    
    print("=" * 60)
    print("EchoForest AI Server - 부정어 분석 테스트")
    print("=" * 60)
    
    for text, expected in tests:
        try:
            r = requests.post('http://localhost:8000/api/v1/analyze', json={'text': text})
            data = r.json()
            print(f"\n📝 입력: \"{text}\"")
            print(f"   예상: {expected}")
            print(f"   결과: severity={data['severity']}, label={data['severity_label']}")
            print(f"   confidence: {data['confidence']:.1%}")
            
            # 검증
            if data['severity'] == 0:
                status = "✅ PASS" if "clean" in expected else "❌ FAIL"
            elif data['severity'] == 1:
                status = "✅ PASS" if "critical" in expected else "❌ FAIL"
            elif data['severity'] == 2:
                status = "✅ PASS" if "severe" in expected else "❌ FAIL"
            elif data['severity'] == 3:
                status = "✅ PASS" if "mild" in expected else "❌ FAIL"
            print(f"   상태: {status}")
        except Exception as e:
            print(f"\n❌ 오류: {text} - {e}")
    
    print("\n" + "=" * 60)
    print("테스트 완료!")

if __name__ == "__main__":
    test_api()
