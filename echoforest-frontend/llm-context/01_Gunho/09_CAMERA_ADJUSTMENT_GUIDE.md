# 📹 카메라 위치/크기 조정 가이드

## 문제

P1 카메라에서 머리 윗부분만 보이는 경우 (머리털만 보임!)

---

## 수정 가능한 파일들

| 파일 | 역할 | 충돌 위험 |
|------|------|----------|
| `components/MotionCamera/MotionCamera.module.css` | 영상 위치 | ❌ 없음 |
| `components/MotionCamera/MotionCamera.tsx` | 해상도 | ❌ 없음 |
| `pages/game/GamePage.module.css` | 박스 크기 | ⚠️ 공용 |

---

## ✅ 해결 방법 1: 영상 위치 조정 (권장)

### 파일: `components/MotionCamera/MotionCamera.module.css`

```css
.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  object-position: center top;  /* 👈 추가! 위쪽이 보임 */
}
```

| object-position | 효과 |
|-----------------|------|
| `center center` | 가운데 (기본) |
| `center top` | 위쪽 (머리 보임) |
| `center 20%` | 위에서 20% 지점 |

---

## ✅ 해결 방법 2: 카메라 해상도 변경

### 파일: `components/MotionCamera/MotionCamera.tsx` (137줄 근처)

```tsx
const stream = await navigator.mediaDevices.getUserMedia({
  video: { 
    width: 320, 
    height: 180,   // 👈 16:9 비율로 변경
    facingMode: 'user' 
  }
});
```

| 비율 | width x height |
|------|----------------|
| 4:3 | 320 x 240 |
| 16:9 | 320 x 180 |
| 1:1 | 240 x 240 |

---

## ⚠️ 공용 파일 수정 시 (FE 팀원과 상의)

### 파일: `pages/game/GamePage.module.css`

P1 카메라 박스 크기 조정:
```css
.cameraBox {
  aspect-ratio: 4 / 3;  /* 비율 변경 */
}
```

---

## 🔧 빠른 테스트

1. `MotionCamera.module.css` 수정
2. 저장 → 자동 리로드
3. 게임 페이지에서 카메라 확인
