# EchoForest Map Construction Manual

이 문서는 EchoForest 게임의 Tiled 맵 제작 가이드입니다. `MapManager.ts`를 통해 로딩되며, 코드 수정 없이도 새로운 맵을 추가하고 기믹을 배치할 수 있습니다.

**주요 업데이트 사항 (2025.1)**
- 오브젝트 **회전(Rotation)** 보정 로직 추가 (Tiled와 동일한 회전 적용 확인 완료)
- **Respawn** 포인트 시각화 및 설정 방법 명확화
- **Group Layer** 및 중첩 레이어 완전 지원

---

## 1. 기본 맵 설정 (Map Structure)

### 1.1. Tiled 프로젝트 설정
- **Format**: JSON (`.tmj`)
- **Orientation**: Orthogonal (직교)
- **Tile Size**: 16 x 16 px (게임 적용 시 4배 확대되어 64px로 렌더링됨)
- **Layer Format**: Base64 (zlib/gzip) 또는 CSV

### 1.2. 레이어 계층 및 명명 규칙
가독성을 위해 **Group Layer** 사용을 권장합니다.

```
- World (Group)
  - Collision (Tile Layer) -> 이름이 'Tile' 또는 'tiles'여야 충돌 자동 적용
  - Decorations (Tile Layer) -> 장식용 (충돌 없음)
  - Gimmicks (GroupLayer) -> 오브젝트 레이어들 정리용
    - Spawns (Object Layer)
    - Springs (Object Layer, class: Spring)
```

> [!IMPORTANT]
> **충돌(Collision) 레이어**: `MapManager`는 다음 조건 중 하나를 만족하는 레이어만 물리 충돌체로 변환합니다.
> 1. 레이어 이름이 **`Tile`** 또는 **`tiles`**인 경우 (대소문자 구분 없음)
> 2. 레이어 Custom Property에 **`collides: true`**가 설정된 경우
> 3. 레이어 Class가 **`Solid`**인 경우

> 3. 레이어 Class가 **`Solid`**인 경우

### 1.3. 배경 화면 설정 (Map Background)
맵의 배경 이미지를 설정하려면 Scene 코드에서 `MapManager.initialize` 호출 시 세 번째 인자로 이미지 키를 전달해야 합니다.

```typescript
// 예시: LobbyScene.ts
this.mapManager.initialize('tiles_tileset', 'tiles_tileset', 'background_image');
```

- **배경 이미지 파일**: `public/assets/backgrounds/` 폴더에 위치해야 합니다.
- **코드 연결**: Scene의 `preload()`에서 이미지를 로드하고, `initialize()`에서 해당 키를 사용합니다.

---

## 2. 오브젝트 배치 및 회전 (Rotation Rules)

Tiled 에디터와 파이저(Phaser) 엔진은 **회전 축(Pivot Point)** 처리 방식이 다릅니다. 현재 게임은 이 차이를 자동으로 보정하므로, **Tiled 에디터에서 보이는 그대로** 배치하면 됩니다.

### 2.1. 기준점(Pivot)의 차이 이해
맵 제작 시 아래 기준점을 참고하면 미세 조정에 도움이 됩니다.

| 오브젝트 타입 | Tiled 기준점 (Pivot) | 설명 |
| :--- | :--- | :--- |
| **Tile Object** (이미지) | 좌측 하단 (Bottom-Left) | 타일셋에서 드래그하여 배치한 이미지형 오브젝트<br>회전 시 좌측 하단 모서리를 축으로 회전합니다. |
| **Shape Object** (도형) | 좌측 상단 (Top-Left) | 사각형(Rectangle) 그리기 도구로 배치한 오브젝트<br>회전 시 좌측 상단 모서리를 축으로 회전합니다. |

