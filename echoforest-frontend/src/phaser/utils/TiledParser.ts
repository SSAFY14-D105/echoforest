import Phaser from 'phaser';
import { Key, Lock, Spring, PoisonMushroom, BlockButton, TogglePlatform, TriggerButton, Signboard, GhostPlatform, Elevator, MovableBlock } from '../gimmicks';

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
    (scene as any).matter.world.setBounds(0, 0, worldWidth, worldHeight);

    const tempKeys: { x: number; y: number; i: number }[] = [];
    const tempLocks: { x: number; y: number; i: number }[] = [];

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
                (scene as any).matter.add.gameObject(rect, {
                    isStatic: true,
                    label: 'ground',
                    friction: 0,
                    frictionStatic: 0
                });
                break;

            case 21:
            case 22:
            case 23:
            case 24: // Tileset images
                scene.add.image(x, y, 'stage_tiles', gid - 21)
                    .setDisplaySize(targetTileSize, targetTileSize);
                break;

            case 30: // Spawn point
                console.log(`[TiledParser] Spawn point at: ${x}, ${y}`);
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

            case 70: // Mushroom (예시 GID)
            case 71:
                const mushroom = new PoisonMushroom(scene, x, y, `mushroom-${i}`);
                (scene as any).poisonMushrooms.push(mushroom);
                break;

            case 80: // Button (예시 GID)
                const button = new BlockButton(scene, {
                    id: `button-${i}`,
                    x,
                    y,
                    spawnConfig: {
                        id: `spawned-block-${i}`,
                        x: x + 100,
                        y: y,
                        width: 32,
                        height: 32,
                        requiredPlayers: 1
                    }
                });
                (scene as any).blockButtons.push(button);
                break;

            case 90: // TogglePlatform (예시 GID)
                const platform = new TogglePlatform(scene, x, y, `platform-${i}`);
                (scene as any).togglePlatforms.push(platform);
                break;

            case 91: // TriggerButton (예시 GID)
                const tButton = new TriggerButton(scene, {
                    id: `tbutton-${i}`,
                    x,
                    y,
                    targetId: `platform-${i - 1}` // 예시로 바로 이전 객체 연결
                });
                (scene as any).triggerButtons.push(tButton);
                break;

            case 100: // Signboard (예시 GID)
                const sign = new Signboard(scene, {
                    id: `sign-${i}`,
                    x,
                    y,
                    message: "여기에 메시지를 입력하세요. (Tiled Property 지원 필요)"
                });
                (scene as any).signboards.push(sign);
                break;

            case 110: // GhostPlatform (예시 GID)
                const ghost = new GhostPlatform(scene, {
                    id: `ghost-${i}`,
                    x,
                    y,
                    width: targetTileSize,
                    height: targetTileSize
                });
                (scene as any).ghostPlatforms.push(ghost);
                break;

            default:
                break;
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

    // === 객체 레이어(Object Layer) 파싱 추가 ===
    if (data.layers) {
        data.layers.forEach((objLayer: any) => {
            if (objLayer.type === 'objectgroup' && objLayer.objects) {
                objLayer.objects.forEach((obj: any) => {
                    // GhostPlatform
                    if (obj.name === 'GhostPlatform' || obj.class === 'GhostPlatform' || obj.type === 'GhostPlatform') {
                        // Tiled 객체의 좌표는 좌상단 기준이므로 중심점으로 변환
                        const objX = obj.x + obj.width / 2;
                        const objY = offsetY + (obj.y + obj.height / 2);

                        // Custom Properties 파싱
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
                        console.log(`[TiledParser] Object GhostPlatform created: ${obj.id} at (${objX}, ${objY}) size ${obj.width}x${obj.height}`);
                    }

                    // BlockButton
                    if (obj.name === 'BlockButton' || obj.class === 'BlockButton' || obj.type === 'BlockButton') {
                        const objX = obj.x + obj.width / 2;
                        const objY = offsetY + (obj.y + obj.height / 2);

                        // Custom Properties 추출
                        let spawnX = objX + 100;
                        let spawnY = objY;
                        let spawnWidth = 32;
                        let spawnHeight = 32;
                        let requiredPlayers = 1;

                        if (obj.properties) {
                            obj.properties.forEach((p: any) => {
                                if (p.name === 'spawnX') spawnX = p.value;
                                if (p.name === 'spawnY') spawnY = offsetY + p.value; // spawnY에도 offsetY 적용
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
                        console.log(`[TiledParser] Object BlockButton created: ${obj.id} at (${objX}, ${objY}), spawns block at (${spawnX}, ${spawnY})`);
                    }

                    // Elevator
                    if (obj.name === 'Elevator' || obj.class === 'Elevator' || obj.type === 'Elevator') {
                        const objX = obj.x + obj.width / 2;
                        const objY = offsetY + (obj.y + obj.height / 2);

                        let targetY = objY - 200; // 기본값: 위로 200픽셀
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
                        console.log(`[TiledParser] Object Elevator created: ${obj.id} at (${objX}, ${objY}) -> targetY: ${targetY}`);
                    }

                    // MovableBlock
                    if (obj.name === 'MovableBlock' || obj.class === 'MovableBlock' || obj.type === 'MovableBlock') {
                        const objX = obj.x + obj.width / 2;
                        const objY = offsetY + (obj.y + obj.height / 2);

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
                        console.log(`[TiledParser] Object MovableBlock created: ${obj.id} at (${objX}, ${objY}) (req: ${requiredPlayers})`);
                    }

                    // Signboard
                    if (obj.name === 'Signboard' || obj.class === 'Signboard' || obj.type === 'Signboard') {
                        const objX = obj.x + obj.width / 2;
                        const objY = offsetY + (obj.y + obj.height / 2);

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
                        console.log(`[TiledParser] Object Signboard created: ${obj.id} at (${objX}, ${objY})`);
                    }
                });
            }
        });
    }

    return worldWidth;
}
