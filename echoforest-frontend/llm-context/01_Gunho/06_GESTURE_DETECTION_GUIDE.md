# 🖐️ MediaPipe 제스처 인식 개념 정리

## 1. MediaPipe가 주는 데이터

MediaPipe Hand Landmarker는 **21개의 손 관절 좌표**를 줍니다.

```
손가락 끝 (TIP):  4, 8, 12, 16, 20
손가락 중간(PIP): 3, 7, 11, 15, 19
손가락 뿌리(MCP): 2, 5, 9, 13, 17
손목 (WRIST):     0
```

### 좌표계
```
(0,0) ─────────────────→ x (1.0)
  │
  │   카메라 화면
  │
  ↓
y (1.0)
```

- `x`: 0(왼쪽) ~ 1(오른쪽)
- `y`: 0(위) ~ 1(아래)
- `z`: 손목 기준 깊이 (카메라에 가까울수록 -)

---

## 2. 제스처 판별 원리

### ✊ 주먹 (Fist)
```
원리: 모든 손가락 끝(TIP)이 뿌리(MCP)보다 손목에 가까움
```
```javascript
// 손가락이 접혀 있으면 true
function isFingerClosed(landmarks, tipIdx, mcpIdx) {
  const wrist = landmarks[0];
  const tip = landmarks[tipIdx];
  const mcp = landmarks[mcpIdx];
  
  return distance(tip, wrist) < distance(mcp, wrist) * 1.1;
}
```

### 👌 동그라미/OK (Circle)
```
원리: 엄지 끝(4)과 검지 끝(8)이 가까이 붙음
      + 나머지 손가락은 펴져 있음
```
```javascript
function detectOK(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  // 엄지-검지 거리
  const dist = distance(thumbTip, indexTip);
  const palmSize = distance(landmarks[0], landmarks[9]);
  
  return (dist / palmSize) < 0.2;  // 손바닥 대비 20% 이하
}
```

---

## 3. 핵심 함수

### 거리 계산
```javascript
function distance(p1, p2) {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 +
    (p1.y - p2.y) ** 2 +
    (p1.z - p2.z) ** 2
  );
}
```

### 손가락 펴짐 확인
```javascript
function isFingerExtended(landmarks, tipIdx, pipIdx, mcpIdx) {
  const wrist = landmarks[0];
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  
  // 끝이 중간마디보다 손목에서 멀면 = 펴짐
  return distance(tip, wrist) > distance(pip, wrist);
}
```

---

## 4. 인덱스 빠른 참조

| 손가락 | TIP | PIP | MCP |
|--------|-----|-----|-----|
| 엄지 | 4 | 3 | 2 |
| 검지 | 8 | 7 | 5 |
| 중지 | 12 | 11 | 9 |
| 약지 | 16 | 15 | 13 |
| 새끼 | 20 | 19 | 17 |

---

## 5. 우리 게임에서 쓸 제스처

| 제스처 | 용도 | 감지 조건 |
|--------|------|----------|
| ✊ 주먹 | 테스트용 | 5개 손가락 모두 접힘 |
| 👌 OK | 테스트용 | 엄지+검지 붙음 |
| 💖 손하트 | 스킬 발동 | OK + 나머지 손가락 펴짐 |
