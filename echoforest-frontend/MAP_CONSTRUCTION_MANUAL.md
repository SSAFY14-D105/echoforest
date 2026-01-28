# EchoForest Map Construction Manual

이 문서는 EchoForest 게임의 맵을 Tiled 에디터로 제작하고 게임에 적용하는 방법을 설명합니다. `MapManager` 시스템을 통해 맵 로딩이 자동화되었으며, 특정 규칙을 따르면 코드를 수정하지 않고도 새로운 기믹과 지형을 추가할 수 있습니다.

## 1. 맵 구조 (Map Structure)

새로운 시스템은 Tiled의 **Group Layer**와 **Custom Properties (Class)**를 적극 활용합니다.

### 1.1. 기본 설정
-   **Tile Size**: 16x16 px (게임 내에서는 4배 확대되어 64x64로 적용됨)
-   **Orientation**: Orthogonal
-   **Format**: JSON (`.tmj`)

### 1.2. 레이어 계층 구조 (Hierarchy)
맵은 크게 **Tile Layers**와 **Object Layers**로 나뉩니다. 가독성을 위해 관련 있는 레이어들은 **Group Layer**로 묶는 것을 권장합니다.

#### 예시 구조
```
- World (Group)
  - Collision (Tile Layer, class: Solid)
  - Decorations (Tile Layer)
  - Gimmicks (Group)
    - Springs (Object Layer, class: Spring)
    - Keys (Object Layer, class: Key)
  - Platforms (Group)
    - GhostPlatforms (Tile Layer, class: GhostPlatform)
```

#### 4. Advanced Features & Troubleshooting

### 4.1. Group Layer Support (New)
- **Recursive Loading**: The game now supports unlimited nesting of Group Layers.
  - You can organize your map with folders (Group Layers) for better readability in Tiled.
  - All Tile Layers inside groups will be rendered automatically.
  - All Object Layers inside groups will be parsed for gimmicks.

### 4.2. Class & Type Inference
If you forget to set the `Class` or `Type` property on an Object Layer or Object, the game attempts to infer it from the **Name**:
- Name contains "spring" -> `Spring`
- Name contains "spike" -> `Spike`
- Name contains "platform" -> `GhostPlatform`

**Best Practice**: Always set the `Class` property explicitly to avoid ambiguity.

### 4.3. Legacy Support
- **Collision**: If a Tile Layer is named **"tiles"**, it will automatically have collisions enabled, even without the `Solid` class or `collides` property. This maintains compatibility with older maps.

### 4.4. Ghost Platforms
- **Optimization**: Ghost Platform tiles are automatically merged horizontally to reduce physics body count.
- **Rendering**: They are rendered as individual GameObjects or TileSprites based on the layer data.

## 5. Summary of Workflow
1. Create Map in Tiled (16x16 grid).
2. Organize layers (Background, Walls, Gimmicks).
3. Set `Class` properties for specific behaviors (`Solid`, `GhostPlatform`).
4. Place Objects for interactive elements (Spawns, Goals, Springs).
5. Export as JSON (`.tmj`).
6. Load in Phaser Scene using `MapManager`.

## 2. 타일 레이어 (Tile Layers)

타일 레이어는 지형과 배경을 그리는 데 사용됩니다.

### 2.1. 일반 충돌체 (Solid)
-   **방법 1 (속성)**: 타일셋(Tileset)에서 해당 타일에 `collides: true` 커스텀 속성을 추가합니다.
-   **방법 2 (레이어 클래스)**: 레이어 자체의 Custom Property에 `class: Solid` 또는 `type: Solid`를 설정합니다. 이 레이어의 모든 타일은 충돌체로 간주됩니다.
-   **자동 최적화**: 인접한 충돌 타일들은 게임 로딩 시 자동으로 하나의 큰 물리 바디로 병합됩니다 (Greedy Merging).

### 2.2. 고스트 플랫폼 (GhostPlatform)
플레이어가 아래에서 위로 통과할 수 있는 플랫폼입니다.
-   **설정 방법**: Tile Layer의 Custom Property에 `class: GhostPlatform`을 설정합니다.
-   **작동 원리**: 게임 로딩 시 해당 레이어의 타일들은 **시각적으로 숨겨지고**, 동일한 위치와 모양을 가진 `GhostPlatform` 기믹 객체로 자동 변환됩니다.
-   **장점**: 타일을 찍는 것처럼 쉽게 플랫폼을 배치할 수 있습니다.

