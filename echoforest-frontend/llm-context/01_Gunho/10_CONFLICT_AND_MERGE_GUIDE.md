# 📋 모션 인식 작업 파일 및 충돌 방지 가이드

지금까지 작업한 파일들의 목록과, 다른 팀원들과 합칠 때 충돌(Conflict)이 발생하기 쉬운 파일들에 대한 관리 전략입니다.

## 1. 작업 파일 목록

| 구분 | 파일 경로 | 용도 | 충돌 위험도 |
|------|----------|------|------------|
| **핵심 로직** | `src/services/motion/` 내부 파일들 | MediaPipe 설정 및 제스처 감지 엔진 | 🟢 낮음 (완전 분리됨) |
| **컴포넌트** | `src/components/MotionCamera/` | 재사용 가능한 카메라 컴포넌트 | 🟢 낮음 (신규 생성) |
| **테스트 도구** | `public/gesture-tuner.html` | 실시간 제스처 튜닝 대시보드 | 🟢 낮음 (독립적임) |
| **공용 설정** | `src/pages/game/GamePage.tsx` | 실제 게임 페이지 연동 | 🔴 **높음** (공용 파일) |
| **라우팅** | `src/App.tsx` | 테스트 페이지 연결 (임시 상시 삭제됨) | 🟡 중간 |

---

## 2. 충돌 위험 파일 관리 전략

### 🔴 GamePage.tsx (가장 조심해야 할 파일)
현재 게임 실행 메인 페이지이므로 여러 팀원이 동시에 수정할 가능성이 높습니다.
- **상황**: MotionCamera 컴포넌트를 import하고 화면에 배치할 때 발생.
- **해결책**: 
    1. `git pull origin develop`을 수시로 진행하여 최신 코드를 유지하세요.
    2. MotionCamera 연결 코드를 묶어서 주석과 함께 별도 블록으로 관리하세요.
    ```tsx
    {/* --- 모션 인식 영역 시작 --- */}
    <MotionCamera onGestureDetected={(g) => handleGesture(g)} />
    {/* --- 모션 인식 영역 끝 --- */}
    ```

### 🟡 App.tsx
- **상황**: 테스트를 위해 임시로 Route를 추가할 때 발생.
- **해결책**: 가능하면 `public/*.html` 파일을 직접 열어서 테스트하고, `App.tsx`는 마지막 배포 직전에만 최소한으로 수정하세요.

### 🟢 src/services/motion/ 및 src/components/MotionCamera/
- 이 파일들은 모션 인식 기능 전용이므로 충돌 가능성이 매우 낮습니다.
- 새로운 제스처 로직을 추가할 때 기존 코드를 수정하기보다 새로운 함수를 추가하는 방식으로 작업하면 안전합니다.

---

## 3. 합칠 때 주의사항 (Merge Strategy)

1. **Standalone 도구 활용**: `public/gesture-tuner.html`은 별도 파일이므로 다른 팀원들이 작업 중인 React 빌드에 전혀 영향을 주지 않습니다. 튜닝 결과값(`thresholds`)만 잘 기록해두세요.
2. **Type 정의 공유**: `src/services/motion/types.ts`에 공용 타입을 정의해두었으니, 백엔드 팀원과 연동할 때 이 파일의 구조를 참고하여 소통하세요.
3. **자원 정리**: `MotionCamera` 컴포넌트가 Unmount될 때 웹캠 스트림이 제대로 종료되도록 `useEffect` cleanup 로직을 확인해두었습니다.

---

> [!TIP]
> **Git 머지 시 충돌이 비정상적으로 많다면?**
> 본인의 `PoseDetector.ts`나 `MotionService.ts`는 본인이 작성한 내용이 무조건 맞으므로 `Accept Current Change`를 선택해도 안전하지만, `GamePage.tsx`는 팀원들의 최신 코드를 반드시 포함해야 하므로 신중하게 통합해야 합니다.
