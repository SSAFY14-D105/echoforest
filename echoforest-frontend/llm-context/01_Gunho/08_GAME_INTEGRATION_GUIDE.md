# 🎮 게임 페이지에 모션 인식 연결하기

## 현재 상황

- `App.tsx`: 이미 로그인/로비 스킵하게 수정됨 ✅
- `MotionCamera`: 컴포넌트 준비됨 ✅  
- `GamePage.tsx`: 여기만 수정하면 됨!

---

## 📝 GamePage.tsx 수정 가이드

### 1단계: import 추가
`
app.tsx 파일 맨 위에 추가:
```
import { MotionCamera } from '../../components/MotionCamera';
```

---

### 2단계: P1 카메라 영역 변경

**찾을 위치** (40~42줄 근처):
```tsx
<div className={cameraOn ? styles.cameraContent : styles.cameraOff}>
  {cameraOn ? `P1 (나: ${nickname})` : '📹'}
</div>
```

**변경 후**:
```tsx
<div className={styles.cameraContent}>
  {cameraOn ? (
    <MotionCamera 
      onGestureDetected={(gesture) => {
        console.log('🎯 제스처:', gesture.type, gesture.confidence);
        // TODO: 나중에 WebSocket 연동
        // websocket.send({ type: 'MOTION_REPORT', payload: gesture });
      }}
    />
  ) : (
    <div className={styles.cameraOff}>📹</div>
  )}
</div>
```

---

## 🧪 테스트

1. `npm run dev` (이미 실행 중이면 저장만 해도 자동 리로드)
2. `http://localhost:5173` 접속
3. P1 카메라 칸에 **내 카메라** 보임!
4. ✊주먹, 👌OK, ✌️V 하면 이모지 팝업!

---

## ⚠️ Git 충돌 주의

| 파일 | 상태 | 충돌 |
|------|------|------|
| `components/MotionCamera/*` | 신규 | ❌ 없음 |
| `GamePage.tsx` | 수정 | ⚠️ 가능 |

**팀원과 합칠 때**: GamePage.tsx 변경사항 미리 공유하기!

---

## 🔗 나중에 WebSocket 연동할 때

```tsx
// GamePage.tsx
import { gameWebSocket } from '../../game/websocket/GameWebSocket';

<MotionCamera 
  onGestureDetected={(gesture) => {
    if (gesture.type !== 'none') {
      gameWebSocket.send({
        type: 'MOTION_REPORT',
        payload: { label: gesture.type, score: gesture.confidence }
      });
    }
  }}
/>
```

---

## 📁 관련 파일

- `src/components/MotionCamera/MotionCamera.tsx` - 카메라 + 제스처 감지
- `src/services/motion/` - MediaPipe 로직 (npm 패키지용)
- `public/motion-test.html` - 독립 테스트 페이지
