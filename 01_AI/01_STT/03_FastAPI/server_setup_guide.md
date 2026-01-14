# 📘 Python AI Server 구축 및 관리 가이드

이 문서는 AI Server (`03_FastAPI`) 환경 구축 과정에서 발생한 이슈들과 해결책, 그리고 서버 운영 방법을 정리한 매뉴얼입니다.

---

## 🛠️ 1. 트러블슈팅 로그 (우리가 겪은 문제들)

### 🚨 Issue 1: `av` 라이브러리 설치 실패
*   **증상**: `pip install av` 실행 시 `Failed to build wheel`, `Microsoft Visual C++ 14.0 required` 에러 발생.
*   **원인**: `av`는 C++로 만들어진 고성능 오디오 라이브러리인데, 윈도우에 C++ 컴파일러(빌드 도구)가 없어서 소스코드를 조립하지 못함.
*   **해결책**: **Conda**를 사용.
    *   Conda는 전문가들이 이미 조립해둔 **완제품(Binary)**을 제공하므로, 컴파일러 없이도 설치 가능.
    *   `conda install -c conda-forge av -y`

### 🚨 Issue 2: Base 환경 오염 및 Conda 고장
*   **증상**: `conda activate ai-server`를 안 하고 설치해서, 모든 라이브러리가 기본(`base`) 환경에 깔림. 이를 청소하다가 `requests`까지 지워서 Conda 명령어가 먹통이 됨.
*   **원인**: Conda도 파이썬 프로그램이라 `requests` 같은 내장 부품이 필요한데, 그걸 지워버림.
*   **해결책**:
    *   `python -m pip install requests` 명령어로 수동 복구.
    *   앞으로는 반드시 `conda activate ai-server` 후에 설치 진행.

### 🚨 Issue 3: 좀비 프로세스 & 포트 충돌 (CORS 에러의 진실)
*   **증상**: 클라이언트에서 `Access-Control-Allow-Origin` (CORS) 에러 또는 `Failed to fetch` 발생.
*   **원인**: 서버가 제대로 안 꺼지고 백그라운드에 5개나 켜져 있었음. 옛날 서버(좀비)가 요청을 가로채서 응답을 안 해줌.
*   **해결책**:
    *   확인: `tasklist | findstr python`
    *   사살: `taskkill //F //IM python.exe //T` (Git Bash에서는 `//` 슬래시 두 개 필수)

### 🚨 Issue 4: `ModuleNotFoundError: No module named 'app'`
*   **증상**: `uvicorn app.main:app` 실행 시 `app`을 못 찾겠다고 함.
*   **원인**: 명령어를 실행한 위치가 프로젝트 최상위 폴더(`01_S14P11D105`)였음. `app` 폴더는 그 안의 `03_FastAPI` 폴더 속에 들어있음.
*   **해결책**: `cd 02_Gunho/01_STT/03_FastAPI` 명령어로 **안방(작업 폴더)**까지 들어간 뒤 실행.

---

## 🚀 2. 서버 관리 명령어 (매뉴얼)

모든 명령어는 `Git Bash` 터미널 기준입니다.

### ✅ 서버 켜기 (Start)
가장 정석적인 방법입니다. (순서 중요!)

```bash
# 1. 작업 폴더로 이동 (이미 있다면 생략)
cd "C:\Users\SSAFY\Desktop\SSAFY\02_second_semester\05_Project\01_공통프로젝트\01_S14P11D105\02_Gunho\01_STT\03_FastAPI"

# 2. 환경 활성화 & 실행
conda activate ai-server
uvicorn app.main:app --reload
```
*   `--reload`: 코드를 수정하면 알아서 재시작해주는 옵션 (개발용).

### ✅ 서버 상태 확인 (Check)
서버가 켜져 있는지, 혹은 몰래 켜진 좀비가 있는지 확인할 때 씁니다.

```bash
tasklist | findstr python
```
*   **정상**: `python.exe`가 1~2개 정도 보임.
*   **비정상**: 아무것도 안 했는데 3개 이상 우르르 나옴 (좀비).

### ✅ 서버 끄기 (Stop)
1.  **정상 종료**: 터미널에서 `Ctrl + C`를 한 번(또는 두 번) 누르세요.
2.  **강제 종료 (말 안 들을 때)**:
    ```bash
    taskkill //F //IM python.exe //T
    ```
    *   주의: 켜져 있는 모든 파이썬 프로그램이 꺼집니다.

---

## 🧪 3. 테스트 방법

1.  서버를 켠다 (`uvicorn ...`)
2.  `03_FastAPI` 폴더 안에 있는 **`test_client.html`** 파일을 더블클릭해서 연다.
3.  **[🎙️ 녹음 시작]** 버튼 클릭 -> 말하기 -> **[🛑 녹음 종료]** 버튼 클릭.
4.  화면에 변환된 텍스트가 뜨면 성공! 🎉
