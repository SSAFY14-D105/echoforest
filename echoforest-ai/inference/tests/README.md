# 📂 `tests/` - 테스트 도구

AI 서버의 품질 검증 및 성능 분석 도구 모음입니다.

> **4인 협동 게임 저주 스택 시스템 검증용**

---

## 📄 파일 구조

```
tests/
├── test_api.py               # API 테스트 (stack_delta 검증 포함)
├── manual_test_samples.py    # 수동 샘플 테스트
├── threshold_analysis.py     # Threshold 최적화 분석
├── performance_metrics.json  # 성능 지표 (포트폴리오용)
└── README.md                 # 본 문서
```

---

## 🧪 테스트 실행

### 1. `test_api.py` - 자동 API 테스트

```bash
python tests/test_api.py
```

**테스트 항목:**
- ✅ 서버 상태 확인 (`GET /health`)
- ✅ 단일 분석 + `stack_delta` 검증
- ✅ 배치 분석 + `total_stack_delta` 검증
- ✅ 스택 증가량 매핑 검증

**출력 예시:**
```
3. 배치 분석 + 총 스택 증가량 검증
   입력: ['야 바보야', '너 멍청이다', '씨발']
   
   결과:
      - "야 바보야": severity=3, stack_delta=1
      - "너 멍청이다": severity=3, stack_delta=1
      - "씨발": severity=1, stack_delta=5

   📊 요약:
      total_count: 3
      negative_count: 3
      total_stack_delta: 7
```

---

### 2. `manual_test_samples.py` - 수동 샘플 테스트

```bash
python tests/manual_test_samples.py
```

**출력 예시:**
```
[강한 욕설 - +5스택 (critical)]
🔴 sev:1 +5스택 | 씨발                 → critical
🔴 sev:1 +5스택 | 개새끼               → critical
```

---

### 3. `threshold_analysis.py` - Threshold 최적화

```bash
# Windows UTF-8 설정
chcp 65001

python tests/threshold_analysis.py
```

71개 실제 음성 샘플로 최적의 Threshold 값을 분석합니다.

---

## 📊 스택 증가량 매핑

| 심각도 | 라벨 | 스택 증가량 | 예시 |
|--------|------|-------------|------|
| 0 | clean | 0 | 안녕하세요, 좋아요 |
| 3 | mild | **+1** | 바보, 멍청이 |
| 2 | severe | **+3** | 짜증나, 열받네 |
| 1 | critical | **+5** | 씨발, 개새끼 |

---

## ⚙️ 테스트 전 체크리스트

- [ ] AI 서버 실행 중 (`uvicorn app.main:app --port 8000`)
- [ ] `conda activate echoforest-ai` 환경 활성화
- [ ] Windows: UTF-8 설정 (`chcp 65001`)

---

## 📈 성능 지표 (Threshold 0.1 기준)

| 지표 | 값 |
|------|-----|
| F1 Score | **0.955** |
| Accuracy | 95.8% |
| Precision | 94.1% |
| Recall | 97.0% |

> `performance_metrics.json`에 상세 데이터 보관
