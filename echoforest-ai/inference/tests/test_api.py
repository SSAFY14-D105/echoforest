import requests
import json

def test_api():
    tests = [
        ("씨발", "1단계 (critical) 예상"),
        ("개빡친다", "신조어 테스트"),
        ("개빡치네", "신조어 테스트"),
        ("화가난다", "어미 변형 테스트"),
        ("화가나네", "어미 변형 테스트"),
        ("짜증난다", "어미 변형 테스트"),
        ("짜증나네", "어미 변형 테스트"),
        ("졸라 짜증나", "신조어 테스트"),
        ("킹받네", "신조어 테스트"),
        ("안녕하세요", "0단계 (clean) 예상"),
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
