# 💋 뽀뽀(Kiss) 제스처 인식 모듈

MediaPipe FaceLandmarker를 사용한 실시간 뽀뽀 제스처 인식 테스트 도구입니다.

## 📁 폴더 구조

```
kiss/
│  index.html          # 메인 테스트 페이지
│  README.md           # 이 파일
│
├─css/
│      style.css       # 스타일시트
│
└─js/
    │  gesture-manager.js   # 제스처 관리 클래스
    │  main.js              # 메인 스크립트
    │  viewfinder.js        # 카메라 뷰파인더
    │
    └─gestures/
            BaseGesture.js  # 제스처 기본 클래스
            Kiss.js         # 뽀뽀 제스처 감지
```

## 🚀 사용법

### 1. 로컬 서버 실행

ES 모듈을 사용하므로 로컬 서버가 필요합니다:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# VS Code Live Server 확장 사용
```

### 2. 브라우저에서 접속

```
http://localhost:8000/kiss/index.html
```

### 3. 테스트 순서

1. **1️⃣ 초기화** - MediaPipe FaceLandmarker 로드
2. **2️⃣ 카메라** - 웹캠 활성화
3. **3️⃣ 시작** - 실시간 감지 시작
4. **💋 뽀뽀** 포즈 취하기!

## 🎯 감지 알고리즘

### 입술 랜드마크
- **상순 중앙**: 인덱스 13
- **하순 중앙**: 인덱스 14
- **왼쪽 입꼬리**: 인덱스 61
- **오른쪽 입꼬리**: 인덱스 291

### 판정 기준
뽀뽀 포즈는 다음 두 조건을 만족해야 합니다:

| 조건 | 높은 확신도 | 중간 확신도 |
|------|------------|------------|
| 세로/가로 비율 | < 0.12 | < 0.15 |
| 가로 거리 | < 0.15 | < 0.18 |

## 🎚️ 임계값 조정

슬라이더로 실시간 조정 가능:
- **입술 비율 임계값**: 세로/가로 비율 최대값
- **입술 가로 최대값**: 입꼬리 간 거리 최대값
- **최소 신뢰도**: 감지 임계 신뢰도

## 📊 실시간 수치

- **입술 세로**: 상순-하순 간 거리
- **입술 가로**: 좌우 입꼬리 간 거리
- **세로/가로 비율**: 뽀뽀 판정의 핵심 지표
- **얼굴 감지**: 얼굴 인식 상태

## 🛠️ 확장하기

### 새 제스처 추가

1. `js/gestures/` 폴더에 새 클래스 파일 생성
2. `BaseGesture` 상속
3. `detect()` 메서드 구현
4. `gesture-manager.js`에 등록

```javascript
// js/gestures/MyGesture.js
import { BaseGesture } from './BaseGesture.js';

export class MyGesture extends BaseGesture {
    constructor() {
        super('myGesture', '🎉');
    }
    
    detect(faceLandmarks) {
        // 감지 로직 구현
        return { detected: false, score: 0, data: {} };
    }
}
```

## 📝 라이선스

프로젝트 라이선스를 따릅니다.
