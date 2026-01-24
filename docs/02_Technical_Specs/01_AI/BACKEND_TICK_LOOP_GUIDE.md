# ⚙️ 백엔드 구현 가이드: Authoritative Tick Loop (Spring Boot 3)

백엔드 개발자분께 이 가이드를 전달해 주세요. 일반적인 REST API(요청-응답) 방식이 아닌, **게임 엔진 타입의 실시간 루프**를 구축하는 가이드입니다.

---

## 1. 아키텍처 개요 (Concept)

일반적인 웹은 유저가 부를 때만 서버가 답하지만, 게임 서버는 **유저가 부르지 않아도 스스로 60Hz(초당 60번)로 계속 돌아가며** 세상을 업데이트해야 합니다.

```mermaid
graph TD
    subgraph Client
        C[User Input] -->|WebSocket| S
    end
    subgraph Server (Spring Boot)
        S[WebSocket Handler] -->|Enqueue| Q[Input Queue]
        T[Tick Loop Thread] -->|Read| Q
        T -->|Update| State[Global Game State]
        T -->|Broadcast| All[All Clients via WS]
    end
```

---

## 2. 백엔드 개발자를 위한 핵심 구성 요소

### ① Game State (세상의 상태)
- 모든 유저의 X, Y 좌표, 상태(독 걸림 여부 등)를 담는 객체입니다.
- **구현 팁**: `ConcurrentHashMap` 등을 사용하여 스레드 안전하게 관리하거나, 단일 스레드 루프 내에서만 수정되도록 설계합니다.

### ② Input Queue (명령어 대기열)
- 유저들이 보내는 "나 점프함", "나 움직임" 같은 메시지(Packet)를 일단 담아두는 바구니입니다.
- **구현 팁**: `ConcurrentLinkedQueue`를 사용하여 순서대로 담습니다.

### ③ The Tick Loop (사령탑 루프)
- 일정한 간격(예: 33ms = 30fps)으로 작동하는 타이머입니다.
- **Spring 구현 방식**:
  - `ScheduledExecutorService` (가장 정밀함, 권장)
  - `@Scheduled` (60fps 수준의 정밀도는 떨어질 수 있음)
  - **Java 21 Virtual Threads**: 대규모 접속자 대응에 매우 유리합니다.

### ④ Broadcast (동기화 전파)
- 루프가 한 번 돌 때마다(Tick), 업데이트된 Game State를 모든 유저에게 다시 쏘아주는 과정입니다.

---

## 3. 샘플 코드 구조 (Conceptual)

```java
public class GameLoop {
    // 1. 상태 저장소
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Queue<InputEvent> inputQueue = new ConcurrentLinkedQueue<>();

    // 2. 틱 루프 시작 (초당 30번)
    public void start() {
        ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
        executor.scheduleAtFixedRate(this::tick, 0, 33, TimeUnit.MILLISECONDS);
    }

    private void tick() {
        // A. 입력 처리 (Consume Queue)
        while (!inputQueue.isEmpty()) {
            processInput(inputQueue.poll());
        }

        // B. 물리/로직 연산 (Update State)
        updateGamePhysics();

        // C. 결과 전파 (Broadcast)
        broadcastGameState();
    }
}
```

---

## 4. 백엔드 팀원에게 이렇게 말해 보세요! (One-minute Pitch)

> "우리가 만드는 건 단순한 웹이 아니라 **'모두가 같은 화면을 봐야 하는 게임'**이야. 그래서 우리가 요청을 보낼 때만 백엔드가 계산하는 게 아니라, **백엔드에 초당 30번씩 돌아가는 시계(Loop)**를 만들고, 모든 판정(점프 가능 여부, 독 걸림)을 그 시계가 돌 때 백엔드에서 직접 계산해 줘야 해. 이게 바로 **Authoritative(백엔드 권위) 방식**이고, 이더넷 지연을 해결하는 업계 표준이야!"

---

## 5. AI 통신 인터페이스 (FE-BE Protocol)

이 부분은 백엔드 개발자님이 구현해야 할 **'Packet 명세'**입니다. 브라우저 단 AI로부터 "판정 결과"를 받는 부분입니다.

### ① 전송 시나리오
1.  **Frontend (AI)**: "야 감지" -> 백엔드에 전송
2.  **Backend (Loop)**: 해당 유저에게 **'독 버프'** 부여
3.  **Backend (Broadcast)**: 모두에게 "A 유저 독 걸림!" 전파

### ② 패킷 구조 (JSON 예시)
백엔드에서 이 형태의 데이터를 받을 수 있도록 DTO를 설계해야 합니다.

**FE -> BE (Report)**
```json
{
  "type": "AI_REPORT",
  "subtype": "TOXIC_DETECTION",
  "payload": {
    "text": "야 이 바보야!",
    "probability": 0.95,
    "category": "hate_speech"
  }
}
```

**BE -> FE (Broadcast)**
```json
{
  "type": "GAME_EVENT",
  "subtype": "STATUS_POISONED",
  "payload": {
    "targetUserId": "user_123",
    "duration": 5.0
  }
}
```

### ③ 백엔드 개발자가 해야 할 일
- **WebSocketHandler**에서 `AI_REPORT` 타입의 메시지를 파싱하는 로직 추가.
- 파싱된 결과를 **GameEngine(Tick Loop)**에 전달하여 유저 상태값(`isPoisoned = true`) 변경.
- 다음 **Tick**에서 변경된 상태가 담긴 `GameState` 패킷을 브라우저들에게 브로드캐스팅.

---

### 💡 사용자님께 드리는 팁
백엔드 개발자님이 "AI 서버랑 직접 통신해야 하는 거 아냐?"라고 물으시면, **"AI 서버(FastAPI)는 아예 안 쓰거나 프론트에서 직접 쏠 거니까, 백엔드는 프론트에서 보내주는 '판정 결과 패킷'을 잘 받아서 게임 로직(독 걸림 등)만 처리해 주면 돼!"**라고 답해 주세요.
