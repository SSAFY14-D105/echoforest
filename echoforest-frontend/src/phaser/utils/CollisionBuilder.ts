import Phaser from 'phaser';
import BaseGameScene from '../scenes/BaseGameScene';
import { GhostPlatform } from '../gimmicks';

/**
 * CollisionBuilder
 * 타일맵의 충돌체 병합(Greedy Merging) 및 GhostPlatform 생성 로직 담당
 */
export default class CollisionBuilder {

    /**
     * Greedy Merging 알고리즘을 사용하여 인접한 충돌 타일들을 하나의 물리 바디로 병합
     */
    public static createMergedCollisions(
        scene: BaseGameScene,
        map: Phaser.Tilemaps.Tilemap,
        layer: Phaser.Tilemaps.TilemapLayer,
        mapScale: number,
        offsetY: number
    ): void {
        const { width, height } = map;
        const mergedRects: { x: number; y: number; w: number; h: number }[] = [];
        const processed = Array.from({ length: height }, () => Array(width).fill(false));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = layer.getTileAt(x, y);

                if (this.isTileCollidable(tile) && !processed[y][x]) {
                    // 1. 가로로 얼마나 이어지는지 확인
                    let w = 1;
                    while (x + w < width) {
                        const nextTile = layer.getTileAt(x + w, y);
                        if (this.isTileCollidable(nextTile) && !processed[y][x + w]) {
                            w++;
                        } else {
                            break;
                        }
                    }

                    // 2. 이 가로 길이(w) 그대로 세로로 얼마나 이어지는지 확인
                    let h = 1;
                    while (y + h < height) {
                        let rowMatch = true;
                        for (let k = 0; k < w; k++) {
                            const belowTile = layer.getTileAt(x + k, y + h);
                            if (!this.isTileCollidable(belowTile) || processed[y + h][x + k]) {
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

                    // 3. 병합된 영역 마킹 및 기록
                    for (let row = y; row < y + h; row++) {
                        for (let col = x; col < x + w; col++) {
                            processed[row][col] = true;
                        }
                    }
                    mergedRects.push({ x, y, w, h });
                }
            }
        }

        // 4. 병합된 사각형들에 대해 물리 바디 생성
        const tileWidth = map.tileWidth * mapScale;
        const tileHeight = map.tileHeight * mapScale;

        mergedRects.forEach(rect => {
            const pixelWidth = rect.w * tileWidth;
            const pixelHeight = rect.h * tileHeight;
            const centerX = (rect.x * tileWidth) + (pixelWidth / 2);
            const centerY = (rect.y * tileHeight) + (pixelHeight / 2) + offsetY + 1; // +1 to fix floating issue

            scene.matter.add.rectangle(centerX, centerY, pixelWidth, pixelHeight - 2, {
                isStatic: true,
                label: 'ground',
                friction: 0,
                frictionStatic: 0
            });
        });
    }

    /**
     * TileLayer 데이터를 기반으로 GhostPlatform 기믹들을 생성합니다. (가로 병합 적용)
     */
    public static createGhostPlatformsFromLayer(
        scene: BaseGameScene,
        map: Phaser.Tilemaps.Tilemap,
        layerData: Phaser.Tilemaps.LayerData,
        mapScale: number,
        offsetY: number,
        parentOffsetX: number = 0,
        parentOffsetY: number = 0
    ): void {
        const width = layerData.width;
        const height = layerData.height;
        const processed = Array.from({ length: height }, () => Array(width).fill(false));
        const tileWidth = map.tileWidth * mapScale;
        const tileHeight = map.tileHeight * mapScale;

        const scaledOffsetX = parentOffsetX * mapScale;
        const scaledOffsetY = parentOffsetY * mapScale;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (processed[y][x]) continue;

                const tile = layerData.data[y][x];
                if (tile && tile.index !== -1) {
                    // 가로로 이어지는 타일 병합
                    let w = 1;
                    while (x + w < width) {
                        const nextTile = layerData.data[y][x + w];
                        if (nextTile && nextTile.index !== -1 && !processed[y][x + w]) {
                            w++;
                        } else {
                            break;
                        }
                    }

                    // 병합 처리 표시
                    for (let k = 0; k < w; k++) {
                        processed[y][x + k] = true;
                    }

                    // GhostPlatform 생성
                    const pixelWidth = w * tileWidth;
                    const pixelHeight = tileHeight;
                    const centerX = x * tileWidth + pixelWidth / 2 + scaledOffsetX;
                    const centerY = y * tileHeight + pixelHeight / 2 + offsetY + scaledOffsetY;

                    // 타일의 텍스처 정보 가져오기 (첫 번째 타일 기준)
                    let texture = '';
                    let frame = 0;
                    const tileset = tile.tileset;
                    if (tileset) {
                        texture = tileset.name;
                        frame = tile.index - tileset.firstgid;
                    }

                    scene.ghostPlatforms.push(new GhostPlatform(scene, {
                        id: `ghost-layer-${layerData.name}-${x}-${y}`,
                        x: centerX,
                        y: centerY,
                        width: pixelWidth,
                        height: pixelHeight,
                        texture, // 타일셋 텍스처 사용
                        frame: frame
                    }));
                }
            }
        }
    }

    /**
     * 타일이 충돌 가능한지 확인하는 헬퍼 메서드
     */
    private static isTileCollidable(tile: Phaser.Tilemaps.Tile | null): boolean {
        if (!tile) return false;
        // 1. 'collides' 커스텀 속성 확인
        if (tile.properties.collides) return true;
        // 2. Class 또는 Type이 'Solid'인지 확인
        const tileClass = tile.properties.class || tile.properties.type;
        return tileClass === 'Solid';
    }
}
