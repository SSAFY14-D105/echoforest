"""
=============================================================================
EchoForest AI - Baseline Test (base unSmile, 파인튜닝 전)
=============================================================================
목적: 파인튜닝 전 base unSmile 성능을 held-out test_set(482)으로 측정
      → 공식 "before"(Step 1 UnSmile = Step 6 baseline과 동일) + 놓치는 게임 욕설 진단
산출물: baseline_test_results.csv (문장별 확률) · baseline_accuracy.png
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

# 폰트/팔레트 (크로스플랫폼 · 포트폴리오 톤)
import matplotlib.font_manager as fm
def _pick_font(cands):
    avail = {f.name for f in fm.fontManager.ttflist}
    return next((c for c in cands if c in avail), "DejaVu Sans")
plt.rcParams['font.family'] = _pick_font(["Helvetica Neue", "Arial", "DejaVu Sans"])
plt.rcParams['axes.unicode_minus'] = False
INK, SUB, GRID = "#1F2933", "#9AA5B1", "#EBEEF1"
ACCENT, SLATE, NEUTRAL = "#2A9D8F", "#4B5A68", "#C2CAD2"  # 틸(abuse)·슬레이트·뉴트럴

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

# held-out test_set(482)로 baseline 측정 → Step 6 파인튜닝 결과와 직접 비교 가능한 "before"
DATA_PATH = "../0_Data_Collection/datasets/test_set.tsv"

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

fn_cnt, total_abuse = len(false_negatives), int(y_true_abuse.sum())
fig, axes = plt.subplots(2, 2, figsize=(13, 10))
fig.suptitle(f"Baseline — base unSmile on test_set ({len(df)})    "
             f"Abuse Recall {abuse_recall*100:.1f}%  ·  misses {fn_cnt}/{total_abuse} abuse",
             fontsize=14, fontweight='bold', color=INK, x=0.5, y=0.99)

def _clean_ax(ax):
    for s in ['top', 'right']:
        ax.spines[s].set_visible(False)
    ax.spines['left'].set_color(GRID); ax.spines['bottom'].set_color(GRID)
    ax.tick_params(length=0, colors=SUB)

# 1. Abuse Confusion Matrix
ax1 = axes[0, 0]
sns.heatmap(confusion_matrix(y_true_abuse, abuse_preds), annot=True, fmt='d',
            cmap=sns.light_palette(ACCENT, as_cmap=True), ax=ax1, cbar=False,
            annot_kws={'fontsize': 15, 'fontweight': 'bold'}, linewidths=2, linecolor='white',
            xticklabels=['Pred Non-Abuse', 'Pred Abuse'], yticklabels=['Actual Non-Abuse', 'Actual Abuse'])
ax1.set_title('Abuse — Confusion Matrix  (FN=missed abuse)', fontsize=12, fontweight='bold', color=INK, loc='left', pad=10)
ax1.tick_params(length=0)

# 2. Clean Confusion Matrix
ax2 = axes[0, 1]
sns.heatmap(confusion_matrix(y_true_clean, clean_preds), annot=True, fmt='d',
            cmap=sns.light_palette(SLATE, as_cmap=True), ax=ax2, cbar=False,
            annot_kws={'fontsize': 15, 'fontweight': 'bold'}, linewidths=2, linecolor='white',
            xticklabels=['Pred Non-Clean', 'Pred Clean'], yticklabels=['Actual Non-Clean', 'Actual Clean'])
ax2.set_title('Clean — Confusion Matrix', fontsize=12, fontweight='bold', color=INK, loc='left', pad=10)
ax2.tick_params(length=0)

# 3. Abuse probability distribution (핵심 진단)
ax3 = axes[1, 0]
ax3.hist(abuse_probs[y_true_abuse == 1], bins=24, alpha=0.9, label='Actual abuse', color=ACCENT)
ax3.hist(abuse_probs[y_true_clean == 1], bins=24, alpha=0.55, label='Actual clean', color=NEUTRAL)
ax3.axvline(0.5, color=SLATE, linestyle='--', lw=1.5, label='Threshold 0.5')
ax3.set_xlabel('Abuse probability', color=SUB); ax3.set_ylabel('Count', color=SUB)
ax3.set_title('Abuse probability — abuse mass leaks left of 0.5 (= missed)', fontsize=11.5, fontweight='bold', color=INK, loc='left', pad=10)
ax3.legend(frameon=False)
_clean_ax(ax3)

# 4. Abuse metrics — Recall is the gap
ax4 = axes[1, 1]
metrics = ['Precision', 'Recall', 'F1']
scores = [abuse_precision, abuse_recall, abuse_f1]
x = np.arange(len(metrics))
bars = ax4.bar(x, scores, 0.5, color=[NEUTRAL, ACCENT, NEUTRAL])
ax4.axhline(0.75, color=SLATE, linestyle='--', lw=1.2)
ax4.text(2.5, 0.75, 'FT target ≥0.75', color=SLATE, fontsize=9, va='center', ha='right')
ax4.set_xticks(x); ax4.set_xticklabels(metrics); ax4.set_ylim(0, 1.05)
ax4.set_title('Abuse metrics — Recall is the gap fine-tuning closes', fontsize=11.5, fontweight='bold', color=INK, loc='left', pad=10)
_clean_ax(ax4)
for b, v in zip(bars, scores):
    ax4.text(b.get_x() + b.get_width() / 2, v + 0.02, f'{v:.2f}', ha='center', color=INK, fontweight='bold')

plt.tight_layout(rect=[0, 0, 1, 0.96])
plt.savefig('baseline_accuracy.png', dpi=200, bbox_inches='tight', facecolor='white')
print("✓ 시각화 저장: baseline_accuracy.png")

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
