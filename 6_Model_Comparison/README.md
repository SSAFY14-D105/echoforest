# 6_Model_Comparison, baseline + 8개 파인튜닝 모델 비교

baseline(파인튜닝 전) + LoRA/Full × v1/v2 × KcELECTRA/kcbert 8개를 **학습에 쓰지 않은 `test_set`(482)** 으로 한 번에 비교해 최종 모델을 고르는 **메인 헤드라인** 단계입니다.

> 📖 상세 수치·그래프 읽는 법 → [`results/README.md`](results/README.md) · 재현/재평가 가이드 → [`RUN_REEVAL.md`](RUN_REEVAL.md) · 전체 흐름 → [`../AI_파이프라인_개요.md`](../AI_파이프라인_개요.md)

## ⭐ 한 줄 요약

- **abuse 판정**: not-clean(clean이 아니면 부정어, clean 제외 9개 라벨 max > 0.5), 배포·Step 2·Step 8과 동일 정의 · **비교 임계값 0.5**
- **선정 기준**: 임계값과 무관한 **LRAP**(다중라벨 랭킹 품질) + **AP**(부정어 이진 랭킹). 0.5 한 점의 F1에 의존하지 않음
- **결과**: **Full v2 KcELECTRA 선정**: LRAP 0.936 1위, AP 96.21 1위, LoRA v2 대비 오탐 감소(FP 23 vs 30), F1 87.78(사실상 동률)

## 📊 핵심 결과 (test_set 482, not-clean)

| 모델 | Recall | F1 | Precision | LRAP | AP |
|------|:---:|:---:|:---:|:---:|:---:|
| **Full v2 KcELECTRA** ✅ | 85.48% | 87.78% | 90.21% | **0.936** | **96.21** |
| LoRA v2 KcELECTRA | 87.90% | 87.90% | 87.90% | 0.932 | 96.04 |
| Baseline (kor_unsmile) | 60.08% | 73.95% | 96.13% | 0.887 | 91.94 |

> Recall 1위는 LoRA v2지만 abuse 248문장 중 6문장 차이(통계적 동률)다. 변별은 오탐(FP 23 vs 30)과 임계값-무관 지표(LRAP·AP)에서 나고, 거기서 Full v2가 앞선다. 전체 9개 순위·그래프는 [`results/README.md`](results/README.md).
> 숫자 읽는 법: baseline의 **Recall/F1/Precision**은 Step 2와 같은 `not-clean > 0.5` 운영점 성능입니다. **AP 91.94**는 Step 1 후보 선정 때 쓴 이진 abuse 랭킹 지표이고, **LRAP 0.887**은 10개 라벨 전체 순위를 보는 다중라벨 랭킹 지표라 서로 같은 점수가 아닙니다.

## 📁 파일

| 파일 | 내용 |
|------|------|
| `compare_models.py` | 9모델 not-clean 평가 → `results/comparison_results.csv/.json` |
| `threshold_robustness.py` · `significance_analysis.py` | 임계값 sweep · 부트스트랩 유의성 검정 |
| `eval_not_clean.py` · `threshold_not_clean.py` | not-clean 단건 평가 · 누수 없는 임계값 보정 |
| `plot_comparison.py` · `plot_paper_figures.py` | 포트폴리오·논문용 차트(en/ko), CSV 기반 재추론 불필요 |
| `results/` | CSV/JSON + 그래프 + 상세 설명([`README.md`](results/README.md)) |

## 🚀 실행

```bash
cd 6_Model_Comparison
python compare_models.py        # 9모델 재평가 → results/ CSV·JSON
python plot_comparison.py       # 포트폴리오 차트(재추론 없이 CSV로 렌더)
python plot_paper_figures.py    # 논문용 PNG/PDF
```

## ▶️ 다음 단계
[`../7_Best_Model_Selection`](../7_Best_Model_Selection)(Full v2 KcELECTRA 확정) → [`../8_Quantization`](../8_Quantization)(FP16 권장, INT8 보정 검토)