### 2.2. 회전(Rotation) 적용 팁
- **정확한 배치**: Tiled에서 90도/180도 회전 기능을 사용하여 배치하세요. 게임 내에서 자동으로 중심점을 다시 계산하여 정확한 위치에 렌더링합니다.
- **오차 발생 시**: 만약 위치가 이상하다면, 해당 오브젝트가 'Tile'인지 'Shape'인지 확인하고 의도한 위치에 Pivot이 있는지 확인하세요.

---

## 3. 주요 기믹 가이드 (Gimmicks)

### 3.1. Respawn (시작점/부활점)

이제 Respawn 포인트는 단순 데이터가 아니라 **게임 내에서 시각적으로 보이는 오브젝트**로 처리됩니다.

- **배치 방법**: 'Tile Object'로 배치 (타일셋 이미지를 오브젝트 레이어에 드래그)
- **필수 속성**:
    - `playerIndex` (int): 특정 플레이어 전용 (0: P1, 1: P2...)
    - `isDefault` (bool, 체크박스): True면 기본 스폰 지점으로 사용
- **주의 사항**:
    - **크기**: Tiled에서 작게 보여도 게임 내에서는 4배 확대되어 정상 크기로 나옵니다.
    - **이미지**: 타일셋에 있는 깃발 아이콘 등을 사용하면 직관적입니다.

### 3.2. GhostPlatform (아래에서 위로 통과되는 발판)

- **배치 방법**: **Tile Layer**에 타일을 찍고, 해당 레이어의 속성(Properties)에서 Class를 `GhostPlatform`으로 설정.
- **작동 원리**: 로딩 시 타일 이미지는 사라지고, 동일한 위치에 물리 효과가 있는 플랫폼 기믹이 생성됩니다.
- **최적화**: 가로로 이어진 타일들은 자동으로 하나의 긴 플랫폼으로 병합됩니다.

### 3.3. Goal & Lock (도착점 및 잠금장치)

- **Goal**:
    - **`requiredPlayers`** (int): 문을 열기 위해 필요한 플레이어 수 (Solo맵은 반드시 1로 설정).
    - **`targetGoalId`** (string): 연결된 자물쇠가 있다면 해당 자물쇠의 `targetGoalId`와 일치시켜야 함. (자물쇠가 열리면 이 Goal이 활성화됨)
- **Lock**:
    - **`doorId`** (string): 열쇠(Key)와 매칭되는 ID.
    - **`targetGoalId`** (string): 해금 시 활성화시킬 Goal의 ID.

---

## 4. 타입 지정 (Type Inference Priority)

게임이 오브젝트가 어떤 기믹인지 판단하는 우선순위는 다음과 같습니다.

1. **Explicit Class/Type**: 오브젝트 설정에서 `Class` 또는 `Type` 필드 입력 (가장 권장)
2. **Layer Class**: 부모 레이어의 `Class` 속성 상속 (예: 'Springs' 레이어의 class를 `Spring`으로 설정)
3. **Name Inference**: 오브젝트 이름에 `Spring`, `Spike` 등이 포함되면 자동 추론

**권장 사항**: 가능한 오브젝트의 `Class` 속성에 정확한 기믹 이름(예: `Respawn`, `Spring`, `Goal`)을 입력하세요.

---

## 5. 자주 묻는 질문 (Troubleshooting)

**Q. 맵을 수정했는데 게임에 반영이 안 됩니다.**
A. `public/assets/maps/` 경로에 `.tmj` 파일이 정확히 저장되었는지, 브라우저 캐시가 남아있는지 확인하세요.

**Q. 플레이어가 바닥을 뚫고 떨어집니다.**
A. 바닥 레이어의 이름이 `Tile` 또는 `tiles`인지 확인하세요. 아니라면 `collides: true` 속성을 추가해야 합니다.

**Q. 오브젝트 이미지가 너무 작게 나옵니다.**
A. `MapManager`가 자동으로 4배 확대를 적용하지만, 버그가 의심되면 개발팀에 제보해주세요. (Respawn 오브젝트 스케일 버그는 2025.1 버전에서 수정됨)
