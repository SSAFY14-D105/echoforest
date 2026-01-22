# -*- coding: utf-8 -*-
"""
Threshold Optimization Analysis Script
======================================
목적: 다양한 threshold 값에서 욕설 탐지 성능을 측정하여 최적값을 찾습니다.
결과: 자소서/포트폴리오용 상세 분석 리포트 생성

실행: python tests/threshold_analysis.py
"""

import requests
import json
import sys
from datetime import datetime

# 인코딩 설정
try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

BASE_URL = "http://localhost:8000/api/v1/analyze"

# =====================================================
# 테스트 데이터셋 정의
# =====================================================

# 정상 발화 (label: 0 = clean)
CLEAN_TEXTS = [
    # 인사/감사
    "안녕하세요", "반갑습니다", "감사합니다", "고마워", "수고하셨습니다",
    # 긍정 표현
    "좋아", "사랑해", "최고야", "잘했어", "대단해",
    "멋있다", "예쁘다", "행복해", "기분 좋아", "화이팅",
    # 게임 관련 일상 대화
    "이쪽으로 와", "저기 가자", "조심해", "뛰어", "점프해",
    "왼쪽", "오른쪽", "위로", "아래로", "기다려",
    "같이 가자", "도와줘", "고마워 친구", "잘한다", "오케이",
    # 감탄사/추임새
    "와", "오", "우와", "헐", "대박",
    "ㅋㅋㅋ", "ㅎㅎㅎ", "ㅠㅠ", "히히", "하하",
    # 중립적 표현
    "그래", "응", "알겠어", "뭐해", "뭐야",
    "진짜", "정말", "어디야", "누구야", "언제",
]

# 경미한 부정어 (label: 1 = negative, 하지만 약함)
MILD_NEGATIVE_TEXTS = [
    "바보", "멍청이", "짜증나", "싫어", "재수없어",
    "못생겼어", "별로야", "지루해", "심심해", "귀찮아",
    "짜증", "화나", "열받아", "안돼", "싫다",
]

# 강한 욕설 (label: 1 = negative, 강함)
STRONG_NEGATIVE_TEXTS = [
    # 일반 욕설
    "씨발", "병신", "개새끼", "지랄", "미친놈",
    "닥쳐", "꺼져", "죽어", "뒤져", "좆같네",
    # 변형/강화
    "씨발놈아", "이 병신아", "개같은 새끼", 
    "진짜 미쳤어", "존나", "개빡쳐",
]

# 혐오 발언 (특정 집단 대상)
HATE_SPEECH_TEXTS = [
    # 성별 혐오
    "한남충", "김치녀", "맘충",
    # 연령 혐오  
    "틀딱", "급식충", "꼰대",
    # 지역/인종 혐오
    "조선족", "쪽바리", "짱깨",
]

# =====================================================
# 분석 함수
# =====================================================

def get_prediction(text):
    """API 호출하여 예측 결과 반환"""
    try:
        response = requests.post(BASE_URL, json={"text": text}, timeout=10)
        return response.json()
    except Exception as e:
        print(f"Error: {text} - {e}")
        return None

def analyze_threshold(threshold, predictions, labels):
    """
    특정 threshold에서 성능 지표 계산
    
    Args:
        threshold: 판정 기준값 (0.0 ~ 1.0)
        predictions: [(text, max_hate_score, is_negative, label), ...]
        labels: 실제 정답 (0=clean, 1=negative)
    
    Returns:
        dict with TP, FP, TN, FN, Precision, Recall, F1, Accuracy
    """
    TP = FP = TN = FN = 0
    
    for (text, max_score, _, _), actual_label in zip(predictions, labels):
        predicted_negative = max_score >= threshold
        
        if predicted_negative and actual_label == 1:
            TP += 1  # True Positive: 욕설을 욕설로 판정
        elif predicted_negative and actual_label == 0:
            FP += 1  # False Positive: 정상을 욕설로 오판 (과탐지)
        elif not predicted_negative and actual_label == 0:
            TN += 1  # True Negative: 정상을 정상으로 판정
        elif not predicted_negative and actual_label == 1:
            FN += 1  # False Negative: 욕설을 정상으로 오판 (미탐지)
    
    # 성능 지표 계산
    total = TP + FP + TN + FN
    accuracy = (TP + TN) / total if total > 0 else 0
    precision = TP / (TP + FP) if (TP + FP) > 0 else 0
    recall = TP / (TP + FN) if (TP + FN) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        'threshold': threshold,
        'TP': TP, 'FP': FP, 'TN': TN, 'FN': FN,
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
    }

