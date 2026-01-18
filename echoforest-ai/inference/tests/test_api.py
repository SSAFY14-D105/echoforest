import requests
import json

def test_api():
    tests = [
        ("씨발", "1단계 (critical) 예상"),
        ("죽어버려", "1단계 (critical) 예상"),
        ("짜증나", "2단계 (severe) 예상"),
        ("닥쳐", "2단계 (severe) 예상"),
        ("멍청이", "3단계 (mild) 예상"),
        ("미치겠다", "3단계 (mild) 예상"),
        ("안녕하세요", "0단계 (clean) 예상"),
        ("잘했어", "0단계 (clean) 예상"),
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
