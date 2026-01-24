import Phaser from 'phaser';
import { Key, Lock, Spring } from '../gimmicks';

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
    const targetTileSize = screenHeight / height;
    const worldWidth = width * targetTileSize;

    console.log(`[TiledParser] Parsing map: ${mapKey} (${width}x${height}) scaling to ${targetTileSize.toFixed(2)}px`);

    // Matter.js 월드 경계 설정
    (scene as any).matter.world.setBounds(0, 0, worldWidth, screenHeight);

    const tempKeys: { x: number; y: number; i: number }[] = [];
    const tempLocks: { x: number; y: number; i: number }[] = [];

    for (let i = 0; i < tileData.length; i++) {
        const gid = tileData[i];
        if (gid === 0) continue;

        const tileX = i % width;
        const tileY = Math.floor(i / width);
        const x = tileX * targetTileSize + targetTileSize / 2;
        const y = tileY * targetTileSize + targetTileSize / 2;

        switch (gid) {
            case 1: // Ground (Static)
                const rect = scene.add.rectangle(x, y, targetTileSize, targetTileSize, 0x4A6B2F);
                (scene as any).matter.add.gameObject(rect, {
                    isStatic: true,
                    label: 'ground'
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

    return worldWidth;
}
