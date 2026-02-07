"""
=============================================================================
EchoForest AI - Baseline Test Script (Step 0)
=============================================================================
목적: 기존 unSmile 모델로 게임 키워드 데이터 테스트
환경: NVIDIA L40S GPU, Python 3.12, PyTorch 2.5.1+cu121
=============================================================================
"""

import torch
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support
import warnings
warnings.filterwarnings('ignore')

# 한글 폰트 설정 (시각화용)
plt.rcParams['font.family'] = 'Malgun Gothic'  # Windows 로컬 환경
plt.rcParams['axes.unicode_minus'] = False     # 마이너스 부호 깨짐 방지

# =============================================================================
# 1. 설정
# =============================================================================
MODEL_NAME = "smilegate-ai/kor_unsmile"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# unSmile 라벨 이름
LABEL_NAMES = [
    "여성/가족", "남성", "성소수자", "인종/국적", "연령",
    "지역", "종교", "기타 혐오", "악플/욕설", "clean"
]

# 임계값 설정
THRESHOLD = 0.5

print("=" * 60)
print("EchoForest AI - Baseline Test")
print("=" * 60)
print(f"Device: {DEVICE}")
print(f"Model: {MODEL_NAME}")
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
print("=" * 60)

# =============================================================================
# 2. 모델 로드
# =============================================================================
print("\n[1/5] 모델 로딩 중...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model = model.to(DEVICE)
model.eval()
print(f"✓ 모델 로드 완료!")

# =============================================================================
# 3. 테스트 데이터 로드 (keywords_unsmile_format.tsv)
# =============================================================================
print("\n[2/5] 테스트 데이터 로딩 중...")

# TSV 파일 로드
# 경로를 실제 환경에 맞게 수정하세요
DATA_PATH = "keywords_unsmile_format.tsv"  # 같은 폴더에 있을 경우
# DATA_PATH = "/path/to/keywords_unsmile_format.tsv"  # Colab/Jupyter에서 절대 경로

df = pd.read_csv(DATA_PATH, sep='\t', encoding='utf-8')
print(f"✓ 데이터 로드 완료: {len(df)}개 문장")
print(f"  - Clean: {df['clean'].sum()}개")
print(f"  - 악플/욕설: {df['악플/욕설'].sum()}개")

# =============================================================================
# 4. 예측 함수
# =============================================================================
def predict_single(text):
    """단일 문장 예측"""
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.sigmoid(outputs.logits[0]).cpu().numpy()
    
    return probs

def predict_batch(texts, batch_size=32):
    """배치 예측"""
    all_probs = []
    
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        inputs = tokenizer(
            batch_texts.tolist(), 
            return_tensors="pt", 
            truncation=True, 
            max_length=128, 
            padding=True
        )
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.sigmoid(outputs.logits).cpu().numpy()
        
        all_probs.extend(probs)
    
    return np.array(all_probs)

# =============================================================================
# 5. 예측 실행
# =============================================================================
print("\n[3/5] 예측 실행 중...")
probs = predict_batch(df['문장'].values)
predictions = (probs > THRESHOLD).astype(int)

# 악플/욕설 (index 8)과 clean (index 9) 추출
abuse_probs = probs[:, 8]
clean_probs = probs[:, 9]
abuse_preds = predictions[:, 8]
clean_preds = predictions[:, 9]

print("✓ 예측 완료!")

# =============================================================================
# 6. 결과 분석
# =============================================================================
print("\n[4/5] 결과 분석 중...")

# 실제 라벨
y_true_abuse = df['악플/욕설'].values
y_true_clean = df['clean'].values

# 분류 리포트
print("\n" + "=" * 60)
print("📊 악플/욕설 분류 결과")
print("=" * 60)
print(classification_report(y_true_abuse, abuse_preds, target_names=['Non-Abuse', 'Abuse']))

print("\n" + "=" * 60)
print("📊 Clean 분류 결과")
print("=" * 60)
print(classification_report(y_true_clean, clean_preds, target_names=['Non-Clean', 'Clean']))

# 성능 지표
abuse_precision, abuse_recall, abuse_f1, _ = precision_recall_fscore_support(
    y_true_abuse, abuse_preds, average='binary'
)
clean_precision, clean_recall, clean_f1, _ = precision_recall_fscore_support(
    y_true_clean, clean_preds, average='binary'
)

print("\n" + "=" * 60)
print("📈 핵심 성능 지표 요약")
print("=" * 60)
print(f"악플/욕설 - Precision: {abuse_precision:.4f}, Recall: {abuse_recall:.4f}, F1: {abuse_f1:.4f}")
print(f"Clean     - Precision: {clean_precision:.4f}, Recall: {clean_recall:.4f}, F1: {clean_f1:.4f}")

# =============================================================================
# 7. 상세 분석: 인식 실패 케이스
# =============================================================================
print("\n" + "=" * 60)
print("❌ 인식 실패 케이스 분석")
print("=" * 60)

# 악플/욕설인데 clean으로 예측된 경우 (False Negative - 가장 중요!)
false_negatives = df[(y_true_abuse == 1) & (abuse_preds == 0)]['문장'].values
print(f"\n🔴 악플/욕설 → Clean으로 오분류 (False Negative): {len(false_negatives)}건")
if len(false_negatives) > 0:
    print("   ↳ Fine-tuning 시 우선 개선 필요!")
    for i, text in enumerate(false_negatives[:20], 1):  # 최대 20개만 출력
        prob = abuse_probs[df[df['문장'] == text].index[0]]
        print(f"   {i}. \"{text}\" (욕설 확률: {prob:.4f})")

# Clean인데 악플/욕설로 예측된 경우 (False Positive)
false_positives = df[(y_true_clean == 1) & (abuse_preds == 1)]['문장'].values
print(f"\n🟡 Clean → 악플/욕설로 오분류 (False Positive): {len(false_positives)}건")
if len(false_positives) > 0:
    print("   ↳ 게임 컨텍스트 오탐 가능성")
    for i, text in enumerate(false_positives[:20], 1):
        prob = abuse_probs[df[df['문장'] == text].index[0]]
        print(f"   {i}. \"{text}\" (욕설 확률: {prob:.4f})")

# =============================================================================
# 8. 결과 저장
# =============================================================================
print("\n[5/5] 결과 저장 중...")

# 결과 DataFrame
results_df = df.copy()
results_df['pred_abuse'] = abuse_preds
results_df['pred_clean'] = clean_preds
results_df['prob_abuse'] = abuse_probs
results_df['prob_clean'] = clean_probs
results_df['correct_abuse'] = y_true_abuse == abuse_preds
results_df['correct_clean'] = y_true_clean == clean_preds

# CSV로 저장
results_df.to_csv('baseline_test_results.csv', index=False, encoding='utf-8-sig')
print("✓ 결과 저장: baseline_test_results.csv")

# =============================================================================
# 9. 시각화
# =============================================================================
print("\n📊 시각화 생성 중...")

fig, axes = plt.subplots(2, 2, figsize=(14, 12))

# 1. 악플/욕설 Confusion Matrix
ax1 = axes[0, 0]
cm_abuse = confusion_matrix(y_true_abuse, abuse_preds)
sns.heatmap(cm_abuse, annot=True, fmt='d', cmap='Blues', ax=ax1,
            xticklabels=['Pred: Non-Abuse', 'Pred: Abuse'],
            yticklabels=['True: Non-Abuse', 'True: Abuse'])
ax1.set_title('Abuse Classification - Confusion Matrix', fontsize=12, fontweight='bold')

# 2. Clean Confusion Matrix
ax2 = axes[0, 1]
cm_clean = confusion_matrix(y_true_clean, clean_preds)
sns.heatmap(cm_clean, annot=True, fmt='d', cmap='Greens', ax=ax2,
            xticklabels=['Pred: Non-Clean', 'Pred: Clean'],
            yticklabels=['True: Non-Clean', 'True: Clean'])
ax2.set_title('Clean Classification - Confusion Matrix', fontsize=12, fontweight='bold')

# 3. 확률 분포
ax3 = axes[1, 0]
abuse_data = pd.DataFrame({
    'Probability': abuse_probs,
    'Actual': ['Negative (abuse)' if x == 1 else 'Clean' for x in y_true_abuse]
})
colors = {'Negative (abuse)': 'red', 'Clean': 'green'}
for label, color in colors.items():
    subset = abuse_data[abuse_data['Actual'] == label]
    ax3.hist(subset['Probability'], bins=20, alpha=0.6, label=label, color=color)
ax3.axvline(x=0.5, color='black', linestyle='--', label='Threshold (0.5)')
ax3.set_xlabel('Abuse Probability')
ax3.set_ylabel('Count')
ax3.set_title('Abuse Probability Distribution by Actual Label', fontsize=12, fontweight='bold')
ax3.legend()

# 4. 성능 지표 바 차트
ax4 = axes[1, 1]
metrics = ['Precision', 'Recall', 'F1-Score']
abuse_scores = [abuse_precision, abuse_recall, abuse_f1]
clean_scores = [clean_precision, clean_recall, clean_f1]

x = np.arange(len(metrics))
width = 0.35

bars1 = ax4.bar(x - width/2, abuse_scores, width, label='Abuse', color='red', alpha=0.7)
bars2 = ax4.bar(x + width/2, clean_scores, width, label='Clean', color='green', alpha=0.7)

ax4.set_ylabel('Score')
ax4.set_title('Performance Metrics Comparison', fontsize=12, fontweight='bold')
ax4.set_xticks(x)
ax4.set_xticklabels(metrics)
ax4.set_ylim(0, 1.1)
ax4.legend()

# 바 위에 숫자 표시
for bar in bars1 + bars2:
    height = bar.get_height()
    ax4.annotate(f'{height:.3f}',
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha='center', va='bottom', fontsize=9)

plt.tight_layout()
plt.savefig('baseline_accuracy.png', dpi=150, bbox_inches='tight')
print("✓ 시각화 저장: baseline_accuracy.png")

plt.show()

# =============================================================================
# 10. 최종 요약
# =============================================================================
print("\n" + "=" * 60)
print("🎯 Baseline 테스트 최종 요약")
print("=" * 60)
print(f"""
총 테스트 문장: {len(df)}개
├── Clean: {df['clean'].sum()}개
└── 악플/욕설: {df['악플/욕설'].sum()}개

📊 악플/욕설 탐지 성능:
├── Precision: {abuse_precision:.4f} (예측 중 정확도)
├── Recall: {abuse_recall:.4f} (실제 중 탐지율) ← 🎯 핵심 지표!
└── F1-Score: {abuse_f1:.4f}

📊 Clean 탐지 성능:
├── Precision: {clean_precision:.4f}
├── Recall: {clean_recall:.4f}
└── F1-Score: {clean_f1:.4f}

❌ 인식 실패 케이스:
├── False Negative (욕설 → Clean): {len(false_negatives)}건
└── False Positive (Clean → 욕설): {len(false_positives)}건

💡 Fine-tuning 개선 목표:
├── 현재 악플/욕설 Recall: {abuse_recall:.4f}
└── 목표 악플/욕설 Recall: ≥ 0.75
""")
print("=" * 60)
print("✅ Baseline 테스트 완료!")
print("=" * 60)
