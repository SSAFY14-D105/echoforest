# EchoForest AI Server - API 명세서

> **4인 협동 게임 저주 스택 시스템 지원**

## 📡 Base URL
```
http://localhost:8000/api/v1
```

---

## 🔍 엔드포인트 목록

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 서버 상태 확인 |
| POST | `/analyze` | 단일 텍스트 분석 + 스택 증가량 |
| POST | `/analyze/batch` | **배치 분석 + 총 스택 증가량 (핵심!)** |

---

## 🔮 저주 스택 시스템

AI 서버는 부정어 분석 결과와 함께 **스택 증가량**을 계산하여 반환합니다.

| 심각도 | 라벨 | Confidence | 스택 증가량 |
|--------|------|------------|-------------|
| **1** | `critical` | 80% 이상 | **+5** |
| **2** | `severe` | 50~80% | **+3** |
| **3** | `mild` | 10~50% | **+1** |
| **0** | `clean` | 10% 미만 | 0 |

> **중요**: 배치 내 모든 부정어가 **각각** 스택에 누적됩니다!

---

## 1️⃣ 서버 상태 확인

### Request
```http
GET /api/v1/health
```

### Response
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu"
}
```

---

## 2️⃣ 배치 분석 (핵심 API) ⭐

게임 서버는 5초마다 플레이어 발화를 모아서 이 API를 호출합니다.

### Request
```http
POST /api/v1/analyze/batch
Content-Type: application/json

{
  "texts": ["야 바보야", "너 멍청이다", "씨발"]
}
```

### Response
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
      "text": "너 멍청이다",
      "is_negative": true,
      "label": "악플/욕설",
      "confidence": 0.346,
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
  "total_count": 3,
  "negative_count": 3,
  "total_stack_delta": 7
}
```

### 게임 서버 처리 예시
```java
// 게임 서버에서 AI 응답 처리
BatchResponse response = aiClient.analyzeBatch(texts);
int stackDelta = response.getTotalStackDelta();  // 7

team.addCurseStack(stackDelta);  // 팀 스택에 +7 추가
if (team.getCurseStack() >= 10) {
    Player target = team.getRandomPlayer();
    triggerCurse(target, currentMap);  // 저주 발동!
}
```

---

## 3️⃣ 단일 텍스트 분석

### Request
```http
POST /api/v1/analyze
Content-Type: application/json

{
  "text": "씨발"
}
```

### Response
```json
{
  "text": "씨발",
  "is_negative": true,
  "label": "악플/욕설",
  "confidence": 0.918,
  "severity": 1,
  "severity_label": "critical",
  "stack_delta": 5,
  "all_scores": {
    "여성/가족": 0.02,
    "남성": 0.01,
    "성소수자": 0.01,
    "인종/국적": 0.01,
    "연령": 0.01,
    "지역": 0.01,
    "종교": 0.01,
    "기타 혐오": 0.03,
    "악플/욕설": 0.918,
    "clean": 0.05
  }
}
```

---

## 📝 예시 테스트 결과

| 입력 텍스트 | severity | severity_label | stack_delta | 설명 |
|-------------|----------|----------------|-------------|------|
| "씨발" | 1 | critical | **+5** | 91.8% - 강한 욕설 |
| "죽어버려" | 1 | critical | **+5** | 88.5% - 폭력적 표현 |
| "짜증나" | 2 | severe | **+3** | 75.1% - 불만 표현 |
| "닥쳐" | 2 | severe | **+3** | 64.0% - 비속어 |
| "멍청이" | 3 | mild | **+1** | 34.6% - 경미한 비하 |
| "미치겠다" | 3 | mild | **+1** | 27.5% - 관용적 표현 |
| "안녕하세요" | 0 | clean | **0** | 7.8% - 정상 발화 |

---

## 🛠️ 프론트엔드/게임서버 연동 예시

### TypeScript (프론트엔드)
```typescript
interface BatchResponse {
  results: SentimentResponse[];
  total_count: number;
  negative_count: number;
  total_stack_delta: number;  // 핵심!
}

const response = await axios.post<BatchResponse>(
  `${AI_SERVER_URL}/api/v1/analyze/batch`,
  { texts: ['바보야', '멍청이', '씨발'] }
);

console.log(`총 스택 증가: ${response.data.total_stack_delta}`);  // 7
```

### Java (게임 서버)
```java
@Data
public class BatchResponse {
    private List<SentimentResponse> results;
    private int totalCount;
    private int negativeCount;
    private int totalStackDelta;  // 핵심!
}
```

---

## ⚠️ 에러 응답

### 400 Bad Request
```json
{
  "detail": "texts 필드가 필요합니다"
}
```

### 500 Internal Server Error
```json
{
  "detail": "모델 추론 중 오류 발생"
}
```
