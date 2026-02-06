# 📂 `tests/` - 테스트 및 분석 도구

AI 서버의 품질 검증 및 성능 분석 도구입니다.

> 전체 개요는 [../README.md](../README.md)를 참조하세요.

---

## 📄 파일 목록

| 파일 | 역할 | 실행 방법 |
|------|------|-----------| 
| `test_api.py` | 자동화 API 테스트 | `python tests/test_api.py` |
| `threshold_analysis.py` | Threshold 최적화 분석 | `python tests/threshold_analysis.py` |
| `manual_test_samples.py` | 수동 샘플 테스트 | `python tests/manual_test_samples.py` |
| `performance_metrics.json` | 분석 결과 데이터 | (자동 생성됨) |

---

## 🧪 test_api.py - 자동화 API 테스트

### 테스트 항목
- ✅ 서버 Health Check
- ✅ 단일 분석 + `stack_delta` 검증
- ✅ 배치 분석 + `total_stack_delta` 검증
- ✅ 심각도별 스택 매핑 일관성
- ✅ 빈 텍스트 처리
- ✅ 에러 핸들링

### 실행 방법
```bash
# 1. AI 서버 실행 (별도 터미널)
uvicorn app.main:app --port 8000

# 2. 테스트 실행
python tests/test_api.py
```

### 예상 결과
```
✅ Health Check: PASS
✅ 단일 분석 (씨발): severity=1, stack_delta=5
✅ 배치 분석: total_stack_delta=7
✅ 모든 테스트 통과!
```

---

## 📊 threshold_analysis.py - Threshold 최적화

### 목적
Smilegate 공식 권장값(17.4%)과 우리 서비스 최적값(10%)을 비교 분석

### 분석 데이터
71개 실제 음성 샘플:

| 카테고리 | 샘플 수 | 예시 |
|----------|---------|------|
| Clean (정상) | 38개 | "안녕하세요", "오른쪽으로 가세요" |
| Mild (경미) | 15개 | "바보야", "멍청이" |
| Strong (강함) | 12개 | "씨발", "개새끼" |
| Hate (혐오) | 6개 | "한남충", "급식충" |

### 분석 범위
```python
thresholds = [0.05, 0.08, 0.10, 0.12, 0.15, 0.174, 0.20, 0.25, 0.30]
```

### 분석 결과

| Threshold | Accuracy | Precision | Recall | F1 Score | 비고 |
|:---------:|:--------:|:---------:|:------:|:--------:|:----:|
| 0.05 | 52.1% | 49.3% | 100.0% | 0.660 | ❌ 과탐지 |
| 0.08 | 85.9% | 78.0% | 97.0% | 0.865 | ⚠️ FP 9건 |
| **0.10** | **95.8%** | **94.1%** | **97.0%** | **0.955** | ✅ **최적값** |
| 0.174 | 93.0% | 96.7% | 87.9% | 0.921 | Smilegate 공식값 |
| 0.30 | 85.9% | 100% | 69.7% | 0.821 | ❌ 미탐지 |

### 최적값 선정 근거 (Threshold 0.10)
1. **F1 Score 0.955** - 전체 균형 최고
2. **Recall 97%** - 부정어 탐지율 높음 (FN 1건만)
3. **Precision 94.1%** - 오제재율 6%로 낮음

### 실행 방법
```bash
python tests/threshold_analysis.py
```

### 출력 파일
`performance_metrics.json` - 상세 분석 결과 저장

---

## 📝 manual_test_samples.py - 수동 샘플 테스트

### 목적
특정 텍스트에 대한 상세 분석 결과 확인

### 포함된 테스트 케이스
```python
test_samples = [
    # 심각한 욕설 (severity 1, +5 스택)
    "씨발", "개새끼", "병신",
    
    # 중간 강도 (severity 2, +3 스택)
    "짜증나", "닥쳐", "죽어버려",
    
    # 경미한 부정어 (severity 3, +1 스택)
    "바보", "멍청이", "미치겠다",
    
    # 정상 발화 (severity 0, 0 스택)
    "안녕하세요", "잘했어", "고마워",
    
    # 오분류 가능성 있는 케이스
    "피하세요", "뛰세요", "조심해"
]
```

### 실행 방법
```bash
python tests/manual_test_samples.py
```

---

## 📊 performance_metrics.json - 분석 결과 데이터

### 내용
- 각 Threshold별 성능 지표
- 개별 샘플별 예측 결과
- 오분류 케이스 목록

### 구조
```json
{
  "threshold_analysis": {
    "0.10": {
      "accuracy": 0.958,
      "precision": 0.941,
      "recall": 0.970,
      "f1_score": 0.955
    }
  },
  "misclassified": [
    {"text": "피하세요", "actual": "clean", "predicted": "negative"}
  ]
}
```

---

## 🔧 사전 요구사항

```bash
# 1. AI 서버 실행 중이어야 함
uvicorn app.main:app --port 8000

# 2. Windows UTF-8 설정 (한글 출력용)
chcp 65001

# 3. 가상환경 활성화
conda activate echoforest-ai
```

---

## 📊 최종 성능 지표 (Threshold 0.1)

| 지표 | 값 | 설명 |
|------|-----|------|
| **F1 Score** | **0.955** | 정밀도와 재현율의 조화 평균 |
| **Accuracy** | 95.8% | 전체 정확도 |
| **Precision** | 94.1% | 오제재율 6% (욕설 아닌 것을 욕설로 판정) |
| **Recall** | 97.0% | 미탐지율 3% (욕설을 놓침) |

---

## 🔗 관련 문서

- [../README.md](../README.md) - 전체 개요
- [../app/README.md](../app/README.md) - 소스 코드 설명
- [../docs/API_SPEC.md](../docs/API_SPEC.md) - API 명세서
