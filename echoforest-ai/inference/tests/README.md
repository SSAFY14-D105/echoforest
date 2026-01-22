# 📂 `tests/` - 테스트 및 성능 분석

AI 서버의 품질 검증 및 성능 분석을 위한 테스트 도구 모음입니다.

---

## 📄 최종 파일 구조

```
tests/
├── test_api.py                  # ✅ 유지: pytest 단위 테스트
├── manual_test_samples.py       # ✅ 이름 변경 (구: test_comprehensive.py)
├── threshold_analysis.py        # ✅ 유지: Threshold 최적화 도구
├── performance_metrics.json     # ✅ 이름 변경 (구: threshold_analysis_report_v2.json)
└── README.md                    # ✅ 본 문서
```

**삭제됨**: `threshold_analysis_report.json` (구버전, 더 이상 불필요)

---

## 📝 파일별 상세 설명

### 1. `test_api.py` - 자동화된 API 단위 테스트 ⚙️
**목적**: CI/CD 파이프라인에서 사용할 수 있는 pytest 기반 테스트

#### 주요 테스트 케이스
- ✅ 서버 상태 확인 (`GET /health`)
- ✅ 욕설 탐지 정확도 검증
- ✅ 응답 JSON 스키마 검증
- ✅ 에러 핸들링 테스트

#### 실행 방법
```bash
# 전체 테스트 실행
pytest tests/test_api.py -v

# 특정 테스트만 실행
pytest tests/test_api.py::test_analyze_negative -v

# 커버리지 포함
pytest tests/test_api.py --cov=app
```

**사용 시나리오**: 코드 변경 후 회귀 테스트(Regression Test)

---

### 2. `manual_test_samples.py` - 수동 샘플 테스트 👀
**목적**: 다양한 케이스를 시각적으로 빠르게 확인

#### 테스트 샘플
- 긍정 표현: "좋아", "사랑해"
- 부정 표현: "씨발", "개새끼"
- 애매한 표현: "바보", "짜증나"

#### 실행 방법
```bash
python tests/manual_test_samples.py
```

**출력 예시**:
```
=== Testing: 좋아 ===
  is_negative: False
  severity: 0 (clean)
  
=== Testing: 씨발 ===
  is_negative: True
  severity: 1 (critical)
  confidence: 0.918
```

**사용 시나리오**: 개발 중 빠른 동작 확인

---

### 3. `threshold_analysis.py` - Threshold 최적화 도구 📊
**목적**: 데이터 기반으로 최적의 Threshold 값 도출

#### 핵심 기능
1. **71개 실제 음성 문장**으로 테스트
2. **다양한 Threshold** (0.05 ~ 0.30) 성능 비교
3. **F1 Score, Precision, Recall** 계산
4. **오분류 샘플 분석** 및 JSON 저장

#### 실행 방법
```bash
# UTF-8 인코딩 설정 (Windows)
chcp 65001

# 분석 실행
python tests/threshold_analysis.py
```

#### 출력 예시
```
Threshold | Accuracy | Precision | Recall | F1 Score
   0.10   |   95.8%  |   94.1%   | 97.0%  |  0.955  <-- CURRENT
   0.12   |   97.2%  |   97.0%   | 97.0%  |  0.970
```

**사용 시나리오**: 
- Threshold 조정 후 성능 검증
- 자소서/포트폴리오용 성능 지표 산출

---

### 4. `performance_metrics.json` - 성능 증빙 자료 📈
**목적**: Threshold 최적화 분석 결과 보관 (포트폴리오용)

#### 포함 데이터
```json
{
  "analysis_date": "2026-01-22T15:35:51",
  "dataset_summary": {
    "clean": 38,
    "mild": 15,
    "strong": 12,
    "hate": 6
  },
  "results": [
    {
      "threshold": 0.1,
      "accuracy": 0.958,
      "precision": 0.941,
      "recall": 0.970,
      "f1_score": 0.955
    }
  ],
  "misclassified_at_0_1": [...]
}
```

#### 활용 방법
- **자소서**: "F1 Score 0.955 달성"
- **포트폴리오**: 데이터 기반 의사결정 증빙
- **기술 면접**: 오분류 케이스 분석 논의

**⚠️ 중요**: 이 파일은 절대 삭제하지 마세요!

---

## 🎯 테스트 전략

### 개발 단계별 테스트 가이드

| 단계 | 사용 도구 | 목적 |
|------|----------|------|
| **로컬 개발** | `manual_test_samples.py` | 빠른 동작 확인 |
| **코드 리뷰 전** | `test_api.py` (pytest) | 회귀 테스트 |
| **Threshold 조정** | `threshold_analysis.py` | 성능 측정 |
| **배포 전** | `test_api.py` + `manual_test_samples.py` | 종합 검증 |

---

## 📊 최신 분석 결과 (2026-01-22)

### 데이터셋
- **총 샘플**: 71개 (구어체 중심)
- **정상 발화**: 38개
- **부정어**: 33개 (경미 15 + 강함 12 + 혐오 6)

### 성능 지표 (Threshold 0.1)
| 지표 | 값 | 설명 |
|------|-----|------|
| **Accuracy** | 95.8% | 전체 정확도 |
| **Precision** | 94.1% | 욕설로 판정한 것 중 실제 욕설 비율 |
| **Recall** | 97.0% | 실제 욕설 중 탐지한 비율 |
| **F1 Score** | **0.955** | 정밀도와 재현율의 조화 평균 |

### 주요 오분류 사례
| 텍스트 | 실제 | 예측 | Score | 분석 |
|--------|------|------|-------|------|
| "대박이다 이걸 피하네" | Clean | Mild | 0.206 | '피하다', '미쳤다' 등이 부정 맥락으로 학습됨 |
| "오른쪽으로 피하세요" | Clean | Mild | 0.104 | 게임 명령어 예외 처리 필요 |

---

## 🔧 테스트 실행 전 체크리스트

- [ ] AI 서버 실행 (`uvicorn app.main:app --reload --port 8000`)
- [ ] `conda activate echoforest-ai` 환경 활성화
- [ ] Windows에서 UTF-8 설정 (`chcp 65001`)

---

## 💡 자소서 작성 팁

### "데이터 기반 의사결정" 어필
> "초기 Smilegate 공식 권장값(17.4%)에서 벗어나, 실제 게임 음성 채팅 패턴을 반영한 71개 샘플로 독자적인 분석을 수행했습니다. 여러 Threshold 후보(0.05~0.30)의 성능을 정량적으로 비교하여 F1 Score가 가장 높은 **10% (0.1)**를 최종 선정했습니다."

### "문제 인식 및 개선" 어필
> "테스트 과정에서 '대박이다 이걸 피하네' 같은 정상 발화가 욕설로 오인되는 케이스를 발견했습니다. 이를 통해 게임 특화 명령어('피하세요', '미쳤다' 등)는 예외 처리가 필요함을 인지하고, 향후 화이트리스트 적용을 계획했습니다."

---

## 🗂️ 버전 관리

| 파일 | 버전 | 변경 이력 |
|------|------|----------|
| `test_api.py` | v1.0 | 초기 작성 |
| `manual_test_samples.py` | v1.1 | `test_comprehensive.py`에서 이름 변경 |
| `threshold_analysis.py` | v2.0 | 구어체 중심 데이터셋으로 재작성 |
| `performance_metrics.json` | v2.0 | 71개 샘플 기준 최신 분석 결과 |
