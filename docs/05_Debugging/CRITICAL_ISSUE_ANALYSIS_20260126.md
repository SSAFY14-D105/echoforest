# 🐛 주요 잠재적 버그 및 아키텍처 위험 분석 보고서

> **작성일:** 2026-01-26
> **분석 대상:** EchoForest 전체 코드베이스 (Frontend, Backend, AI)
> **작성자:** Antigravity AI Assistant

코드 구조 및 핵심 로직 정밀 분석 결과, 서비스의 안정성과 성능에 심각한 영향을 미칠 수 있는 **4가지 핵심 위험 요소**가 식별되었습니다.

---

## 🚨 1. [AI] FastAPI 이벤트 루프 차단 (Critical)

**위치:** `echoforest-ai/inference/app/model.py` 및 라우터 핸들러

### 🔴 문제점
FastAPI 애플리케이션에서 `model.predict()`는 CPU/GPU를 점유하는 무거운 동기(Synchronous) 작업입니다. 현재 이 함수가 `async def`로 정의된 라우트 핸들러 내에서 직접 호출될 경우, **단일 요청 처리 중 서버의 메인 이벤트 루프(Event Loop)가 완전히 차단됩니다.**

*   **영향:** 한 명의 사용자가 감정 분석을 요청하면, 분석이 완료될 때까지 **다른 모든 사용자의 요청(Health check 포함)이 대기 상태(Hang)에 빠집니다.**

### ✅ 권장 수정 방안
1.  **스레드 풀 사용 (권장):** `asyncio.to_thread`를 사용하여 블로킹 연산을 별도 스레드로 격리해야 합니다.
    ```python
    # 수정 전
    result = model.predict(text)
    
    # 수정 후
    import asyncio
    result = await asyncio.to_thread(model.predict, text)
    ```
2.  **배치 처리 최적화:** 현재 `predict_batch`가 루프를 돌며 `predict`를 반복 호출하는 구조입니다. 모델(Hugging Face Transformers)이 지원하는 배치 추론 기능을 사용하여 `List[str]`을 한 번에 처리하도록 리팩토링해야 합니다.

---

## 2. [Backend] 물리 엔진 데드 코드 & 좀비 입력 처리

**위치:** `GameRoom.java` (Line 617 `processInputs`)

### 🔴 문제점
현재 서버의 메인 틱 루프(`run()`)에서 `updatePhysics(0.05)` 호출이 주석 처리되어 있어 물리 연산이 중단된 상태입니다. (Client-Authoritative 방식 채택으로 추정)
그러나 `processInputs()` 메서드는 여전히 활성화되어 있어, 클라이언트로부터 수신된 입력(점프, 이동 등)을 큐에서 꺼내 `PlayerState`에 반영하고 있습니다.

*   **영향:**
    *   **리소스 낭비:** 아무 효과 없는 로직이 매 틱마다 실행됩니다.
    *   **잠재적 버그:** 추후 물리 연산을 다시 활성화할 경우, 쌓여있거나 잘못 갱신된 `inputJump` 상태 등으로 인해 캐릭터가 순간이동하거나 튀어 오르는 사이드 이펙트가 발생할 수 있습니다.

### ✅ 권장 수정 방안
*   완전한 Client-Authoritative 구조라면 서버 측 입력 처리 로직(`processInputs`)을 제거하거나, 검증(Validation) 용도로만 제한적으로 사용하도록 변경해야 합니다.

---

## 3. [Frontend] 씬 초기화 레이스 컨디션 (Race Condition)

**위치:** `PhaserGame.tsx` (Line 103, 134)

### 🔴 문제점
React 컴포넌트와 Phaser 씬(Scene) 간의 데이터를 연결하기 위해 `setTimeout(..., 100)`을 사용하고 있습니다.

```typescript
// 씬 시작 후 0.1초 대기 후 함수 주입
setTimeout(() => {
    const scene = game.scene.getScene(startScene);
    if (scene) { ... }
}, 100);
```

*   **영향:** 저사양 기기나 브라우저 부하로 인해 씬 초기화(create)가 0.1초보다 늦어질 경우, **콜백 연결이 실패하여 게임이 멈추거나 React의 데이터가 Phaser로 전달되지 않는 치명적인 동기화 오류**가 발생합니다.

### ✅ 권장 수정 방안
*   **이벤트 기반 통신 도입:** `setTimeout`에 의존하는 대신, Phaser 씬의 `create()` 단계에서 "SceneReady" 이벤트를 발생시키고, React 측에서 이를 구독(Listener)하는 방식으로 변경해야 합니다.

---

## 4. [Backend] WebSocket 브로드캐스트 병목 (Slow Consumer Issue)

**위치:** `GameRoom.java` (Line 703 `broadcastState`)

### 🔴 문제점
게임의 메인 루프(Tick Loop) 내에서 모든 클라이언트에게 `sendMessage()`를 **동기(Synchronous)**로 수행하고 있습니다.

*   **영향:**
    *   만약 특정 클라이언트(A)의 네트워크 상태가 불안정하여 패킷 전송이 지연(Block)되면, **해당 시간만큼 서버 스레드가 멈춰 다른 모든 플레이어(B, C, D)의 게임 틱까지 함께 밀리게 됩니다.**
    *   결과적으로 한 명의 렉이 방 전체의 렉(Global Lag)을 유발합니다.

### ✅ 권장 수정 방안
*   **비동기 전송 도입:** 메시지 전송 로직을 별도의 스레드(ExecutorService)나 비동기 메서드(`@Async`)로 분리하여, 메인 게임 루프가 네트워크 I/O 지연의 영향을 받지 않도록 격리해야 합니다.
