// @ts-nocheck
import Phaser from 'phaser';
import { Key, Lock, Spring, BlockButton, Signboard, GhostPlatform, Elevator, MovableBlock, Respawn } from '../gimmicks';

/**
 * Tiled Map Parser 결과 타입
 */
export interface TiledParseResult {
    worldWidth: number;
    keys: Key[];
    locks: Lock[];
    springs: Spring[];
}

/**
 * Tiled JSON 맵 데이터를 파싱하여 게임 오브젝트 생성
 * @param scene - Phaser Scene
 * @param mapKey - 로드된 JSON 에셋 키
 * @param existingKeys - 기존 Key 배열 참조
 * @param existingLocks - 기존 Lock 배열 참조
 * @param existingSprings - 기존 Spring 배열 참조
 * @returns 업데이트된 worldWidth
 */
export function parseTiledMap(
    scene: any,
    mapKey: any,
    existingKeys: any[],
    existingLocks: any[],
    existingSprings: any[]
): number {
    const data = scene.cache.json.get(mapKey);
    if (!data || !data.layers || data.layers.length === 0) {
        console.error(`[TiledParser] Map data not found for key: ${mapKey}`);
        return 800; // 기본값
    }

    const layer = data.layers[0];
    const tileData = layer.data;
    const width = data.width;
    const height = data.height;

    // 동적 크기 계산
    const screenHeight = scene.scale.height;
    const targetTileSize = 64; // 고정된 타일 크기 사용
    const worldWidth = width * targetTileSize;
    const worldHeight = height * targetTileSize;

    // 하단 정렬을 위한 오프셋 계산 (음수 방지: 맵이 화면보다 크면 0, 작으면 하단에 붙임)
    const offsetY = Math.max(0, screenHeight - worldHeight);

    // console.log(`[TiledParser] Parsing map: ${mapKey} (${width}x${height}) scaling to ${targetTileSize.toFixed(2)}px`);

    // Matter.js 월드 경계 설정 (맵 전체 높이 커버, 항상 0부터 시작)
    if ((scene as any).matter && (scene as any).matter.world) {
        (scene as any).matter.world.setBounds(0, 0, worldWidth, worldHeight);
    }

    const tempKeys: { x: number; y: number; i: number }[] = [];
    const tempLocks: { x: number; y: number; i: number }[] = [];

    // 타일 레이어 파싱 (레거시 코드 지원용)
    const groundTiles: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));


    // [최적화] 땅(GID 1)용 청크형 Graphics 시스템
    // 거대한 단일 Graphics 사용 시 컬링 불가 문제를 해결하기 위해 청크 단위로 분리
    const graphicsChunks: Map<number, Phaser.GameObjects.Graphics> = new Map();

    const getOrCreateGraphicsChunk = (chunkIndex: number) => {
        if (!graphicsChunks.has(chunkIndex)) {
            // 청크 시작 Y 위치 (디버깅용 정보로 사용 가능하나, Graphics 자체는 (0,0)에 배치하고 fillRect 좌표로 제어)
            const g = scene.add.graphics({ x: 0, y: 0 });
            g.fillStyle(0x4A6B2F, 1);
            graphicsChunks.set(chunkIndex, g);
        }
        return graphicsChunks.get(chunkIndex)!;
    };

    // [최적화] 장식 타일(GID 21-24)용 청크형 RenderTexture 시스템 위함
    // 맵 전체를 하나의 텍스처로 하면 GPU 한계를 초과할 수 있어 청크로 분할
    const CHUNK_HEIGHT = 2048;
    const renderTextureChunks: Map<number, Phaser.GameObjects.RenderTexture> = new Map();

    const getOrCreateChunk = (chunkIndex: number) => {
        if (!renderTextureChunks.has(chunkIndex)) {
            // 해당 청크의 시작 Y 위치
            const chunkY = offsetY + (chunkIndex * CHUNK_HEIGHT);
            // 청크 높이는 기본 2048이지만, 맵 끝부분은 더 작을 수 있음 (그래도 텍스처는 넉넉히 잡아도 됨)
            const rt = scene.add.renderTexture(0, chunkY, worldWidth, CHUNK_HEIGHT);
            rt.setOrigin(0, 0);
            renderTextureChunks.set(chunkIndex, rt);
        }
        return renderTextureChunks.get(chunkIndex)!;
    };


    if (tileData) {
        for (let i = 0; i < tileData.length; i++) {
            const gid = tileData[i];
            if (gid === 0) continue;

            const tileX = i % width;
            const tileY = Math.floor(i / width);
            const x = tileX * targetTileSize + targetTileSize / 2;
            const y = offsetY + (tileY * targetTileSize + targetTileSize / 2);

            switch (gid) {
                case 1: // Ground (Static) - 최적화를 위해 바로 생성하지 않고 마킹
                    groundTiles[tileY][tileX] = true;
                    break;

                case 21:
                case 22:
                case 23:
                case 24: // Tileset images (Decorations)
                    // [최적화] 개별 이미지 객체 생성 대신 RenderTexture에 베이킹
                    const globalY = y; // 월드 좌표계 Y

                    // 청크 계산 (offsetY 고려)
                    // 타일의 실제 Y 위치(이미지 중심)에서 상단 좌표 구하기
                    // RenderTexture는 (0,0) Origin 기준이므로 좌표 변환 필요
                    const tileTop = y - targetTileSize / 2; // 타일 상단 Y
                    const relativeY = tileTop - offsetY; // 맵 시작점 기준 상대 Y

                    const chunkIndex = Math.floor(relativeY / CHUNK_HEIGHT);
                    const rt = getOrCreateChunk(chunkIndex);

                    // 청크 내부 상대 좌표 (RenderTexture 내부 좌표)
                    // 청크의 월드 Y 시작점: offsetY + (chunkIndex * CHUNK_HEIGHT)
                    const chunkStartY = offsetY + (chunkIndex * CHUNK_HEIGHT);
                    const drawX = x; // 중심 X (draw는 중심 기준? 확인 필요 -> RenderTexture.draw는 x,y에 그림)
                    // RenderTexture.draw(texture, x, y)에서 x, y는 texture의 중심이 아니라 top-left 일 수도 있고...
                    // Phaser 문서: draw(entries, x, y) -> x, y is the position to draw the texture at.
                    // Image와 달리 draw는 텍스처 자체의 크기를 고려해야 함.
                    // 하지만 편의를 위해 임시 Image를 만들어 draw 할 수 있음.

                    // 더 효율적인 방법: drawFrame 사용
                    // rt.drawFrame(key, frame, x, y)
                    // x, y 위치에 프레임의 center가 아니라 top-left가 오는지 확인 필요.
                    // Phaser RT draw는 보통 대상의 origin에 영향을 받지 않고 top-left 기준일 수 있음.
                    // 테스트: targetTileSize가 64. x, y는 중심 좌표.
                    // drawX = x - 32
                    // drawY = y - 32 - chunkStartY

                    const drawLocalX = x;
                    const drawLocalY = y - chunkStartY;

                    // 임시 이미지 객체를 생성하여 그리는 것이 스케일링/Origin 처리에 안전함
                    // (drawFrame은 스케일링 설정이 복잡할 수 있음)
                    const tempImg = scene.make.image({
                        x: drawLocalX,
                        y: drawLocalY,
                        key: 'stage_tiles',
                        frame: gid - 21
                    });
                    tempImg.setDisplaySize(targetTileSize, targetTileSize);
                    rt.draw(tempImg);
                    tempImg.destroy(); // 즉시 제거
                    break;

                case 30: // Spawn point (Tile-based)
                    // console.log(`[TiledParser] Tile Spawn point at: ${x}, ${y}`);
                    if ('spawnPoints' in scene) {
                        (scene as any).spawnPoints.push(new (Respawn as any)(scene, x, y, `tile-spawn-${i}`, undefined, true));
                    }
                    break;

                case 34: // Key
                    tempKeys.push({ x, y, i });
                    break;

                case 35: // Lock
                    tempLocks.push({ x, y, i });
                    break;

                case 56: // Spring
                    const springId = `spring-${i}`;
                    const spring = new Spring(scene, x, y, springId);
                    existingSprings.push(spring);
                    break;

                default:
                    break;
            }
        }
    }

    // [최적화] Greedy Meshing으로 인접한 땅을 병합하여 생성
    const processed = Array.from({ length: height }, () => Array(width).fill(false));

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (groundTiles[y][x] && !processed[y][x]) {
                // 1. 가로로 얼마나 이어지는지 확인
                let w = 1;
                while (x + w < width && groundTiles[y][x + w] && !processed[y][x + w]) {
                    w++;
                }

                // 2. 이 가로 길이(w) 그대로 세로로 얼마나 이어지는지 확인
                let h = 1;
                while (y + h < height) {
                    let rowMatch = true;
                    for (let k = 0; k < w; k++) {
                        if (!groundTiles[y + h][x + k] || processed[y + h][x + k]) {
                            rowMatch = false;
                            break;
                        }
                    }
                    if (rowMatch) {
                        h++;
                    } else {
                        break;
                    }
                }

                // 3. 병합된 영역 마킹
                for (let row = y; row < y + h; row++) {
                    for (let col = x; col < x + w; col++) {
                        processed[row][col] = true;
                    }
                }

                // 4. 물리 바디 및 그래픽 생성
                // 좌표 계산: 그리드 좌표(x, y) -> 픽셀 중심 좌표
                // 병합된 사각형의 왼쪽 위(x, y)에서 w, h만큼의 크기
                const pixelX = x * targetTileSize; // 좌측 상단 X
                const pixelY = offsetY + (y * targetTileSize); // 좌측 상단 Y (offsetY 적용)

                const rectWidth = w * targetTileSize;
                const rectHeight = h * targetTileSize;

                const centerX = pixelX + rectWidth / 2;
                const centerY = pixelY + rectHeight / 2;

                // [렌더링 최적화] 시각적 드로잉은 청크 단위로 분할하여 그리기
                // 사각형이 걸쳐있는 모든 청크 계산
                const startChunkIndex = Math.floor((pixelY - offsetY) / CHUNK_HEIGHT);
                const endChunkIndex = Math.floor(((pixelY + rectHeight - 1) - offsetY) / CHUNK_HEIGHT);

                for (let cIdx = startChunkIndex; cIdx <= endChunkIndex; cIdx++) {
                    const chunkG = getOrCreateGraphicsChunk(cIdx);
                    const chunkStartY = offsetY + (cIdx * CHUNK_HEIGHT);
                    const chunkEndY = chunkStartY + CHUNK_HEIGHT;

                    // 현재 청크와 사각형의 교차 영역 계산
                    const intersectTop = Math.max(pixelY, chunkStartY);
                    const intersectBottom = Math.min(pixelY + rectHeight, chunkEndY);
                    const intersectHeight = intersectBottom - intersectTop;

                    if (intersectHeight > 0) {
                        // 절대 좌표로 그리므로 좌표 변환 불필요 (Graphics 위치를 0,0으로 했으므로)
                        chunkG.fillRect(pixelX, intersectTop, rectWidth, intersectHeight);
                    }
                }

                // 물리 바디 생성 (중심 기준)
                if ((scene as any).matter) {
                    (scene as any).matter.add.rectangle(centerX, centerY, rectWidth, rectHeight, {
                        isStatic: true,
                        label: 'ground',
                        friction: 0,
                        frictionStatic: 0
                    });
                }
            }
        }
    }

    // Key/Lock 1:1 연결
    tempLocks.forEach((lockData, idx) => {
        const lockId = `lock-${idx}`;
        const lock = new Lock(scene, lockData.x, lockData.y, lockId);
        existingLocks.push(lock);

        if (tempKeys[idx]) {
            const keyData = tempKeys[idx];
            const keyId = `key-${idx}`;
            const key = new Key(scene, keyData.x, keyData.y, keyId, lockId);
            existingKeys.push(key);
        }
    });

    // === 객체 레이어(Object Layer) 파싱 ===
    if (data.layers) {
        data.layers.forEach((objLayer: any) => {
            if (objLayer.type === 'objectgroup' && objLayer.objects) {
                objLayer.objects.forEach((obj: any) => {
                    const objX = obj.x + (obj.width || 0) / 2;
                    const objY = offsetY + (obj.y + (obj.height || 0) / 2);

                    // Tiled 'Type' or 'Class' or 'Name' checking
                    const type = obj.type || obj.class || obj.name;

                    if (type === 'GhostPlatform') {
                        let texture = undefined;
                        let frame = undefined;
                        if (obj.properties) {
                            obj.properties.forEach((p: any) => {
                                if (p.name === 'texture') texture = p.value;
                                if (p.name === 'frame') frame = p.value;
                            });
                        }
                        const ghost = new GhostPlatform(scene, {
                            id: `ghost-obj-${obj.id}`,
                            x: objX,
                            y: objY,
                            width: obj.width,
                            height: obj.height,
                            texture: texture,
                            frame: frame
                        });
                        (scene as any).ghostPlatforms.push(ghost);
                    }
                    else if (type === 'BlockButton') {
                        let spawnX = objX + 100;
                        let spawnY = objY;
                        let spawnWidth = 32;
                        let spawnHeight = 32;
                        let requiredPlayers = 1;

                        if (obj.properties) {
                            obj.properties.forEach((p: any) => {
                                if (p.name === 'spawnX') spawnX = p.value;
                                if (p.name === 'spawnY') spawnY = offsetY + p.value;
                                if (p.name === 'spawnWidth') spawnWidth = p.value;
                                if (p.name === 'spawnHeight') spawnHeight = p.value;
                                if (p.name === 'requiredPlayers') requiredPlayers = p.value;
                            });
                        }
                        const button = new BlockButton(scene, {
                            id: `button-obj-${obj.id}`,
                            x: objX,
                            y: objY,
                            width: obj.width,
                            height: obj.height,
                            spawnConfig: {
                                id: `spawned-block-obj-${obj.id}`,
                                x: spawnX,
                                y: spawnY,
                                width: spawnWidth,
                                height: spawnHeight,
                                requiredPlayers: requiredPlayers
                            }
                        });
                        (scene as any).blockButtons.push(button);
                    }
                    else if (type === 'Elevator') {
                        let targetY = objY - 200;
                        let requiredPlayers = 1;
                        if (obj.properties) {
                            obj.properties.forEach((p: any) => {
                                if (p.name === 'targetY') targetY = offsetY + p.value;
                                if (p.name === 'requiredPlayers') requiredPlayers = p.value;
                            });
                        }
                        const elevator = new Elevator(scene, {
                            id: `elevator-obj-${obj.id}`,
                            x: objX,
                            initialY: objY,
                            targetY: targetY,
                            width: obj.width,
                            height: obj.height,
                            requiredPlayers: requiredPlayers
                        });
                        (scene as any).elevators.push(elevator);
                    }
                    else if (type === 'MovableBlock') {
                        let requiredPlayers = 1;
                        if (obj.properties) {
                            obj.properties.forEach((p: any) => {
                                if (p.name === 'requiredPlayers') requiredPlayers = p.value;
                            });
                        }
                        const block = new MovableBlock(scene, {
                            id: `block-obj-${obj.id}`,
                            x: objX,
                            y: objY,
                            width: obj.width,
                            height: obj.height,
                            requiredPlayers: requiredPlayers
                        });
                        (scene as any).movableBlocks.push(block);
                    }
                    else if (type === 'Signboard') {
                        let message = "여기에 메시지를 입력하세요.";
                        if (obj.properties) {
                            obj.properties.forEach((p: any) => {
                                if (p.name === 'message') message = p.value;
                            });
                        }
                        const sign = new Signboard(scene, {
                            id: `sign-obj-${obj.id}`,
                            x: objX,
                            y: objY,
                            width: obj.width,
                            height: obj.height,
                            message: message
                        });
                        (scene as any).signboards.push(sign);
                    }
                    else if (type === 'Spawn' || type === 'SpawnPoint') {
                        let playerIndex = undefined;
                        let isDefault = false;
                        if (obj.properties) {
                            obj.properties.forEach((p: any) => {
                                if (p.name === 'playerIndex') playerIndex = Number(p.value);
                                if (p.name === 'isDefault') isDefault = p.value === true || p.value === 'true';
                            });
                        }
                        if ('spawnPoints' in scene) {
                            (scene as any).spawnPoints.push(new Respawn(
                                objX,
                                objY,
                                `obj-spawn-${obj.id}`,
                                playerIndex,
                                isDefault
                            ));
                            // console.log(`[TiledParser] Object SpawnPoint registered: ${obj.id} at (${objX}, ${objY}) pkgIdx: ${playerIndex}`);
                        }
                    }
                });
            }
        });
    }

    return worldWidth;
}
