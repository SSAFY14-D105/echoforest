# 🚀 Git Rebase 가이드 (Notion 업로드용)

이 가이드는 `origin/dev-frontend`의 최신 코드를 현재 작업 브랜치(`feature/fe/motion-recognition`)에 안전하게 병합하기 위한 절차를 설명합니다.

---

## 1. 전제 조건 (Prerequisites)
작업 중인 모든 사항이 **커밋**되어 있거나 **스태시(Stash)** 되어 있어야 합니다.
```bash
git add .
git commit -m "chore: save before rebase"
# 또는
git stash
```

## 2. 절차 (Step-by-Step)

### Step 1: 베이스 브랜치 최신화
공통 브랜치로 이동하여 원격 저장소의 최신 내용을 가져옵니다.
```bash
# 1. 공통 브랜치 이동
git checkout dev-frontend

# 2. 최신 코드 다운로드
git pull origin dev-frontend
```

### Step 2: 내 브랜치로 리베이스 실행
내 브랜치의 베이스를 최신 `dev-frontend`로 옮깁니다.
```bash
# 3. 내 작업 브랜치 이동
git checkout feature/fe/motion-recognition

# 4. 리베이스 실행
git rebase dev-frontend
```

### Step 3: 충돌 해결 (Conflict)
충돌이 발생한 경우에만 수행합니다. (발생하지 않으면 Step 4로 이동)
1. VS Code에서 `<<<< HEAD` 표시된 충돌 파일을 수정합니다.
2. 수정한 파일을 스테이징합니다.
   ```bash
   git add .
   ```
3. 리베이스를 재개합니다.
   ```bash
   git rebase --continue
   ```
   *(충돌이 여러 개일 경우 이 과정을 반복합니다)*

### Step 4: 원격 저장소 동기화
리베이스 후에는 히스토리가 바뀌었으므로 **강제 푸시**가 필요합니다.
```bash
# 5. 안전한 강제 푸시
git push origin feature/fe/motion-recognition --force-with-lease
```

---

## 3. Git Graph 확인하기 (시각화)
리베이스 전후로 내 브랜치의 위치를 터미널에서 시각적으로 확인할 수 있습니다.

```bash
# 그래프 확인 명령어
git log --graph --oneline --all --decorate -n 15
```

### 💡 그래프 읽는 법
- `(HEAD -> feature/fe/motion-recognition)`: 현재 내가 있는 브랜치의 위치
- `(origin/dev-frontend, dev-frontend)`: 공통 개발 브랜치의 최신 위치
- **리베이스 전**: 내 브랜치가 `dev-frontend`의 이전 커밋에서 갈라져 나와 있음
- **리베이스 후**: 내 브랜치가 `dev-frontend`의 **최신 커밋 바로 위**로 위치가 옮겨짐

---

## ⚠️ 주의 사항 및 꿀팁

- **리베이스 취소**: 과정 중 꼬였다면 언제든 취소하고 처음으로 돌아갈 수 있습니다.
  ```bash
  git rebase --abort
  ```
- **왜 머지(Merge)가 아닌 리베이스(Rebase)인가요?**: 
  - 커밋 히스토리를 한 줄로 깔끔하게 관리할 수 있습니다.
  - 불필요한 "Merge branch..." 커밋이 생기지 않습니다.
- **실수 방지**: `git push --force` 대신 `git push --force-with-lease`를 사용하면, 내가 모르는 사이 남이 푸시한 코드가 있을 때 푸시를 막아주어 안전합니다.
