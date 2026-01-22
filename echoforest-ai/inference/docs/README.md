# 📚 `docs/` - API 명세서 및 아키텍처 문서

AI 서버의 API 인터페이스와 게임 서버 연동 방식을 정의한 기술 문서입니다.

---

## 📄 파일 구조

### 1. `API_SPEC.md` - 기본 API 명세서
**목적**: AI 서버의 표준 REST API 인터페이스 정의

#### 주요 내용
- **엔드포인트 목록**: `/health`, `/analyze`, `/analyze/batch`
- **요청/응답 스키마**: JSON 형식 상세
- **심각도(Severity) 체계**: 4단계 분류 기준
- **프론트엔드 연동 예시**: TypeScript 코드 샘플

#### 핵심 API: `/api/v1/analyze`
```http
POST /api/v1/analyze
Content-Type: application/json

{ "text": "아 진짜 짜증나네" }
```

**응답**:
```json
{
  "is_negative": true,
  "label": "악플/욕설",
  "confidence": 0.35,
  "severity": 3,
  "severity_label": "mild"
}
```

#### 📊 심각도 단계 (업데이트됨)
| Level | Label | Confidence | Game Penalty |
|-------|-------|-----------|-------------|
| 0 | `clean` | < **10%** | 정상 |
| 3 | `mild` | **10~50%** | 약한 저주 |
| 2 | `severe` | 50~80% | 강한 저주 |
| 1 | `critical` | 80%+ | 최강 저주 |

---

### 2. `GAME_API_SPEC.md` - 게임 서버 통합 명세서
**목적**: AI 서버와 게임 서버 간 **비동기 하이브리드 아키텍처** 설계 문서

#### 주요 내용
- **아키텍처 다이어그램**: 프론트엔드-AI서버-게임서버 통신 흐름
- **모션 인식**: 프론트엔드(MediaPipe) → 게임 서버 (AI 미경유)
- **긍정어(부스터)**: 프론트엔드 키워드 매칭 → 게임 서버
- **부정어(욕설)**: 프론트엔드 → **AI 서버** → 게임 서버 (비동기)

#### 실시간 분석 API (v2 예정)
```http
POST /api/v1/analyze/realtime
{
  "text": "사용자 발화",
  "userId": "user_123",
  "sessionId": "session_456",
  "roomId": "room_789"
}
```

**내부 동작**:
1. 욕설 감지 → 프론트엔드에 즉시 응답
2. **비동기로** 게임 서버에 패널티 요청 (`POST /api/game/penalty`)

#### 게임 서버 패널티 API
```http
POST /api/game/penalty
X-AI-Server-Token: {SECRET}

{
  "userId": "user_123",
  "severity": 2,
  "confidence": 0.75
}
```

**응답**:
```json
{
  "success": true,
  "penaltyApplied": "speed_reduction",
  "warningCount": 2
}
```

---

## 🎯 자소서/포트폴리오 활용 포인트

### 1. 하이브리드 아키텍처 설계
**문제**: 모든 AI 처리를 서버에서 하면 비용과 지연시간 증가
**해결**: 
- **On-device(Client)**: 빠른 반응이 필요한 모션 인식, 긍정어 매칭
- **Server-side(AI)**: 보안이 중요한 욕설 탐지

**기술적 가치**: 
> "실시간 게임 특성을 고려하여, 각 AI 태스크의 latency 요구사항과 보안 수준에 따라 컴퓨팅 자원을 효율적으로 분배하는 **Edge-Cloud Hybrid 아키텍처**를 설계했습니다."

### 2. 비동기 처리로 응답 속도 최적화
**문제**: 게임 서버에 패널티 요청 후 응답 대기 시 UX 저하
**해결**: 
```python
# AI 서버 내부 (pseudo-code)
async def analyze_realtime(request):
    result = model.predict(request.text)
    
    # 1. 프론트엔드에 즉시 응답
    asyncio.create_task(
        send_penalty_to_game_server(...)  # 비동기 처리
    )
    return result  # 기다리지 않음
```

**기술적 가치**:
> "사용자 경험을 우선시하여 프론트엔드에는 50ms 이내로 즉시 응답하고, 게임 서버 연동은 백그라운드에서 비동기로 처리하는 **Non-blocking I/O 패턴**을 적용했습니다."

### 3. 데이터 기반 Threshold 최적화
**기존**: 논문/공식 권장값(17.4%) 사용
**개선**: 
- 실제 게임 음성 채팅 데이터(71개) 수집
- Threshold 0.05~0.30 구간 성능 측정
- **F1 Score 0.955 달성** (10% 선정)

**기술적 가치**:
> "Smilegate 공식 권장값에서 벗어나, 우리 서비스의 실제 사용 패턴을 반영한 데이터셋으로 **독자적인 최적화**를 수행하여 경미한 욕설 탐지율(Recall)을 15% 향상시켰습니다."

---

## 📋 문서 작성 원칙

1. **기술 용어 정의**: 모든 전문 용어에 간단한 설명 추가
2. **예시 코드 제공**: cURL, TypeScript, Python 모두 포함
3. **성능 지표 명시**: 응답 속도, F1 Score 등 수치 증빙
4. **시각적 다이어그램**: 아키텍처 흐름도 제공

---

## 🔗 관련 문서

- [../README.md](../README.md): AI 서버 전체 개요
- [../app/README.md](../app/README.md): 소스 코드 설명
- [../tests/README.md](../tests/README.md): 테스트 및 분석 도구