## 3. 오브젝트 레이어 (Object Layers)

기믹(Gimmick), 스폰 포인트, 몬스터 등 상호작용 가능한 객체는 Object Layer에 배치합니다.

### 3.1. 타입 지정 (Type Inference)
객체의 타입을 결정하는 우선순위는 다음과 같습니다.

1.  **객체 자체의 Type/Class**: Object를 선택하고 `Type` 또는 `Class` 필드에 기믹 이름을 입력 (예: `Spring`).
2.  **부모 레이어의 Class**: Object Layer 자체의 Custom Property에 `class`를 설정 (예: 레이어 이름을 'Spikes'로 짓고 `class: Spike` 설정). 내부의 모든 객체는 해당 타입이 됩니다.
3.  **GID/이름 추론**: 위 설정이 없으면 GID나 이름(`Spawn` 등)을 보고 자동으로 추론합니다.

### 3.2. 지원되는 기믹 목록 및 속성

각 기믹은 필요한 커스텀 속성(Custom Properties)을 가질 수 있습니다.

| 기믹 타입 (Class) | 설명 | 필수/선택 속성 |
| :--- | :--- | :--- |
| `Spawn` / `SpawnPoint` | 플레이어 시작 위치 | `playerIndex` (int): 플레이어 번호<br>`isDefault` (bool): 기본 스폰 여부 |
| `Goal` | 도착 지점 (깃발) | `requiredPlayers` (int): 필요 인원<br>`targetGoalId` (string): 자물쇠와 연결 시 ID |
| `Key` | 열쇠 | `doorId` (string): 연결될 자물쇠 그룹 ID |
| `Lock` | 자물쇠 (문) | `doorId` (string): 열쇠와 매칭될 ID<br>`targetGoalId` (string): 해금 시 활성화될 골 ID |
| `Spring` | 점프 스프링 | - |
| `Spike` | 가시 (닿으면 사망) | - |
| `Bumper` | 튕겨내는 범퍼 | - |
| `MovingBumper` | 움직이는 범퍼 | `targetX`, `targetY` (int): 이동 목표 좌표<br>`speed` (float): 속도<br>`power` (float): 튕김 파워 |
| `Elevator` | 엘리베이터 | `targetY` (int): 이동 목표 Y좌표<br>`requiredPlayers` (int): 작동 필요 인원 |
| `MovableBlock` | 밀 수 있는 블록 | `requiredPlayers` (int): 미는데 필요한 인원<br>`targetBlockId` (string): 버튼으로 소환될 경우 ID |
| `BlockButton` | 블록 소환 버튼 | `targetBlockId` (string): 소환할 블록 ID<br>`spawnX`, `spawnY` (int): 소환 위치 |
| `TriggerButton` | 트리거 버튼 | `targetId` (string): 작동 시킬 대상 ID |
| `Signboard` | 표지판 | `message` (string): 표시할 텍스트 |

## 4. 제약 사항 및 팁

1.  **좌표계**: Tiled의 좌표(x, y)는 게임 내에서 `MapScale` (기본 4배) 만큼 확대되고, 화면 하단 정렬을 위해 `offsetY`가 보정됩니다. 따라서 Tiled에서 보이는 비율과 게임 내 비율은 같지만, 절대 좌표값은 다릅니다.
2.  **객체 이름**: `id` 속성은 Tiled가 자동 생성하는 ID를 사용하므로, 특정 로직(Link 등)을 위해 고유한 식별자가 필요하다면 `name` 속성보다는 커스텀 속성(`doorId` 등)을 활용하는 것이 명확합니다.
3.  **배경**: 배경 이미지는 `MapManager.initialize` 호출 시 키를 전달하면 자동으로 타일링됩니다.

## 5. 적용 방법 (코드)

새로운 맵 파일(`new_map.tmj`)을 만들었다면:

1.  `public/assets/maps/`에 파일 저장.
2.  Scene 파일(`NewStageScene.ts`)에서 로드:
    ```typescript
    preload() {
        this.load.tilemapTiledJSON('new_map', 'assets/maps/new_map.tmj');
        // ... 타일셋 로드
    }

    create() {
        this.mapManager = new MapManager(this, 'new_map');
        this.mapManager.initialize('tileset_name', 'tileset_key', 'bg_key');
        super.create();
    }
    ```
