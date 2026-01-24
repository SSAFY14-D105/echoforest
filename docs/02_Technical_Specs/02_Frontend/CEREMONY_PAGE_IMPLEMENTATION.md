# 🙏 세레머니 페이지 (CeremonyPage) 구현 및 연동 코드 분석

## 1. 개요
게임의 마지막 스테이지를 클리어한 후, **"팀원들이 모두 모여 승리를 자축하고 추억을 남기는"** 기능을 담당하는 페이지입니다. 

### 핵심 기능
1. **레이아웃 전환**: 게임 화면 대신 **4인의 화상 캠 화면**을 중앙에 크게 배치.
2. **미션 수행**: 모두 함께 특정 포즈(예: 손하트 ❤️)를 취해야 함.
3. **모션 인식**: `MotionDetector`가 포즈를 감지하면 카운트다운 시작.
4. **추억 저장**: 화면을 캡처(Screenshot)하여 이미지 파일로 저장.

---

## 2. 파일 구조 및 위치

기존 코드를 건드리지 않고 독립적으로 개발하기 위해 별도의 페이지로 분리되었습니다.

```bash
src/features/game/pages/
├── CeremonyPage.tsx        # 핵심 로직 (UI + 모션인식 + 캡처)
└── CeremonyPage.module.css # 전용 스타일 (애니메이션 포함)
```

---

## 3. 핵심 코드 분석 (`CeremonyPage.tsx`)

### 3.1 LiveKit 연결 및 비디오 설정
`LiveKitService` 싱글톤을 활용하여 연결 상태를 관리합니다.

```typescript
useEffect(() => {
    const initVideo = async () => {
        if (localVideoRef.current) {
            // Case 1: 게임에서 넘어옴 (이미 연결됨)
            if (liveKitService.isConnected) {
                liveKitService.setLocalVideoElement(localVideoRef.current);
            } 
            // Case 2: 개발 테스트용 (LiveKit 없이 로컬 캠만 사용)
            else {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                localVideoRef.current.srcObject = stream;
            }
        }
    };
    initVideo();
}, []);
```

### 3.2 모션 인식 및 트리거
`MotionDetector` 컴포넌트를 사용하여 실시간으로 제스처를 감지합니다.

```typescript
const handleGesture = (gesture: string) => {
    // 'posing' 단계에서만 인식
    if (step !== 'posing') return;

    // 'Heart' 또는 'Victory' 포즈 감지 시 카운트다운 시작
    if (gesture === 'Heart' || gesture === 'Victory') {
        startCountdown();
    }
};

// ... JSX 내부 ...
<MotionDetector
    externalVideoRef={localVideoRef}
    onGestureDetected={handleGesture}
    debugMode={true} // 스켈레톤 UI 표시 (테스트용)
/>
```

### 3.3 화면 캡처 (Canvas)
`html2canvas` 라이브러리를 사용하여 현재 DOM 요소를 이미지로 변환합니다.

```typescript
const triggerCapture = async () => {
    // 1. 플래시 효과 (번쩍!)
    setShowFlash(true);
    
    // 2. 찰칵 (DOM -> Canvas -> Image Data URL)
    const canvas = await html2canvas(containerRef.current, {
        allowTaint: true,
        useCORS: true, // 외부 이미지(LiveKit 비디오) 캡처 시 필수
    });
    
    // 3. 저장 및 상태 변경
    setCapturedImage(canvas.toDataURL('image/png'));
    setStep('captured');
};
```

---

## 4. 멀티플레이 확장 가이드 (TODO)

현재는 테스트를 위해 **내 화면(Local Player)**만 나오도록 되어 있습니다. 실제 4인 멀티플레이로 연동하려면 다음 부분을 `CameraArea.tsx` 로직과 합쳐야 합니다.

### 4.1 실제 플레이어 데이터 연동
`useGameStore`의 `players` 배열을 순회하며 비디오를 렌더링해야 합니다.

```typescript
// 현재 (테스트용 가상 데이터)
const displayPlayers = Array.from({ length: 4 }).map(...)

// 수정 후 (실제 데이터)
const { players } = useGameStore();

{players.map((player, index) => (
    <div key={player.id} className={styles.card}>
        {/* LiveKitService를 통해 해당 플레이어의 비디오 트랙 연결 */}
    </div>
))}
```

### 4.2 모션 인식 동기화 (Socket)
내가 포즈를 취했다고 바로 캡처하는 것이 아니라, **"우리 팀원 4명이 모두 하트를 만들었는가?"** 를 확인해야 합니다.

1. **Client**: 포즈 감지 -> `socket.emit('POSE_COMPLETE', { type: 'HEART' })` 전송.
2. **Server**: 방 안의 4명 전원이 메시지를 보냈는지 확인.
3. **Server**: 전원 성공 시 -> `socket.emit('START_CEREMONY_COUNTDOWN')` 브로드캐스트.
4. **Client**: 신호를 받으면 다같이 카운트다운 시작 및 캡처.

---

## 5. 테스트 방법

`App.tsx`에 테스트용 비밀 통로를 만들어 두었습니다.

1. 프로젝트 실행: `npm run dev`
2. 브라우저 접속: `http://localhost:5173/?test=ceremony`
3. 카메라 권한 허용 후 손하트 ❤️ 만들어보기.

---
> **작성일**: 2026-01-24
> **작성자**: Antigravity (AI Assistant)
