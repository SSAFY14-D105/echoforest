# EchoForest AI Server - API 명세서

## 📡 Base URL
```
http://localhost:8000/api/v1
```

---

## 🔍 엔드포인트 목록

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 서버 상태 확인 |
| POST | `/analyze` | 단일 텍스트 부정어 분석 |
| POST | `/analyze/batch` | 다중 텍스트 배치 분석 |

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

## 2️⃣ 텍스트 분석 (핵심 API) ⭐

### Request
```http
POST /api/v1/analyze
Content-Type: application/json

{
  "text": "분석할 텍스트"
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

## 3️⃣ 배치 분석

### Request
```http
POST /api/v1/analyze/batch
Content-Type: application/json

{
  "texts": ["안녕하세요", "짜증나", "멍청이"]
}
```

### Response
```json
{
  "results": [
    {
      "text": "안녕하세요",
      "is_negative": false,
      "label": "clean",
      "confidence": 0.92,
      "severity": 0,
      "severity_label": "clean"
    },
    {
      "text": "짜증나",
      "is_negative": true,
      "label": "악플/욕설",
      "confidence": 0.751,
      "severity": 2,
      "severity_label": "severe"
    },
    {
      "text": "멍청이",
      "is_negative": true,
      "label": "악플/욕설",
      "confidence": 0.346,
      "severity": 3,
      "severity_label": "mild"
    }
  ]
}
```

---

## 🎚️ 심각도 단계 (Severity Level)

| severity | severity_label | Confidence 범위 | 게임 패널티 |
|----------|----------------|-----------------|-------------|
| **1** | `critical` | 80% 이상 | 🔴 최강 저주 (맵 대폭 어려워짐) |
| **2** | `severe` | 50% ~ 80% | 🟠 강한 저주 (속도 감소 + 장애물) |
| **3** | `mild` | 17.4% ~ 50% | 🟡 약한 저주 (경미한 패널티) |
| **0** | `clean` | 17.4% 미만 | ✅ 정상 (패널티 없음) |

---

## 📝 예시 테스트 결과

| 입력 텍스트 | severity | severity_label | 설명 |
|-------------|----------|----------------|------|
| "씨발" | 1 | critical | 91.8% - 강한 욕설 |
| "죽어버려" | 1 | critical | 88.5% - 폭력적 표현 |
| "짜증나" | 2 | severe | 75.1% - 불만 표현 |
| "닥쳐" | 2 | severe | 64.0% - 비속어 |
| "멍청이" | 3 | mild | 34.6% - 경미한 비하 |
| "미치겠다" | 3 | mild | 27.5% - 관용적 표현 |
| "안녕하세요" | 0 | clean | 7.8% - 정상 발화 |

---

## 🛠️ 프론트엔드 연동 예시

```typescript
// src/apis/sttApi.ts
import axios from 'axios';

const AI_SERVER_URL = 'http://localhost:8000';

export interface AnalyzeResponse {
  text: string;
  is_negative: boolean;
  label: string;
  confidence: number;
  severity: 0 | 1 | 2 | 3;
  severity_label: 'clean' | 'critical' | 'severe' | 'mild';
}

export const analyzeNegativeWord = async (text: string): Promise<AnalyzeResponse> => {
  const response = await axios.post(`${AI_SERVER_URL}/api/v1/analyze`, { text });
  return response.data;
};
```

---

## ⚠️ 에러 응답

### 400 Bad Request
```json
{
  "detail": "text 필드가 필요합니다"
}
```

### 500 Internal Server Error
```json
{
  "detail": "모델 추론 중 오류 발생"
}
```
