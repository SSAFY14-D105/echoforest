# 📂 `docs/` - API 문서

AI 서버의 API 인터페이스 문서입니다.

> 전체 개요는 [../README.md](../README.md)를 참조하세요.

---

## 📄 파일 목록

| 파일 | 내용 |
|------|------|
| [**API_SPEC.md**](API_SPEC.md) | 상세 API 명세서 (요청/응답 예시 포함) |

---

## 📡 API 개요

### Base URL
```
http://localhost:8000/api/v1
```

### 엔드포인트 목록

| Method | Path | 설명 | 용도 |
|--------|------|------|------|
| GET | `/health` | 서버 상태 확인 | 헬스 체크, 모니터링 |
| POST | `/analyze` | 단일 텍스트 분석 | 디버깅, 테스트 |
| POST | `/analyze/batch` | **배치 분석** ⭐ | **게임 서버 연동** |

---

## 🔮 저주 스택 시스템

### 심각도별 스택 증가량

| 심각도 | 라벨 | Confidence | 스택 증가량 | 예시 |
|--------|------|------------|-------------|------|
| **1** | `critical` | 80% 이상 | **+5** | 씨발, 개새끼 |
| **2** | `severe` | 50~80% | **+3** | 짜증나, 닥쳐 |
| **3** | `mild` | 10~50% | **+1** | 바보, 멍청이 |
| **0** | `clean` | 10% 미만 | **0** | 안녕하세요 |

### 배치 내 누적 규칙
> **중요**: 배치 내 모든 부정어가 **각각** 스택에 누적됩니다!

```
예시: ["바보야", "멍청이", "씨발"]

├── "바보야"   → severity 3 (mild)     → +1
├── "멍청이"   → severity 3 (mild)     → +1
├── "씨발"     → severity 1 (critical) → +5
└── total_stack_delta = 7
```

---

## ⭐ 핵심 API: 배치 분석

### 요청
```http
POST /api/v1/analyze/batch
Content-Type: application/json

{
    "texts": ["야 바보야", "씨발"]
}
```

### 응답
```json
{
    "results": [
        {
            "text": "야 바보야",
            "is_negative": true,
            "label": "악플/욕설",
            "confidence": 0.165,
            "severity": 3,
            "severity_label": "mild",
            "stack_delta": 1
        },
        {
            "text": "씨발",
            "is_negative": true,
            "label": "악플/욕설",
            "confidence": 0.918,
            "severity": 1,
            "severity_label": "critical",
            "stack_delta": 5
        }
    ],
    "total_count": 2,
    "negative_count": 2,
    "total_stack_delta": 6
}
```

### 게임 서버 연동
```java
// 게임 서버에서 AI 응답 처리
BatchResponse response = aiClient.analyzeBatch(texts);
int stackDelta = response.getTotalStackDelta();  // 6

team.addCurseStack(stackDelta);  // 팀 스택에 +6 추가
if (team.getCurseStack() >= 10) {
    triggerCurse(team.getRandomPlayer());  // 저주 발동!
}
```

---

## 🔗 관련 문서

- [API_SPEC.md](API_SPEC.md) - **상세 API 명세** (요청/응답 전체 필드)
- [../README.md](../README.md) - 전체 개요 및 원리
- [../app/README.md](../app/README.md) - 소스 코드 설명
- [../tests/README.md](../tests/README.md) - 테스트 도구

---

## 🖥️ Swagger UI

서버 실행 후 브라우저에서 접속:

```
http://localhost:8000/docs
```

- 대화형 API 테스트 가능
- 요청/응답 스키마 자동 문서화
- 예시 값 제공
