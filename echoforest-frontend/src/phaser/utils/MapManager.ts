import Phaser from 'phaser';
import BaseGameScene from '../scenes/BaseGameScene';
import TiledHelper from './TiledHelper';
import CollisionBuilder from './CollisionBuilder';
import ObjectFactory from './ObjectFactory';

/**
 * MapManager
 * Tiled Map의 로딩, 충돌체 병합, 기믹 생성을 담당하는 클래스.
 * - Group Layer 및 Class 속성 지원
 * - 공통 기믹 생성 로직 캡슐화
 * - (Refactored) 이제 세부 로직은 Helper 클래스들에게 위임합니다.
 */
export default class MapManager {
    private scene: BaseGameScene;
    private map: Phaser.Tilemaps.Tilemap;
    private mapScale: number;
    private offsetY: number;

    private mapKey: string;

    constructor(scene: BaseGameScene, mapKey: string, scale: number = 4) {
        this.scene = scene;
        this.mapKey = mapKey;
        this.mapScale = scale; // 기본값 4 (16px -> 64px)

        // 맵 생성
        this.map = this.scene.make.tilemap({ key: mapKey });

        // 오프셋 계산 (화면 하단 정렬)
        const mapPixelHeightScaled = this.map.heightInPixels * this.mapScale;
        this.offsetY = Math.max(0, this.scene.scale.height - mapPixelHeightScaled);

        // console.log(`[MapManager] Initialized for map: ${mapKey} (Scale: ${this.mapScale}, OffsetY: ${this.offsetY})`);
    }

    public getMap(): Phaser.Tilemaps.Tilemap {
        return this.map;
    }

    public getMapScale(): number {
        return this.mapScale;
    }

    public getOffsetY(): number {
        return this.offsetY;
    }

    public getWorldWidth(): number {
        return this.map.widthInPixels * this.mapScale;
    }

    public getWorldHeight(): number {
        return this.map.heightInPixels * this.mapScale;
    }

    /**
     * 월드 경계를 설정하고 타일셋과 레이어를 생성합니다.
     * 모든 타일 레이어를 순회하며 생성하고, Solid 속성이 있는 경우 충돌체를 병합생성합니다.
     */
    /**
     * 월드 경계를 설정하고 타일셋과 레이어를 생성합니다.
     * 모든 타일 레이어를 순회하며 생성하고, Solid 속성이 있는 경우 충돌체를 병합생성합니다.
     */
    public initialize(tilesetNames: string | string[], tilesetKeys: string | string[], backgroundKey?: string): void {
        // 월드 경계 설정
        this.scene.matter.world.setBounds(0, 0, this.getWorldWidth(), this.getWorldHeight());

        // 타일셋 추가 (다중 지원)
        const names = Array.isArray(tilesetNames) ? tilesetNames : [tilesetNames];
        const keys = Array.isArray(tilesetKeys) ? tilesetKeys : [tilesetKeys];
        const tilesets: Phaser.Tilemaps.Tileset[] = [];

        names.forEach((name, i) => {
            const key = keys[i] || keys[0]; // 키가 부족하면 첫 번째 키 재사용 (혹은 매칭되는 키 사용)
            const ts = this.map.addTilesetImage(name, key);
            if (ts) {
                tilesets.push(ts);
            } else {
                console.warn(`[MapManager] Failed to add tileset: ${name} (Key: ${key})`);
            }
        });

        // Render Skip 대상 레이어 식별 (Group Layer 상속 포함)
        const skippedLayerNames = this.getSkippedLayerNames();

        // 모든 타일 레이어 순회 및 생성
        this.map.layers.forEach(layerData => {
            const layerClass = TiledHelper.getLayerProperty(layerData, 'class') || (layerData as any).class;

            // 1. 렌더링 스킵 조건 (로직 전용 레이어)
            if (layerClass === 'GhostPlatform' || skippedLayerNames.has(layerData.name)) return;

            // 레이어 생성 (모든 타일셋 전달)
            const layer = this.map.createLayer(layerData.name, tilesets, 0, this.offsetY);
            if (layer) {
                layer.setScale(this.mapScale);
                layer.setDepth(-10 + this.map.layers.indexOf(layerData) * 0.1);

                // 3. 충돌체 생성 (CollisionBuilder 위임)
                const lowerName = layerData.name.toLowerCase();
                if (layerClass === 'Solid' || TiledHelper.getLayerProperty(layerData, 'collides') === true || lowerName === 'tiles' || lowerName === 'tile' || lowerName.includes('tile')) {
                    CollisionBuilder.createMergedCollisions(this.scene, this.map, layer, this.mapScale, this.offsetY);
                }
            } else {
                console.warn(`[MapManager] Failed to create layer: ${layerData.name}`);
            }
        });

        // 배경 설정 (수동 배경이 지정된 경우에만 생성)
        if (backgroundKey) {
            this.scene.setupTiledBackground(backgroundKey, 0.2);
        }
    }

    /**
     * 비동기적으로 맵을 초기화합니다. (대형 맵 로딩 시 프레임 드롭 방지)
     */
    public initializeAsync(tilesetNames: string | string[], tilesetKeys: string | string[], backgroundKey?: string): Promise<void> {
        return new Promise((resolve) => {
            // 메인 스레드 차단을 막기 위해 setTimeout으로 지연 실행
            setTimeout(() => {
                this.initialize(tilesetNames, tilesetKeys, backgroundKey);
                resolve();
            }, 0);
        });
    }

