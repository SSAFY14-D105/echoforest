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

## 🧪 테스트 실행

### 1. 사전 요구사항
```bash
# AI 서버 실행 중이어야 함
uvicorn app.main:app --port 8000

# Windows UTF-8 설정
chcp 65001
```

### 2. API 테스트
```bash
python tests/test_api.py
```

**테스트 항목:**
- ✅ 서버 Health Check
- ✅ 단일 분석 + `stack_delta` 검증
- ✅ 배치 분석 + `total_stack_delta` 검증
- ✅ 심각도별 스택 매핑 일관성

### 3. Threshold 분석
```bash
python tests/threshold_analysis.py
```

71개 실제 음성 샘플로 최적 Threshold를 탐색합니다.

---

## 📊 성능 지표 (Threshold 0.1)

| 지표 | 값 |
|------|-----|
| F1 Score | **0.955** |
| Accuracy | 95.8% |
| Precision | 94.1% |
| Recall | 97.0% |

> 상세 데이터: `performance_metrics.json`
