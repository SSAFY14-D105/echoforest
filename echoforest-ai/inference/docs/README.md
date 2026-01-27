# 📂 `docs/` - API 명세서

AI 서버의 API 인터페이스 문서입니다.

> 전체 개요는 [../README.md](../README.md)를 참조하세요.

---

## 📄 파일 목록

| 파일 | 내용 |
|------|------|
| `API_SPEC.md` | 상세 API 명세서 (요청/응답 예시 포함) |

---

## 📡 핵심 API 요약

### 배치 분석 (게임 서버 호출용) ⭐

```http
POST /api/v1/analyze/batch
Content-Type: application/json

{
    "texts": ["야 바보야", "씨발"]
}
```

**응답:**
```json
{
    "results": [...],
    "total_count": 2,
    "negative_count": 2,
    "total_stack_delta": 6
}
```

게임 서버는 `total_stack_delta`만 팀 스택에 더하면 됩니다!

---

## 🔗 관련 문서

- [API_SPEC.md](API_SPEC.md): 상세 API 명세
- [../README.md](../README.md): 전체 개요 및 원리
- [../app/README.md](../app/README.md): 소스 코드 설명
