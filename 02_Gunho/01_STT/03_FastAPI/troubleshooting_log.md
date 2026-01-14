# 🛠️ 라이브러리 설치 트러블슈팅 로그 (Troubleshooting Log)

**목표**: `faster-whisper` (AI 모델) 및 `FastAPI` (웹 서버) 환경 구축
**결과**: 진행 중 (마지막 수정 단계)

---

## 📅 시도 및 해결 과정 (Timeline)

### 1~4단계 (요약)
*   `av` 빌드 에러로 인해 **Hybrid 방식** (Conda로 `av` 설치, 나머지는 Pip) 채택.

### 5단계: 환경 활성화 실수 (Human Error ⚠️)
*   **상황**: 위 4단계 명령어 실행 시 `conda activate ai-server`를 명시하지 않음.
*   **결과**: 모든 라이브러리가 격리된 공간(`ai-server`)이 아니라 **기본 공간(`base`)**에 설치됨.
*   **증상**:
    *   `base`에서는 잘 깔린 것처럼 보임.
    *   정작 `ai-server`를 켜고 서버를 실행하면 `ModuleNotFoundError` (라이브러리 없음) 발생.
*   **해결책**:
    *   터미널 명령어를 보낼 때 반드시 `conda activate ai-server &&`를 붙여서 **"이 방에 들어가서 설치해!"**라고 명확히 지시함.

---

## 💡 결론 및 교훈
1.  **Windows + Python** 환경에서 C++ 관련 라이브러리(`av`, `numpy` 등)는 **Conda**로 설치하는 게 정신 건강에 이롭다.
2.  부득이하게 Pip을 써야 할 때는 **"Hybrid 방식"** (Conda로 뼈대 잡고 Pip으로 살 붙이기)이 유용하다.
3.  **가상환경(Conda)**을 쓸 때는 항상 내가 **"어느 방에 있는지"** 확인하거나, 명령어에 방 이름을 명시해야 한다.
