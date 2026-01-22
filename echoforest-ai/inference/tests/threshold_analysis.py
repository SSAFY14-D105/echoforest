# -*- coding: utf-8 -*-
"""
Threshold Optimization Analysis Script (Updated)
==============================================
목적: 실제 음성 인식 환경과 유사한 문장들로 데이터셋을 재구성하여 threshold 최적화
변경점: 채팅 용어(ㅋㅋㅋ 등) 제거, 구어체 문장 및 게임 상황 명령어 추가
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
# 테스트 데이터셋 정의 (음성 인식 환경 반영)
# =====================================================

# 정상 발화 (label: 0 = clean)
CLEAN_TEXTS = [
    # 인사 및 기본 커뮤니케이션
    "안녕하세요 반갑습니다", "오늘 게임 같이 하실래요", "목소리가 잘 안 들려요", 
    "마이크 테스트 중입니다", "잠시만 기다려주세요", "수고하셨습니다",
    "이제 갈게요", "다음에 또 봐요", "식사 맛있게 하세요", "좋은 아침입니다",
    
    # 게임 플레이 - 협동/지시
    "저쪽으로 가야 해요", "여기 함정이 있어요 조심하세요", 
    "제가 먼저 갈게요 따라오세요", "오른쪽으로 피하세요", "점프해야 넘어갈 수 있어요",
    "빨리 오세요 시간 없어요", "거기 멈추세요 위험해요", "아이템 먼저 드세요",
    "도와주셔서 감사합니다", "같이 협력해서 깹시다",

    # 게임 플레이 - 감탄/응원 (채팅 용어 제외)
    "와 진짜 잘하시네요", "대박이다 이걸 피하네", "나이스 타이밍이었어요",
    "아깝다 조금만 더 하면 되는데", "할 수 있어요 힘내세요",
    "진짜 멋진 플레이였습니다", "운이 좋았네요", "완전 신기해요",
    
    # 일상적인 질문/대답
    "이거 어떻게 하는 거예요", "어디로 가야 출구인가요", "저 안 보여요?",
    "네 들립니다", "아니요 모르겠어요", "알겠습니다 그렇게 할게요",
    "누구세요", "지금 몇 시예요", "배고프다 밥 먹고 싶어", "너무 피곤해요"
]

# 경미한 부정어 (label: 1 = negative, 하지만 약함) - 구어체 위주
MILD_NEGATIVE_TEXTS = [
    # 투덜거림/짜증 (친구끼리 할 법한 말)
    "아 진짜 짜증나네", "왜 자꾸 죽는 거야", "아 망했다 다시 해야 돼",
    "이거 게임이 너무 어렵잖아", "답답해 죽겠네 진짜", "아 귀찮아 안 할래",
    "너 바보냐 그걸 못 피하게", "멍청이처럼 거기서 떨어지면 어떡해",
    "진짜 별로다 이거", "운도 지지리도 없지", 
    "아 열받아 미치겠네", "말 좀 들어라 제발",
    "하기 싫어 집어치워", "재수 없어 진짜", "안 돼 안 돼 안 돼"
]

# 강한 욕설 (label: 1 = negative, 강함) - 필터링 대상
STRONG_NEGATIVE_TEXTS = [
    # 실질적인 욕설
    "아이 씨발 진짜", "개새끼가 장난하나", "미친놈이네 저거",
    "병신 같이 게임하네", "닥쳐라 좀 시끄럽다", "나가 뒤져라 그냥",
    "좆같네 진짜 못해먹겠다", "씨발놈아 비키라고", "개빡치네 진짜 죽여버릴까",
    "지랄하지 마세요 좀", "미친 새끼 아니야 이거", "니네 엄마 없냐"
]

# 혐오 발언 (label: 1 = negative) - 게임 내 발생 가능성 있는 혐오
HATE_SPEECH_TEXTS = [
    "한남충 수준 알만하다", "김치녀는 이래서 안 돼", 
    "급식충들 시끄러워 죽겠네", "틀딱들 게임 왜 하냐",
    "짱깨들이 서버 다 망치네", "장애인 같이 게임하네 진짜"
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
    """특정 threshold에서 성능 지표 계산"""
    TP = FP = TN = FN = 0
    
    for (text, max_score, _, _), actual_label in zip(predictions, labels):
        predicted_negative = max_score >= threshold
        
        if predicted_negative and actual_label == 1:
            TP += 1  # True Positive (욕설 -> 욕설)
        elif predicted_negative and actual_label == 0:
            FP += 1  # False Positive (정상 -> 욕설) **치명적**
        elif not predicted_negative and actual_label == 0:
            TN += 1  # True Negative (정상 -> 정상)
        elif not predicted_negative and actual_label == 1:
            FN += 1  # False Negative (욕설 -> 정상)
    
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
    print("Threshold Optimization Analysis (Realistic Voice Data)")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # 1. 데이터셋 병합
    all_texts = []
    all_labels = []
    
    for text in CLEAN_TEXTS:
        all_texts.append(text)
        all_labels.append(0)
    for text in MILD_NEGATIVE_TEXTS:
        all_texts.append(text)
        all_labels.append(1)
    for text in STRONG_NEGATIVE_TEXTS:
        all_texts.append(text)
        all_labels.append(1)
    for text in HATE_SPEECH_TEXTS:
        all_texts.append(text)
        all_labels.append(1)
    
    print(f"\n[1/4] Dataset Prepared")
    print(f"   - Clean: {len(CLEAN_TEXTS)}")
    print(f"   - Mild Negative: {len(MILD_NEGATIVE_TEXTS)}")
    print(f"   - Strong Negative: {len(STRONG_NEGATIVE_TEXTS)}")
    print(f"   - Hate Speech: {len(HATE_SPEECH_TEXTS)}")
    print(f"   - Total: {len(all_texts)}")
    
    # 2. API 호출
    print("\n[2/4] Collecting Predictions...")
    predictions = []
    
    for i, text in enumerate(all_texts):
        result = get_prediction(text)
        if result:
            all_scores = result.get('all_scores', {})
            hate_scores = {k: v for k, v in all_scores.items() if k != 'clean'}
            max_hate_score = max(hate_scores.values()) if hate_scores else 0
            
            predictions.append((
                text,
                max_hate_score,
                result.get('is_negative'),
                result.get('label')
            ))
            if (i+1) % 10 == 0:
                print(f"   Processed {i+1}/{len(all_texts)}")
                
    # 3. Threshold 분석
    print("\n[3/4] Analyzing Performance...")
    # 0.1(현재) 전후로 세밀하게 분석
    thresholds = [0.05, 0.08, 0.10, 0.12, 0.15, 0.174, 0.20, 0.25, 0.30]
    results = []
    
    print("\n" + "-"*85)
    print(f"{'Threshold':>10} | {'Acc':>6} | {'Prec':>6} | {'Recall':>6} | {'F1':>6} | {'TP':>3} | {'FP':>3} | {'TN':>3} | {'FN':>3}")
    print("-" * 85)
    
    best_f1 = -1
    best_th = -1
    
    for th in thresholds:
        res = analyze_threshold(th, predictions, all_labels)
        results.append(res)
        
        mark = ""
        if th == 0.1: mark = " <-- CURRENT"
        if res['f1_score'] > best_f1:
            best_f1 = res['f1_score']
            best_th = th
            
        print(f"{th:>10.3f} | {res['accuracy']:>6.3f} | {res['precision']:>6.3f} | {res['recall']:>6.3f} | {res['f1_score']:>6.3f} | {res['TP']:>3} | {res['FP']:>3} | {res['TN']:>3} | {res['FN']:>3}{mark}")

    print("-" * 85)
    print(f"Best F1 Score: {best_f1:.3f} at threshold {best_th}")
    
    # 4. JSON 저장
    # 0.1(현재) 기준으로 오분류 저장
    misclassified = []
    target_th = 0.1
    for (text, score, _, label_str), actual in zip(predictions, all_labels):
        pred_bin = 1 if score >= target_th else 0
        if pred_bin != actual:
            misclassified.append({
                "text": text,
                "score": score,
                "label": label_str,
                "actual": actual,
                "predicted": pred_bin
            })
            
    report = {
        "analysis_date": datetime.now().isoformat(),
        "dataset_summary": {
            "clean": len(CLEAN_TEXTS),
            "mild": len(MILD_NEGATIVE_TEXTS),
            "strong": len(STRONG_NEGATIVE_TEXTS),
            "hate": len(HATE_SPEECH_TEXTS)
        },
        "results": results,
        "misclassified_at_0_1": misclassified
    }
    
    with open('tests/threshold_analysis_report_v2.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    print(f"\nSaved report to tests/threshold_analysis_report_v2.json")

if __name__ == "__main__":
    main()