    /**
     * Raw JSON 데이터를 검색하여 렌더링에서 제외해야 할 레이어 이름 목록을 반환합니다.
     */
    private getSkippedLayerNames(): Set<string> {
        const skippedNames = new Set<string>();
        const rawMapData = this.scene.cache.tilemap.get(this.mapKey);
        const layers = rawMapData?.data?.layers || rawMapData?.layers;

        if (layers) {
            this.findSkippedLayersRecursive(layers, skippedNames);
        }

        return skippedNames;
    }

    private findSkippedLayersRecursive(layers: any[], skippedNames: Set<string>, parentClass?: string): void {
        layers.forEach(layer => {
            const myClass = TiledHelper.getLayerProperty(layer, 'class') || layer.class || layer.type || parentClass;

            if (layer.type === 'group' && layer.layers) {
                this.findSkippedLayersRecursive(layer.layers, skippedNames, myClass);
            } else if (layer.type === 'tilelayer') {
                if (myClass === 'GhostPlatform') {
                    skippedNames.add(layer.name);
                }
            }
        });
    }

    /**
     * Tiled 데이터구조를 순회하며 모든 레이어(그룹 포함)를 처리합니다.
     */
    public createObjects(): void {
        const rawMapData = this.scene.cache.tilemap.get(this.mapKey);
        const layers = rawMapData?.data?.layers || rawMapData?.layers;

        if (!layers) {
            console.warn(`[MapManager] Raw map data not found for key: ${this.mapKey}`);
            // Fallback (incomplete) - depth handling weak here
            this.map.objects.forEach(objLayer => this.processObjectLayer(objLayer));
            return;
        }

        // [FIX] Depth Management: Use a mutable counter to track rendering order across recursion
        // start from -10 to match previous behavior or just use integers
        const depthCounter = { value: 0 };

        // 재귀적으로 모든 레이어 탐색
        this.processLayersRecursively(layers, undefined, 0, 0, depthCounter);
    }

    private processLayersRecursively(
        layers: any[],
        parentClass?: string,
        parentOffsetX: number = 0,
        parentOffsetY: number = 0,
        depthCounter: { value: number } = { value: 0 }
    ): void {
        layers.forEach(layer => {
            // [FIX] Increment depth for each layer to ensure correct order
            // Phaser renders higher depth on top
            const currentDepth = depthCounter.value++;

            // 현재 레이어의 Class 또는 Type 속성 확인
            const myClass = TiledHelper.getLayerProperty(layer, 'class') || layer.class || layer.type || parentClass;

            // 현재 레이어의 오프셋 (Group Layer 포함)
            const currentOffsetX = parentOffsetX + (layer.offsetx || 0);
            const currentOffsetY = parentOffsetY + (layer.offsety || 0);

            if (layer.type === 'group' && layer.layers) {
                // Group Layer: 내부 레이어 재귀 호출
                this.processLayersRecursively(layer.layers, myClass, currentOffsetX, currentOffsetY, depthCounter);
            } else if (layer.type === 'objectgroup') {
                // Object Layer: 기믹 생성 처리
                // [FIX] Pass calculated depth
                this.processObjectLayer(layer as any, myClass, currentOffsetX, currentOffsetY, currentDepth);
            } else if (layer.type === 'tilelayer') {
                // Tile Layer
                // [FIX] Update depth of existing TileLayer to match Tiled order
                const mapLayer = this.map.getLayer(layer.name);
                if (mapLayer && mapLayer.tilemapLayer) {
                    mapLayer.tilemapLayer.setDepth(currentDepth);
                    // console.log(`[MapManager] Set depth for TileLayer ${layer.name}: ${currentDepth}`);
                }

                // GhostPlatform creation check
                if (myClass === 'GhostPlatform') {
                    // ... existing logic ...
                    if (mapLayer) {
                        CollisionBuilder.createGhostPlatformsFromLayer(this.scene, this.map, mapLayer, this.mapScale, this.offsetY, currentOffsetX, currentOffsetY);
                    }
                }
            }
        });
    }

    /**
     * 단일 오브젝트 레이어 처리
     */
    private processObjectLayer(
        objectLayer: Phaser.Types.Tilemaps.ObjectLayerConfig,
        parentClass?: string,
        offsetX: number = 0,
        offsetY: number = 0,
        depth: number = 0 // [New]
    ): void {
        // 레이어 자체의 속성 확인
        let layerClass = TiledHelper.getLayerProperty(objectLayer, 'class') || (objectLayer as any).class || (objectLayer as any).type || parentClass;

        // Tiled Parsing 이슈 대응: 이름으로 추론
        if (!layerClass && objectLayer.name) {
            const lowerName = objectLayer.name.toLowerCase();
            if (lowerName.includes('spring')) layerClass = 'Spring';
            else if (lowerName.includes('spike')) layerClass = 'Spike';
            else if (lowerName.includes('platform')) layerClass = 'GhostPlatform';
        }

        if (objectLayer.objects) {
            objectLayer.objects.forEach((obj: any) => {
                // ObjectFactory 위임
                ObjectFactory.createObject(
                    this.scene,
                    this.map,
                    obj,
                    this.mapScale,
                    this.offsetY,
                    layerClass,
                    offsetX,
                    offsetY,
                    depth // [FIX] Pass depth
                );
            });
        }
    }
}