def main():
    print("=" * 70)
    print("Threshold Optimization Analysis")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # 1. 데이터셋 준비
    print("\n[1/4] Preparing Dataset...")
    all_texts = []
    all_labels = []
    
    # Clean texts (label = 0)
    for text in CLEAN_TEXTS:
        all_texts.append(text)
        all_labels.append(0)
    
    # Mild negative (label = 1, but we'll see how model handles)
    for text in MILD_NEGATIVE_TEXTS:
        all_texts.append(text)
        all_labels.append(1)
    
    # Strong negative (label = 1)
    for text in STRONG_NEGATIVE_TEXTS:
        all_texts.append(text)
        all_labels.append(1)
    
    # Hate speech (label = 1)
    for text in HATE_SPEECH_TEXTS:
        all_texts.append(text)
        all_labels.append(1)
    
    print(f"   - Clean samples: {len(CLEAN_TEXTS)}")
    print(f"   - Mild negative samples: {len(MILD_NEGATIVE_TEXTS)}")
    print(f"   - Strong negative samples: {len(STRONG_NEGATIVE_TEXTS)}")
    print(f"   - Hate speech samples: {len(HATE_SPEECH_TEXTS)}")
    print(f"   - Total samples: {len(all_texts)}")
    
    # 2. API 호출하여 예측 수집
    print("\n[2/4] Collecting Predictions from API...")
    predictions = []
    
    for i, text in enumerate(all_texts):
        result = get_prediction(text)
        if result:
            # clean 점수를 제외한 혐오 카테고리 중 최대값 찾기
            all_scores = result.get('all_scores', {})
            hate_scores = {k: v for k, v in all_scores.items() if k != 'clean'}
            max_hate_score = max(hate_scores.values()) if hate_scores else 0
            
            predictions.append((
                text,
                max_hate_score,
                result.get('is_negative'),
                result.get('label')
            ))
            
            if (i + 1) % 20 == 0:
                print(f"   Progress: {i + 1}/{len(all_texts)}")
    
    print(f"   Complete: {len(predictions)} predictions collected")
    
    # 3. 다양한 threshold에서 성능 분석
    print("\n[3/4] Analyzing Performance at Different Thresholds...")
    
    thresholds = [0.05, 0.10, 0.15, 0.174, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70, 0.80]
    results = []
    
    for threshold in thresholds:
        result = analyze_threshold(threshold, predictions, all_labels)
        results.append(result)
    
    # 4. 결과 출력
    print("\n[4/4] Results Summary")
    print("=" * 70)
    print(f"{'Threshold':>10} | {'Accuracy':>8} | {'Precision':>9} | {'Recall':>8} | {'F1 Score':>8} | {'TP':>4} | {'FP':>4} | {'TN':>4} | {'FN':>4}")
    print("-" * 70)
    
    best_f1 = 0
    best_threshold = 0
    
    for r in results:
        line = f"{r['threshold']:>10.3f} | {r['accuracy']:>8.4f} | {r['precision']:>9.4f} | {r['recall']:>8.4f} | {r['f1_score']:>8.4f} | {r['TP']:>4} | {r['FP']:>4} | {r['TN']:>4} | {r['FN']:>4}"
        
        # 최적 F1 Score 표시
        if r['f1_score'] > best_f1:
            best_f1 = r['f1_score']
            best_threshold = r['threshold']
        
        # 현재 사용 중인 17.4% 하이라이트
        if r['threshold'] == 0.174:
            line += " <-- CURRENT"
        
        print(line)
    
    print("-" * 70)
    print(f"\nBest F1 Score: {best_f1:.4f} at threshold {best_threshold:.3f}")
    
    # 상세 분석 결과 출력
    print("\n" + "=" * 70)
    print("DETAILED ANALYSIS REPORT")
    print("=" * 70)
    
    # 현재 threshold (17.4%) 상세 분석
    current = next(r for r in results if r['threshold'] == 0.174)
    print(f"""
[Current Threshold: 17.4% (0.174)]
- Accuracy:  {current['accuracy']:.4f} ({current['accuracy']*100:.2f}%)
- Precision: {current['precision']:.4f} ({current['precision']*100:.2f}%)
- Recall:    {current['recall']:.4f} ({current['recall']*100:.2f}%)
- F1 Score:  {current['f1_score']:.4f} ({current['f1_score']*100:.2f}%)

Confusion Matrix:
                    Predicted
                 Negative | Positive
Actual Negative |  TN={current['TN']:>3}  |  FP={current['FP']:>3}  |
Actual Positive |  FN={current['FN']:>3}  |  TP={current['TP']:>3}  |

Interpretation:
- True Positives (TP={current['TP']}): Correctly detected as negative
- False Positives (FP={current['FP']}): Clean text wrongly flagged (Over-detection)
- True Negatives (TN={current['TN']}): Correctly identified as clean
- False Negatives (FN={current['FN']}): Negative text missed (Under-detection)
""")

    # 샘플별 상세 결과 저장
    print("\n[Sample-level Results]")
    print("-" * 70)
    
    # 오분류 샘플 출력
    misclassified = []
    threshold_174 = 0.174
    
    for (text, max_score, is_neg, label), actual in zip(predictions, all_labels):
        predicted = 1 if max_score >= threshold_174 else 0
        if predicted != actual:
            misclassified.append({
                'text': text,
                'actual': 'negative' if actual == 1 else 'clean',
                'predicted': 'negative' if predicted == 1 else 'clean',
                'score': max_score,
                'label': label
            })
    
    print(f"Total Misclassified: {len(misclassified)}")
    for m in misclassified[:20]:  # 최대 20개만 출력
        print(f"  - '{m['text'][:20]}' | Actual: {m['actual']}, Predicted: {m['predicted']}, Score: {m['score']:.4f}")
    
    # JSON 리포트 저장
    report = {
        'analysis_date': datetime.now().isoformat(),
        'dataset': {
            'clean_samples': len(CLEAN_TEXTS),
            'mild_negative_samples': len(MILD_NEGATIVE_TEXTS),
            'strong_negative_samples': len(STRONG_NEGATIVE_TEXTS),
            'hate_speech_samples': len(HATE_SPEECH_TEXTS),
            'total_samples': len(all_texts)
        },
        'threshold_results': results,
        'best_threshold': best_threshold,
        'best_f1_score': best_f1,
        'current_threshold': 0.174,
        'misclassified_samples': misclassified
    }
    
    with open('tests/threshold_analysis_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\nReport saved to: tests/threshold_analysis_report.json")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return report

if __name__ == "__main__":
    main()
