# 📚 `docs/` - API 명세서

AI 서버의 API 인터페이스 문서입니다.

---

## 📄 파일 구조

```
docs/
├── API_SPEC.md    # API 명세서 (본 저장소 핵심)
└── README.md      # 본 문서
```

---

## 📡 핵심 API

### 배치 분석 (게임 서버 호출용) ⭐

```http
POST /api/v1/analyze/batch
Content-Type: application/json

{
    "texts": ["야 바보야", "너 멍청이다", "씨발"]
}
```

**응답:**
```json
{
    "results": [...],
    "total_count": 3,
    "negative_count": 3,
    "total_stack_delta": 7
}
```

게임 서버는 `total_stack_delta` 값을 팀 저주 스택에 더하면 됩니다!

---

## 🔮 스택 시스템 요약

| 심각도 | 라벨 | 스택 증가량 |
|--------|------|-------------|
| 1 | `critical` | **+5** |
| 2 | `severe` | **+3** |
| 3 | `mild` | **+1** |
| 0 | `clean` | 0 |

---

## 🔗 관련 문서

- [API_SPEC.md](API_SPEC.md): 상세 API 명세
- [../README.md](../README.md): AI 서버 전체 개요
- [../app/README.md](../app/README.md): 소스 코드 설명
