# 🖐️ 모션 인식 구현 계획 (MediaPipe Local Browser)

> Git 충돌 방지를 위해 **신규 파일만** 생성했습니다.

---

## ⚠️ Git 충돌 상태

| 파일 | 충돌 여부 |
|------|----------|
| `App.tsx` | ❌ 수정 안 함 |
| `src/services/motion/*` | ✅ 신규 (충돌 없음) |
| `src/pages/motion-test/*` | ✅ 신규 (충돌 없음) |
| `public/motion-test.html` | ✅ 신규 (충돌 없음) |
| `package.json` | ⚠️ 1줄 추가 (`@mediapipe/tasks-vision`) |

---

## 🧪 테스트 방법

```bash
npm run dev
# 브라우저에서 접속:
# http://localhost:5173/motion-test.html
```

1. **[MediaPipe 초기화]** 클릭
2. **[카메라 시작]** 클릭 (권한 허용)
3. **[감지 시작]** 클릭
4. **👆엄지 + 👉검지 끝 붙이기** → 💖

---

## 🔗 통합 방법 (팀과 합칠 때)

`App.tsx`에 5줄 추가:
```tsx
import MotionTestPage from './pages/motion-test/MotionTestPage';

// App() 맨 위에
if (window.location.hash === '#motion-test') {
  return <MotionTestPage />;
}
```

---

## WebSocket 패킷 (백엔드 연동 시)

```json
{
  "type": "MOTION_REPORT",
  "subtype": "HEART_DETECTION",
  "payload": { "label": "hand_heart", "score": 0.95 }
}
```

---

## 📚 관련 가이드 문서
- [06_GESTURE_DETECTION_GUIDE.md](./06_GESTURE_DETECTION_GUIDE.md) : 제스처 감지 원리
- [07_MOTION_IMPLEMENTATION_PLAN.md](./07_MOTION_IMPLEMENTATION_PLAN.md) : 현재 구현 계획
- [08_GAME_INTEGRATION_GUIDE.md](./08_GAME_INTEGRATION_GUIDE.md) : 게임 페이지 통합 방법
- [09_CAMERA_ADJUSTMENT_GUIDE.md](./09_CAMERA_ADJUSTMENT_GUIDE.md) : 카메라 조정 가이드
- [10_CONFLICT_AND_MERGE_GUIDE.md](./10_CONFLICT_AND_MERGE_GUIDE.md) : **Git 충돌 및 머지 가이드 (필독)**
