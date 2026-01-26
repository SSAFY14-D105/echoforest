# 🎮 Cat Mario 스프라이트 & 타일 가이드

> 최종 업데이트: 2026-01-25
> 작성자: AI 분석 결과

## 📋 개요

Cat Mario 게임의 캐릭터 스프라이트, 타일 크기, 이미지 경로 등 에셋 관련 정보를 정리한 문서입니다.

---

## 🖼️ 캐릭터 스프라이트

### 이미지 위치
```
public/assets/sprites/
├── blue_player/
│   ├── blue_death.png
│   ├── blue_jump.png
│   ├── blue_standing.png
│   └── blue_walking.png
├── green_player/
│   └── (동일 구조)
├── orange_player/
│   └── (동일 구조)
└── purple_player/
    └── (동일 구조)
```

### 이미지 크기
| 파일명 | 캔버스 크기 | 실제 캐릭터 크기 | 비고 |
|--------|------------|-----------------|------|
| `{color}_standing.png` | 96 x 96 px | ~32 x 48 px | 단일 프레임 |
| `{color}_walking.png` | 192 x 96 px | ~32 x 48 px x 2 | 2프레임 스프라이트시트 |
| `{color}_jump.png` | 96 x 96 px | ~32 x 48 px | 단일 프레임 |
| `{color}_death.png` | 96 x 96 px | ~32 x 48 px | 단일 프레임 |

### 코드에서 로드하는 방법
```typescript
// src/phaser/utils/AnimationHelper.ts 참조
const colors = ['green', 'blue', 'orange', 'purple'];
colors.forEach(color => {
    const folder = `${color}_player`;
    scene.load.image(`player_${color}_standing`, `assets/sprites/${folder}/${color}_standing.png`);
    scene.load.image(`player_${color}_jump`, `assets/sprites/${folder}/${color}_jump.png`);
    scene.load.image(`player_${color}_death`, `assets/sprites/${folder}/${color}_death.png`);
    scene.load.image(`player_${color}_walking_raw`, `assets/sprites/${folder}/${color}_walking.png`);
});
```

---

## 🧱 타일 크기

### cat_mario_stage.tmj 맵 설정
| 항목 | 값 | 설명 |
|------|-----|------|
| **맵 타일 크기** | 60 x 60 px | 게임 내 1칸 크기 (Tiled에서 설정) |
| **타일셋 원본 크기** | 16 x 16 px | 실제 도트 이미지 크기 |
| **맵 크기 (타일)** | 40 x 12 | 가로 40칸, 세로 12칸 |
| **맵 크기 (픽셀)** | 2400 x 720 px | 40 * 60, 12 * 60 |

### ⚠️ 중요: 60px는 표준이 아님!
- 60px는 팀원이 Tiled 맵 에디터에서 **임의로 설정**한 값
- 원래 슈퍼 마리오나 고양이 마리오의 표준 크기가 아님
- 다른 맵 파일들은 16px 또는 18px 사용 중

### 타일셋 위치
```
public/assets/tilesets/
├── 01 Colourful Platformer - Normal Tileset.png  (320 x 320 px, 16px 타일)
├── tilemap-characters.png
└── tilemap.png
```

---

## 📺 게임 해상도 (고정)

### 기본 설정
| 항목 | 값 | 위치 |
|------|-----|------|
| **고정 해상도** | 1920 x 1080 px | `CatMarioPhaserGame.tsx` |
| **스케일 모드** | FIT (비율 유지) | Phaser.Scale.FIT |
| **최소 지원** | 960 x 540 px | 절반 크기까지 축소 |

### 작은 화면에서의 동작
- 1920x1080보다 작은 화면: 검은색 레터박스로 비율 유지
- 960x540보다 작은 화면: 지원하지 않음 (최소 사양)

---

## 📏 타일 & 캐릭터 크기 (1080p 기준)

### 현재 설정 (CatMarioPlayer.ts)
```typescript
// 1920x1080, 12타일 높이 → 1080 / 12 = 90px
const CAT_MARIO_PLAYER_SIZE = 72;       // 물리 바디 크기 (타일의 80%)
const SPRITE_ORIGINAL_SIZE = 96;        // 스프라이트 캔버스 크기 (px)
const targetVisualSize = 90;            // 화면에 표시될 크기 (px)
```

### 크기 계산
```
타일 크기 = 1080 / 12 = 90px
스케일 = targetVisualSize / SPRITE_ORIGINAL_SIZE = 90 / 96 ≈ 0.9375
```

### 4인용 크기표
| 해상도 | 타일 크기 | 캐릭터 크기 | 4인 나란히 |
|--------|----------|------------|-----------|
| 1920 x 1080 | 90px | 90px | 360px (화면 18.75%) |

---

## 🎬 애니메이션 키

### 생성된 애니메이션 (AnimationHelper.ts)
| 키 형식 | 사용 프레임 |
|---------|------------|
| `player_idle_{color}` | standing 이미지 1프레임 |
| `player_walk_{color}` | walking 이미지 2프레임 (6fps, 반복) |
| `player_jump_{color}` | jump 이미지 1프레임 |
| `player_dead_{color}` | death 이미지 1프레임 |

