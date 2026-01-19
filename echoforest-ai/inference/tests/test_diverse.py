"""
다양한 부정어 데이터 테스트 스크립트
"""
import requests
import json

API_URL = "http://localhost:8000/api/v1/analyze"

# 테스트 데이터셋 (카테고리별로 분류)
TEST_DATA = {
    "정상 발화": [
        "안녕하세요",
        "잘했어",
        "수고했어",
        "이거 좋다",
        "오늘 날씨 좋네",
        "밥 먹었어?",
        "좀 어려운데",
        "다시 해보자",
        "실수했다",
        "아쉽네",
    ],
    
    "강한 욕설": [
        "씨발",
        "개새끼",
        "병신",
        "좆같은",
        "존나",
        "미친놈",
        "꺼져",
        "닥쳐",
        "죽어버려",
        "지랄",
    ],
    
    "경계선 표현 (불만/짜증)": [
        "짜증나",
        "열받네",
        "빡치네",
        "화나",
        "답답해",
        "미치겠다",
        "개빡치네",
        "킹받네",
        "진짜 싫다",
        "아 몰라",
    ],
    
    "대인 비하": [
        "멍청이",
        "바보",
        "못생겼어",
        "쟤 진짜 못해",
        "넌 왜 그래",
        "너 때문이야",
        "포기해라",
        "그만둬",
        "안 도와줘",
        "꼴보기 싫어",
    ],
    
    "신조어/인터넷 용어": [
        "ㅅㅂ",
        "ㄱㅅㄲ",
        "ㅄ",
        "ㅈ같네",
        "ㅗㅗ",
        "ㄲㅈ",
        "에바",
        "오바",
        "노답",
        "트롤",
    ],
    
    "우회 표현": [
        "시발",
        "씨빨",
        "씨발아",
        "개세끼",
        "병쉰",
        "븅신",
        "니미",
        "느금마",
        "좃같다",
        "시벌",
    ],
    
    "게임 관련 부정어": [
        "트롤하지마",
        "노답팀",
        "피드 그만해",
        "왜 혼자해",
        "라인 안옴",
        "팀운 망했네",
        "탱 안함?",
        "힐 안해?",
        "이거 지는 겜이야",
        "항복해",
    ],
}

def test_model():
    print("=" * 70)
    print("🧪 EchoForest AI 모델 테스트")
    print("=" * 70)
    
    results = {
        "total": 0,
        "negative": 0,
        "clean": 0,
        "by_severity": {0: 0, 1: 0, 2: 0, 3: 0},
        "by_category": {}
    }
    
    for category, texts in TEST_DATA.items():
        print(f"\n📁 [{category}]")
        print("-" * 50)
        
        category_results = {"negative": 0, "clean": 0}
        
        for text in texts:
            try:
                response = requests.post(API_URL, json={"text": text}, timeout=10)
                data = response.json()
                
                is_neg = data.get("is_negative", False)
                severity = data.get("severity", 0)
                confidence = data.get("confidence", 0)
                label = data.get("label", "unknown")
                
                # 결과 표시
                status = "🔴" if severity == 1 else "🟠" if severity == 2 else "🟡" if severity == 3 else "✅"
                
                print(f"  {status} \"{text}\" → {label} ({confidence*100:.1f}%) [Level {severity}]")
                
                # 통계 업데이트
                results["total"] += 1
                results["by_severity"][severity] += 1
                
                if is_neg:
                    results["negative"] += 1
                    category_results["negative"] += 1
                else:
                    results["clean"] += 1
                    category_results["clean"] += 1
                    
            except Exception as e:
                print(f"  ❌ \"{text}\" → 오류: {e}")
        
        results["by_category"][category] = category_results
    
    # 총 결과 출력
    print("\n" + "=" * 70)
    print("📊 테스트 결과 요약")
    print("=" * 70)
    print(f"총 테스트: {results['total']}개")
    print(f"부정 판정: {results['negative']}개 ({results['negative']/results['total']*100:.1f}%)")
    print(f"정상 판정: {results['clean']}개 ({results['clean']/results['total']*100:.1f}%)")
    print()
    print("심각도별 분포:")
    print(f"  Level 0 (clean):    {results['by_severity'][0]}개")
    print(f"  Level 1 (critical): {results['by_severity'][1]}개")
    print(f"  Level 2 (severe):   {results['by_severity'][2]}개")
    print(f"  Level 3 (mild):     {results['by_severity'][3]}개")
    print()
    print("카테고리별 결과:")
    for cat, res in results["by_category"].items():
        total = res["negative"] + res["clean"]
        neg_rate = res["negative"] / total * 100 if total > 0 else 0
        print(f"  {cat}: {res['negative']}/{total} 부정 ({neg_rate:.0f}%)")

if __name__ == "__main__":
    test_model()
