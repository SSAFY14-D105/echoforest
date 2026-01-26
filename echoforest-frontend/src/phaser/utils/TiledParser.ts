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
    scene: Phaser.Scene,
    mapKey: string,
    existingKeys: Key[],
    existingLocks: Lock[],
    existingSprings: Spring[]
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

    console.log(`[TiledParser] Parsing map: ${mapKey} (${width}x${height}) scaling to ${targetTileSize.toFixed(2)}px`);

    // Matter.js 월드 경계 설정 (맵 전체 높이 커버, 항상 0부터 시작)
    if ((scene as any).matter && (scene as any).matter.world) {
        (scene as any).matter.world.setBounds(0, 0, worldWidth, worldHeight);
    }

    const tempKeys: { x: number; y: number; i: number }[] = [];
    const tempLocks: { x: number; y: number; i: number }[] = [];

    // 타일 레이어 파싱 (레거시 코드 지원용)
    if (tileData) {
        for (let i = 0; i < tileData.length; i++) {
            const gid = tileData[i];
            if (gid === 0) continue;

            const tileX = i % width;
            const tileY = Math.floor(i / width);
            const x = tileX * targetTileSize + targetTileSize / 2;
            const y = offsetY + (tileY * targetTileSize + targetTileSize / 2);

            switch (gid) {
                case 1: // Ground (Static)
                    const rect = scene.add.rectangle(x, y, targetTileSize, targetTileSize, 0x4A6B2F);
                    if ((scene as any).matter) {
                        (scene as any).matter.add.gameObject(rect, {
                            isStatic: true,
                            label: 'ground',
                            friction: 0,
                            frictionStatic: 0
                        });
                    }
                    break;

                case 21:
                case 22:
                case 23:
                case 24: // Tileset images
                    scene.add.image(x, y, 'stage_tiles', gid - 21)
                        .setDisplaySize(targetTileSize, targetTileSize);
                    break;

                case 30: // Spawn point (Tile-based)
                    console.log(`[TiledParser] Tile Spawn point at: ${x}, ${y}`);
                    if ('spawnPoints' in scene) {
                        (scene as any).spawnPoints.push(new Respawn(x, y, `tile-spawn-${i}`, undefined, true));
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
                            console.log(`[TiledParser] Object SpawnPoint registered: ${obj.id} at (${objX}, ${objY}) pkgIdx: ${playerIndex}`);
                        }
                    }
                });
            }
        });
    }

    return worldWidth;
}
