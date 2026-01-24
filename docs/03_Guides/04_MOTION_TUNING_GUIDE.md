# 🎭 모션 인식 튜닝 및 통합 가이드 (Motion Recognition Workflow)

이 문서는 AI 모델 튜닝 환경(`echoforest-ai`)과 프론트엔드 통합 환경(`echoforest-frontend`)의 차이를 이해하고, 병합 충돌 없이 효율적으로 협업하기 위한 가이드입니다.

---

## 1. 🏗️ 프로젝트 구조의 이해

우리 프로젝트는 **"실험실(AI)"**과 **"공장(Frontend)"**이 분리되어 있습니다.

### 🧪 실험실: `echoforest-ai/motion-model-test`
- **환경**: 순수 HTML + JavaScript (No React, No Build)
- **목적**: 오직 **"인식률 튜닝"**만을 위해 존재합니다.
- **장점**: 수정하고 새로고침하면 0.1초 만에 반영됨. (값 깎기에 최적)
- **파일 확장자**: `.js` (타입 검사 따위 없음, 자유로움)

### 🏭 공장: `echoforest-frontend`
- **환경**: React + TypeScript + Vite
- **목적**: 실제 사용자가 쓸 **"안정적인 제품"**을 만듭니다.
- **단점**: 빌드 과정이 필요하고, 문법이 엄격함. (실험하기엔 무거움)
- **파일 확장자**: `.tsx`, `.ts` (엄격한 타입 관리)

---

## 2. 💥 왜 병합 충돌이 나는가? (The Conflict)

현재 구조에서 새로운 모션(예: `Heart`, `V-Sign`, `Poke`)을 추가할 때 **필연적으로 충돌**이 발생합니다.

### 범인은 바로 `main.js` 🕵️‍♂️
모든 제스처가 등록되는 진입점 파일입니다.

```javascript
// A 개발자 (Heart 브랜치)
import HeartGesture from './gestures/HeartGesture.js';
manager.register(new HeartGesture());

// B 개발자 (V-Sign 브랜치)
import VSignGesture from './gestures/VSignGesture.js';
manager.register(new VSignGesture());
```

두 개발자가 **같은 파일(`main.js`)의 같은 위치(상단 import, 하단 register)**를 수정하기 때문에, Git은 *"어? 둘 다 건드렸네? 에라 모르겠다 충돌!"* 하고 멈추는 것입니다.

### 🛡️ 해결 전략
**"제스처 파일"만 건드리고, "등록 파일"은 건드리지 않는다.**

1. 각자 `gestures/` 폴더에 자기 파일(`MyLoopGesture.js`)만 만든다.
2. `main.js` 등록은 나중에 **통합 담당자(Integrator)**가 한 번에 몰아서 하거나, `gesture-manager.js`가 폴더를 스캔하는 식으로 변경해야 합니다. (하지만 JS 환경에선 스캔이 어려우므로, 수동 통합이 불가피함)

---

## 3. ⚙️ 실행 흐름 분석 (How it works)

모션 인식 샌드박스(`index.html`)가 어떻게 돌아가는지 알면 튜닝이 쉬워집니다.

1.  **초기화 (`main.js`)**
    *   `FilesetResolver`가 WASM 파일을 다운로드합니다.
    *   `HandLandmarker` 모델을 GPU 모드로 로드합니다.
2.  **카메라 루프 (`predictWebcam()`)**
    *   `requestAnimationFrame`으로 무한 반복합니다.
    *   웹캠의 현재 프레임을 캡처합니다.
3.  **인식 (`HandLandmarker.detectForVideo()`)**
    *   MediaPipe가 이미지에서 손 랜드마크 21개를 찾습니다.
    *   결과: `landmarks[0]`, `landmarks[1]` (왼손/오른손)
4.  **판별 (`GestureManager.detectAll()`)**
    *   등록된 모든 제스처(`Heart`, `V` 등)의 `.check()` 함수를 하나씩 실행해봅니다.
    *   가장 점수 높은 놈을 승자로 채택합니다.
5.  **렌더링 (`updateUI()`)**
    *   화면에 이모지와 점수를 뿌려줍니다.

---

## 4. 🚀 추천 워크플로우 (Best Practice)

가장 효율적으로 모션을 "깎고" -> "통합"하는 방법입니다.

### Step 1. 깎기 (Tuning) 🛠️
*   **어디서?**: `echoforest-ai` (JS 환경)
*   **어떻게?**:
    1.  `gestures/MyGesture.js` 파일을 만듭니다.
    2.  `threshold` 값(거리 0.15 → 0.1)을 바꿔가며 `index.html`에서 테스트합니다.
    3.  인식이 잘 되면 **그 파일(`MyGesture.js`)만 커밋**합니다. (`main.js`는 커밋하지 마세요! 충돌 남)

### Step 2. 이식 (Porting) 📦
*   **어디서?**: `echoforest-frontend` (TS 환경)
*   **누가?**: 프론트엔드 담당자
*   **어떻게?**:
    1.  완성된 `MyGesture.js`를 엽니다.
    2.  우리 프로젝트의 `gestureUtils.ts`에 로직을 번역해서 붙여넣습니다.
    3.  TypeScript 문법(`: number`, `: Landmark[]`)을 입혀줍니다.

**💡 결론**:
TS 환경에서 직접 튜닝하려고 하지 마세요. 빌드 되느라 속터집니다.
**"가벼운 JS 샌드박스에서 깎고, 완성품만 TS로 가져온다"**가 정답입니다.