### 사용 예시
```typescript
sprite.play('player_idle_green');
sprite.play('player_walk_blue');
```

---

## 📁 관련 파일 경로

### 씬 파일
- `src/phaser/scenes/CatMarioScene.ts` - Cat Mario 전용 씬
- `src/phaser/scenes/BaseGameScene.ts` - 공통 게임 씬 (참고용)

### 엔티티 파일
- `src/phaser/entities/catmario/CatMarioPlayer.ts` - Cat Mario 전용 플레이어
- `src/phaser/entities/Player.ts` - 공통 플레이어 (참고용)

### 유틸리티
- `src/phaser/utils/AnimationHelper.ts` - 애니메이션 생성/로드 함수

### 맵 파일
- `public/assets/maps/cat_mario_stage.tmj` - Cat Mario 스테이지 맵

---

## ⚠️ 주의사항

1. **이미지 경로 오류 방지**
   - ❌ `/assets/characters/` - 존재하지 않는 경로
   - ✅ `assets/sprites/{color}_player/` - 올바른 경로

2. **스프라이트시트 프레임 크기**
   - standing/jump/death: 단일 이미지 (프레임 분할 불필요)
   - walking: 2프레임 스프라이트시트 (AnimationHelper에서 자동 분할)

3. **맵 타일 크기 변경 시**
   - `cat_mario_stage.tmj`의 `tilewidth/tileheight` 수정
   - `CatMarioPlayer.ts`의 `targetVisualSize` 동일하게 수정 필요

---

## 📝 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-25 | 최초 작성. 528px 잘못된 참조 수정, 96px 도트 이미지 적용 |
| 2026-01-25 | 1920x1080 고정 해상도 적용, 크기 조정 가이드 추가 |

---

## 🎛️ 크기 조정 가이드

게임 느낌을 조정하려면 아래 파일들의 값을 수정하세요.

### 1️⃣ 타일 크기 조정

**파일:** `src/phaser/scenes/CatMarioScene.ts`  
**라인:** 44

```typescript
const targetTileSize = 16;   // 타일 한 칸의 픽셀 크기
```

| 값 | 설명 | 세로 타일 수 (1080p) |
|----|------|---------------------|
| 16 | 원본 크기 (매우 작음) | 67칸 |
| 32 | 2배 확대 | 33칸 |
| 48 | 3배 확대 | 22칸 |
| 64 | 4배 확대 (권장) | 17칸 |
| 90 | 동적 계산 기본값 | 12칸 |

---

### 2️⃣ 캐릭터 크기 조정

**파일:** `src/phaser/entities/catmario/CatMarioPlayer.ts`

#### 물리 바디 크기 (라인 4)
```typescript
const CAT_MARIO_PLAYER_SIZE = 32;  // 충돌 판정 크기
```

#### 원본 이미지 크기 (라인 5)
```typescript
const SPRITE_ORIGINAL_SIZE = 32;   // 실제 도트 크기 (캔버스 96px 중 도트 부분)
```

#### 화면 표시 크기 (라인 60)
```typescript
const targetVisualSize = 32; // 화면에 보이는 실제 크기
```

**권장:** 세 값을 동일하게 맞추면 물리 판정이 정확함

| 크기 | 타일 대비 | 느낌 |
|------|----------|------|
| 16px | 1칸 | 작은 마리오 |
| 32px | 2칸 | 큰 마리오 (표준) |
| 48px | 3칸 | 거대 마리오 |

---

### 3️⃣ 카메라 줌 (선택사항)

원본 크기를 유지하면서 화면을 확대하고 싶다면:

**파일:** `src/phaser/scenes/CatMarioScene.ts`  
**위치:** `create()` 함수 끝부분에 추가

```typescript
this.cameras.main.setZoom(4);  // 4배 확대
```

| 줌 배율 | 16px 타일 → | 32px 캐릭터 → |
|--------|------------|--------------|
| x2 | 32px | 64px |
| x3 | 48px | 96px |
| x4 | 64px | 128px |
| x5 | 80px | 160px |

---

### 4️⃣ 권장 조합

| 조합 | 타일 크기 | 캐릭터 크기 | 카메라 줌 | 특징 |
|------|----------|------------|----------|------|
| A (현재) | 16px | 32px | 없음 | 매우 작음 |
| B | 64px | 128px | 없음 | 큰 화면 |
| C | 16px | 32px | x4 | 원본 비율 유지 |
| D | 32px | 64px | x2 | 균형잡힌 크기 |

---

### 5️⃣ 맵 파일 좌표 스케일링

맵 파일(`cat_mario_stage.tmj`)의 좌표는 60px 기준입니다.  
코드에서 자동으로 스케일링됩니다:

```typescript
const scaleFactor = targetTileSize / mapTileSize;  // 16 / 60 = 0.267
```

**주의:** 맵 파일을 수정하면 이 비율도 확인 필요!
