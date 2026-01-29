# 🛠️ Git 문제 해결 및 트러블슈팅 가이드

이 문서는 Git 작업 중 흔히 발생하는 상황에 대한 해결 방법을 정리한 가이드입니다.

---

## 1. 🔄 원격 저장소 기준으로 로컬 코드 초기화 (Reset)

로컬에서 작업하던 내용이 꼬였거나, 모든 변경 사항을 버리고 **원격(Remote) 브랜치의 상태와 100% 동일하게** 만들고 싶을 때 사용합니다.

### 🛠️ 작업 순서

1.  **원격의 최신 상태 가져오기**
    ```bash
    git fetch origin
    ```

2.  **원격 브랜치 기준으로 강제 리셋**
    ```bash
    # 현재 체크아웃된 브랜치 기준으로 원격 상태에 맞춤
    git reset --hard origin/$(git rev-parse --abbrev-ref HEAD)

    # 특정 브랜치(예: dev-backend) 기준으로 맞추고 싶을 때
    git reset --hard origin/dev-backend
    ```

3.  **추적되지 않는 파일(Untracked files)까지 삭제**
    `reset --hard`는 Git이 추적 중인 파일만 건드립니다. 새로 생성한 파일이나 폴더까지 싹 지우려면 아래 명령어가 필요합니다.
    ```bash
    # 지워질 파일 목록 미리 확인 (Dry run)
    git clean -fdn

    # 실제 강제 삭제
    git clean -fd
    ```

---

## 2. 🗑️ Git 삭제 관련 명령어 모음

### 로컬 및 원격 브랜치 삭제
```bash
# 로컬 브랜치 삭제 (병합되지 않은 내용이 있어도 강제 삭제)
git branch -D 브랜치명

# 원격 브랜치 삭제
git push origin --delete 브랜치명
```

### 스테이징 취소 (Unstage)
`git add`를 잘못 했을 때, 파일의 변경 사항은 남겨두고 index(staging area)에서만 내립니다.
```bash
git restore --staged <파일명>
```

### 마지막 커밋 취소
```bash
# 커밋만 취소하고 내용은 남겨둠 (Soft reset)
git reset --soft HEAD~1

# 커밋과 내용을 모두 삭제 (Hard reset)
git reset --hard HEAD~1
```

---

## ⚠️ 주의사항

*   **`--hard`와 `clean -fd`**: 이 명령어들은 로컬의 작업 내역을 **영구적으로 삭제**합니다. 휴지통으로 복구할 수 없으니 실행 전 중요 파일이 있는지 꼭 확인하세요!
*   **환경 설정 파일**: `.env`나 `docker-compose.override.yml` 처럼 로컬 전용 설정 파일이 `git clean`으로 인해 지워질 수 있으니 주의가 필요합니다.
