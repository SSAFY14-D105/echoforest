# 🧹 05_S14PD105_ai_motion_model_test 정리 계획

## 📊 현재 상황 분석

### 폴더 구조
```
05_S14PD105_ai_motion_model_test/
├── echoforest-ai/
│   ├── motion-model-test/
│   │   ├── gesture-tuner.html (81KB)
│   │   ├── analysis/
│   │   └── captures/
│   └── inference/ (FastAPI 서버)
└── echoforest-frontend/ (954KB)
    └── llm-context/ (12개 가이드 문서)
```

### 중복 폴더 발견
- **05_S14PD105_motion_tuning_heart** - 손하트 인식 전용 (깔끔하게 정리됨)
- **05_S14PD105_ai_motion_model_test** - 제스처 튜닝 + 프론트엔드 (혼재)

---

## 🎯 정리 옵션

### Option A: 완전 삭제 (권장)
**이유**: 메인 프로젝트에 이미 통합되어 있음

```bash
# 백업 후 삭제
cd c:/Users/SSAFY/Desktop/SSAFY/02_second_semester/05_Project/01_공통프로젝트
mv 05_S14PD105_ai_motion_model_test 05_S14PD105_ai_motion_model_test.backup
```

**삭제 전 확인 사항**:
- [ ] `gesture-tuner.html`이 메인 프로젝트에 있는지 확인
- [ ] `llm-context/` 문서가 `04_S14PD105_docs`에 있는지 확인
- [ ] `inference/` 서버가 `03_S14P11D105_ai`에 있는지 확인

---

### Option B: 선택적 보존
**보존할 파일**:
1. `gesture-tuner.html` → 독립 실행 가능한 튜닝 도구
2. `analysis/`, `captures/` → 실험 데이터

**삭제할 폴더**:
1. `echoforest-frontend/` → 메인 프로젝트와 중복
2. `inference/` → `03_S14P11D105_ai`에 이미 존재

```bash
# 정리 스크립트
cd 05_S14PD105_ai_motion_model_test

# 프론트엔드 삭제
rm -rf echoforest-frontend/

# inference 폴더 확인 후 삭제
# (메인 AI 폴더에 있는지 확인 필요)
```

---

### Option C: 아카이브 (안전한 방법)
**모든 내용을 압축하여 보관**

```bash
cd c:/Users/SSAFY/Desktop/SSAFY/02_second_semester/05_Project/01_공통프로젝트

# 압축
tar -czf 05_S14PD105_ai_motion_model_test_archive_$(date +%Y%m%d).tar.gz 05_S14PD105_ai_motion_model_test/

# 원본 삭제
rm -rf 05_S14PD105_ai_motion_model_test/
```

---

## 📋 체크리스트

### 삭제 전 확인
- [ ] `gesture-tuner.html` 위치 확인
  - 메인: `03_S14P11D105_ai/echoforest-ai/motion-model-test/`
  - 중복: `05_S14PD105_ai_motion_model_test/echoforest-ai/motion-model-test/`
  
- [ ] LLM 컨텍스트 문서 확인
  - 메인: `04_S14PD105_docs/docs/`
  - 중복: `05_S14PD105_ai_motion_model_test/echoforest-frontend/llm-context/`

- [ ] FastAPI 서버 확인
  - 메인: `03_S14P11D105_ai/echoforest-ai/inference/`
  - 중복: `05_S14PD105_ai_motion_model_test/echoforest-ai/inference/`

### 정리 후 확인
- [ ] Git 상태 확인 (`git status`)
- [ ] 메인 프로젝트 빌드 테스트
- [ ] 문서 링크 깨짐 확인

---

## 🚀 권장 실행 순서

1. **백업 생성**
   ```bash
   cp -r 05_S14PD105_ai_motion_model_test 05_S14PD105_ai_motion_model_test.backup
   ```

2. **중복 파일 비교**
   ```bash
   # gesture-tuner.html 비교
   diff 05_S14PD105_ai_motion_model_test/echoforest-ai/motion-model-test/gesture-tuner.html \
        03_S14P11D105_ai/echoforest-ai/motion-model-test/gesture-tuner.html
   ```

3. **고유 파일 추출**
   - `analysis/`, `captures/` 폴더를 메인 프로젝트로 이동

4. **폴더 삭제**
   ```bash
   rm -rf 05_S14PD105_ai_motion_model_test/
   ```

---

## 💡 최종 권장사항

**Option A (완전 삭제)** 추천 이유:
- Git worktree로 생성된 임시 작업 공간으로 보임
- 메인 프로젝트에 이미 병합되었을 가능성 높음
- 폴더명에 "test"가 포함되어 있어 실험용으로 판단

**확인 후 삭제하세요!**
