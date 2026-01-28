import Phaser from 'phaser';
import BaseGameScene from '../scenes/BaseGameScene';
import {
    Key, Lock, Spike, Spring, Goal, BlockButton, Elevator, Bumper,
    Signboard, MovableBlock, MovingBumper, PoisonMushroom, TogglePlatform,
    TriggerButton, GhostPlatform, Respawn
} from '../gimmicks';

/**
 * MapManager
 * Tiled Map의 로딩, 충돌체 병합, 기믹 생성을 담당하는 클래스.
 * - Group Layer 및 Class 속성 지원
 * - 공통 기믹 생성 로직 캡슐화
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

        console.log(`[MapManager] Initialized for map: ${mapKey} (Scale: ${this.mapScale}, OffsetY: ${this.offsetY})`);
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
     * @param tilesetName Tiled에서 설정한 타일셋 이름
     * @param tilesetKey Phaser 캐시 키
     * @param tilesetName Tiled에서 설정한 타일셋 이름
     * @param tilesetKey Phaser 캐시 키
     * @param backgroundKey 배경 이미지 키 (옵션)
     */
    public initialize(tilesetName: string, tilesetKey: string, backgroundKey?: string): void {
        // 월드 경계 설정
        this.scene.matter.world.setBounds(0, 0, this.getWorldWidth(), this.getWorldHeight());

        // 타일셋 추가
        const ts = this.map.addTilesetImage(tilesetName, tilesetKey);
        if (!ts) {
            console.error(`[MapManager] Failed to add tileset: ${tilesetName}`);
            return;
        }

        // Render Skip 대상 레이어 식별 (Group Layer 상속 포함)
        const skippedLayerNames = this.getSkippedLayerNames();

        // 모든 타일 레이어 순회 및 생성
        this.map.layers.forEach(layerData => {
            const layerClass = this.getLayerProperty(layerData, 'class') || (layerData as any).class;

            // 1. 렌더링 스킵 조건 (로직 전용 레이어)
            // GhostPlatform은 createObjects에서 별도로 기믹으로 생성되므로 타일맵으론 그리지 않음
            // (Group Layer 상속 속성까지 고려하여 체크)
            if (layerClass === 'GhostPlatform' || skippedLayerNames.has(layerData.name)) return;

            // 2. 레이어 생성
            const layer = this.map.createLayer(layerData.name, ts, 0, this.offsetY);
            if (layer) {
                layer.setScale(this.mapScale);

                // 깊이 설정: 배경과 오브젝트 사이 적절한 depth 필요
                layer.setDepth(-10 + this.map.layers.indexOf(layerData) * 0.1);

                // 3. 충돌체 생성
                // - 레이어에 'Solid' 클래스나 'collides' 속성이 있는 경우
                // - 또는 레이어 이름이 'tiles'인 경우 (Legacy 호환: 기존 맵들은 속성 없이 이름에 의존)
                if (layerClass === 'Solid' || this.getLayerProperty(layerData, 'collides') === true || layerData.name === 'tiles') {
                    this.createMergedCollisions(layer);
                }
            } else {
                console.warn(`[MapManager] Failed to create layer: ${layerData.name}`);
            }
        });

        // 배경 설정
        if (backgroundKey) {
            this.scene.setupTiledBackground(backgroundKey, 0.2);
        }
    }

    /**
     * Raw JSON 데이터를 검색하여 렌더링에서 제외해야 할 레이어 이름 목록을 반환합니다.
     * (예: Group Layer에 GhostPlatform 속성이 있는 경우 내부 레이어들)
     */
    private getSkippedLayerNames(): Set<string> {
        const skippedNames = new Set<string>();
        const rawMapData = this.scene.cache.tilemap.get(this.mapKey);

        if (rawMapData && rawMapData.data && rawMapData.data.layers) {
            this.findSkippedLayersRecursive(rawMapData.data.layers, skippedNames);
        }

        return skippedNames;
    }

    private findSkippedLayersRecursive(layers: any[], skippedNames: Set<string>, parentClass?: string): void {
        layers.forEach(layer => {
            const myClass = this.getLayerProperty(layer, 'class') || layer.class || layer.type || parentClass;

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
     * Phaser의 map.objects는 중첩된 그룹 레이어 내부의 오브젝트 레이어를 누락할 수 있으므로,
     * Raw JSON 데이터를 직접 재귀적으로 탐색합니다.
     */
    public createObjects(): void {
        const rawMapData = this.scene.cache.tilemap.get(this.mapKey);
        if (!rawMapData || !rawMapData.data || !rawMapData.data.layers) {
            console.warn(`[MapManager] Raw map data not found for key: ${this.mapKey}`);
            // Fallback (incomplete)
            this.map.objects.forEach(objLayer => this.processObjectLayer(objLayer));
            return;
        }

        // 재귀적으로 모든 레이어 탐색 (Group Layer 속성 상속 지원)
        this.processLayersRecursively(rawMapData.data.layers);
    }

    private processLayersRecursively(layers: any[], parentClass?: string, parentOffsetX: number = 0, parentOffsetY: number = 0): void {
        layers.forEach(layer => {
            // 현재 레이어의 Class 또는 Type 속성 확인
            const myClass = this.getLayerProperty(layer, 'class') || layer.class || layer.type || parentClass;

            // 현재 레이어의 오프셋 (Group Layer 포함)
            const currentOffsetX = parentOffsetX + (layer.offsetx || 0);
            const currentOffsetY = parentOffsetY + (layer.offsety || 0);

            if (layer.type === 'group' && layer.layers) {
                // Group Layer: 내부 레이어 재귀 호출 (상위 속성 및 오프셋 전달)
                this.processLayersRecursively(layer.layers, myClass, currentOffsetX, currentOffsetY);
            } else if (layer.type === 'objectgroup') {
                // Object Layer: 기믹 생성 처리
                this.processObjectLayer(layer as any, myClass, currentOffsetX, currentOffsetY);
            } else if (layer.type === 'tilelayer') {
                // Tile Layer: GhostPlatform 여부 확인
                if (myClass === 'GhostPlatform') {
                    const phaserLayer = this.map.layers.find(l => l.name === layer.name);
                    if (phaserLayer) {
                        this.createGhostPlatformsFromLayer(phaserLayer, currentOffsetX, currentOffsetY);
                    }
                }
            }
        });
    }

    /**
     * 재귀적으로 모든 레이어를 탐색하여 Object Layer를 수집합니다.
     */
    private collectObjectLayers(layers: any[], result: any[]): void {
        layers.forEach(layer => {
            if (layer.type === 'objectgroup') {
                result.push(layer);
            } else if (layer.type === 'group' && layer.layers) {
                this.collectObjectLayers(layer.layers, result);
            }
        });
    }

    /**
     * 단일 오브젝트 레이어 처리 (타입 추론 포함)
     */
    private processObjectLayer(objectLayer: Phaser.Types.Tilemaps.ObjectLayerConfig, parentClass?: string, offsetX: number = 0, offsetY: number = 0): void {
        // 레이어 자체의 속성 확인
        let layerClass = this.getLayerProperty(objectLayer, 'class') || (objectLayer as any).class || (objectLayer as any).type || parentClass;

        // Tiled Parsing 이슈 대응: 이름으로 추론
        if (!layerClass && objectLayer.name) {
            const lowerName = objectLayer.name.toLowerCase();
            if (lowerName.includes('spring')) layerClass = 'Spring';
            else if (lowerName.includes('spike')) layerClass = 'Spike';
            else if (lowerName.includes('platform')) layerClass = 'GhostPlatform';
        }

        if (objectLayer.objects) {
            objectLayer.objects.forEach((obj: any) => {
                this.createObject(obj, layerClass, offsetX, offsetY);
            });
        }
    }

    private createObject(obj: Phaser.Types.Tilemaps.TiledObject, parentClass?: string, offsetX: number = 0, offsetY: number = 0): void {
        const width = (obj.width || 0) * this.mapScale;
        const height = (obj.height || 0) * this.mapScale;

        const gidRaw = obj.gid || 0;

        // 오프셋 적용 (Group Layer 상속값 포함)
        const scaledOffsetX = offsetX * this.mapScale;
        const scaledOffsetY = offsetY * this.mapScale;

        let centerX = (obj.x || 0) * this.mapScale + width / 2 + scaledOffsetX;

        // Tiled 좌표계 차이 대응:
        // - Tile Object (Images/Tiles with GID): 좌표 기준이 Bottom-Left -> CenterY = y - height/2
        // - Shape Object (Rectangles without GID): 좌표 기준이 Top-Left -> CenterY = y + height/2
        let centerY: number;
        if (gidRaw > 0) {
            centerY = (obj.y || 0) * this.mapScale - height / 2 + this.offsetY + scaledOffsetY;
        } else {
            centerY = (obj.y || 0) * this.mapScale + height / 2 + this.offsetY + scaledOffsetY;
        }

        const gid = gidRaw & ~(0x80000000 | 0x40000000 | 0x20000000 | 0x10000000); // GID flipping

        let texture = '';
        let frame = 0;
        if (gid > 0) {
            const tileset = this.map.tilesets.find(ts =>
                gid >= ts.firstgid && gid < ts.firstgid + ts.total
            );
            if (tileset) {
                texture = tileset.name;
                frame = gid - tileset.firstgid;
            }
        }

        const rotation = obj.rotation || 0;
        let type = obj.type || (obj as any).class;
        if (!type && parentClass) type = parentClass;

        // ... Type inference ...
        if (!type) {
            if (gid === 111 || gid === 131) type = 'Lock';
            else if (gid === 113) type = 'Goal';
            // [FIX] Relaxed Spawn detection: Check name case-insensitive
            else if (gid === 96 || gid === 30 || (obj.name && (obj.name.toLowerCase() === 'spawn' || obj.name.toLowerCase() === 'spawnpoint'))) type = 'Spawn';
            else if (this.getObjectProperty(obj, 'collides') === true) type = 'Solid';
            else if (this.getObjectProperty(obj, 'playerIndex') !== undefined || this.getObjectProperty(obj, 'isDefault') !== undefined) type = 'Spawn';
            else if (this.getObjectProperty(obj, 'targetX') !== undefined || this.getObjectProperty(obj, 'targetY') !== undefined) {
                if (this.getObjectProperty(obj, 'speed') !== undefined) type = 'MovingBumper';
                else type = 'Elevator';
            }
        }

        // Factory Logic
        switch (type) {
            case 'Spawn':
            case 'SpawnPoint': {
                const playerIndex = this.getObjectProperty(obj, 'playerIndex');
                const isDefault = this.getObjectProperty(obj, 'isDefault');
                this.scene.spawnPoints.push(new Respawn(
                    centerX, centerY, `respawn-${obj.id}`, playerIndex !== undefined ? Number(playerIndex) : undefined, isDefault === true || isDefault === 'true'
                ));
                console.log(`[MapManager] Spawn registered: (${centerX}, ${centerY})`);
                break;
            }
            case 'Signboard': {
                const message = this.getObjectProperty(obj, 'message') || '내용이 없습니다.';
                this.scene.signboards.push(new Signboard(this.scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, message, width, height, texture, frame, angle: rotation
                }));
                break;
            }
            case 'Lock': {
                const doorId = this.getObjectProperty(obj, 'doorId') || 1;
                const targetGoalId = this.getObjectProperty(obj, 'targetGoalId');
                this.scene.locks.push(new Lock(this.scene, centerX, centerY, `lock-${doorId}`, width, height, texture, frame, rotation, targetGoalId));
                break;
            }
            case 'Key': {
                const doorId = this.getObjectProperty(obj, 'doorId') || 1;
                this.scene.keys.push(new Key(this.scene, centerX, centerY, obj.id!.toString(), `lock-${doorId}`, width, height, texture, frame, rotation));
                break;
            }
            case 'MovableBlock': {
                const targetBlockId = this.getObjectProperty(obj, 'targetBlockId');
                const reqPlayers = this.getObjectProperty(obj, 'requiredPlayers') || 1;
                const block = new MovableBlock(this.scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, width, height, requiredPlayers: reqPlayers,
                    texture, frame, targetBlockId: targetBlockId
                });
                if (targetBlockId) block.setVisible(false);
                this.scene.movableBlocks.push(block);
                break;
            }
            case 'Goal': {
                const reqPlayers = this.getObjectProperty(obj, 'requiredPlayers') || 1;
                const targetGoalId = this.getObjectProperty(obj, 'targetGoalId');
                const goal = new Goal(this.scene, centerX, centerY, obj.id!.toString(), reqPlayers, width, height, texture, frame, rotation, targetGoalId);
                goal.setVisible(false);
                this.scene.goals.push(goal);
                break;
            }
            case 'BlockButton': {
                const props = this.getAllObjectProperties(obj);
                const targetBlockId = props.targetBlockId;
                const button = new BlockButton(this.scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, width, height, texture, frame,
                    targetBlockId: targetBlockId,
                    spawnConfig: targetBlockId ? undefined : {
                        id: `spawned-block-${obj.id}`,
                        x: (props.spawnX || 0) * this.mapScale,
                        y: (props.spawnY || 0) * this.mapScale + this.offsetY,
                        width: (props.blockWidth || 16) * this.mapScale,
                        height: (props.blockHeight || 16) * this.mapScale,
                        requiredPlayers: props.requiredPlayers || 1,
                        texture: 'tiles_tileset', frame: 21
                    }
                });
                this.scene.blockButtons.push(button);
                break;
            }
            case 'Elevator': {
                const props = this.getAllObjectProperties(obj);
                this.scene.elevators.push(new Elevator(this.scene, {
                    id: obj.id!.toString(), x: centerX, initialY: centerY,
                    targetY: (props.targetY || 0) * this.mapScale + this.offsetY,
                    width, height, requiredPlayers: props.requiredPlayers || 1, texture, frame
                }));
                break;
            }
            case 'Spring': {
                this.scene.springs.push(new Spring(this.scene, centerX, centerY, obj.id!.toString(), -15, width, height, texture, frame, rotation));
                break;
            }
            case 'Spike': {
                this.scene.spikes.push(new Spike(this.scene, centerX, centerY, obj.id!.toString(), width * 0.8, height, texture, frame, rotation));
                break;
            }
            case 'Bumper': {
                this.scene.bumpers.push(new Bumper(this.scene, centerX, centerY, width, height, texture, frame, rotation));
                break;
            }
            case 'PoisonMushroom':
            case 'Mushroom': {
                this.scene.poisonMushrooms.push(new PoisonMushroom(this.scene, centerX, centerY, obj.id!.toString(), width, height, texture, frame));
                break;
            }
            case 'TogglePlatform': {
                this.scene.togglePlatforms.push(new TogglePlatform(this.scene, centerX, centerY, obj.id!.toString(), width, height));
                break;
            }
            case 'TriggerButton': {
                const props = this.getAllObjectProperties(obj);
                this.scene.triggerButtons.push(new TriggerButton(this.scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, targetId: props.targetId || '',
                    width, height, oneTime: props.oneTime !== undefined ? props.oneTime : true
                }));
                break;
            }
            case 'GhostPlatform': {
                this.scene.ghostPlatforms.push(new GhostPlatform(this.scene, {
                    id: obj.id!.toString(), x: centerX, y: centerY, width, height, texture, frame
                }));
                break;
            }
            case 'MovingBumper': {
                const props = this.getAllObjectProperties(obj);
                this.scene.movingBumpers.push(new MovingBumper(this.scene, {
                    id: obj.id!.toString(), startX: centerX, startY: centerY,
                    endX: props.targetX !== undefined ? props.targetX * this.mapScale : centerX,
                    endY: props.targetY !== undefined ? props.targetY * this.mapScale + this.offsetY : centerY,
                    size: width, speed: props.speed || 0.002, power: props.power, offset: props.offset,
                    texture, frame
                }));
                break;
            }
            case 'Solid': {
                this.scene.matter.add.rectangle(centerX, centerY, width, height, { isStatic: true, label: 'ground' });
                break;
            }
        }
    }

    /**
     * TileLayer 데이터를 기반으로 GhostPlatform 기믹들을 생성합니다. (가로 병합 적용)
     */
    private createGhostPlatformsFromLayer(layerData: Phaser.Tilemaps.LayerData, offsetX: number = 0, offsetY: number = 0): void {
        const width = layerData.width;
        const height = layerData.height;
        const processed = Array.from({ length: height }, () => Array(width).fill(false));
        const tileWidth = this.map.tileWidth * this.mapScale;
        const tileHeight = this.map.tileHeight * this.mapScale;

        const scaledOffsetX = offsetX * this.mapScale;
        const scaledOffsetY = offsetY * this.mapScale;

        // 원시 데이터(data)는 2차원 배열이거나 1차원 배열일 수 있음. Phaser layerData.data는 Tile 객체들의 2차원 배열.
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
                    const centerY = y * tileHeight + pixelHeight / 2 + this.offsetY + scaledOffsetY;

                    // 타일의 텍스처 정보 가져오기 (첫 번째 타일 기준)
                    let texture = '';
                    let frame = 0;
                    const tileset = tile.tileset;
                    if (tileset) {
                        texture = tileset.name;
                        frame = tile.index - tileset.firstgid;
                    }

                    this.scene.ghostPlatforms.push(new GhostPlatform(this.scene, {
                        id: `ghost-layer-${layerData.name}-${x}-${y}`,
                        x: centerX,
                        y: centerY,
                        width: pixelWidth,
                        height: pixelHeight,
                        texture, // 타일셋 텍스처 사용
                        frame: frame // 첫 번째 타일의 프레임 (반복 패턴을 위해선 TileSprite 등의 처리가 필요할 수 있음)
                    }));
                }
            }
        }
    }

    /**
     * Greedy Merging 알고리즘을 사용하여 인접한 충돌 타일들을 하나의 물리 바디로 병합
     */
    public createMergedCollisions(layer: Phaser.Tilemaps.TilemapLayer): void {
        const { width, height } = this.map;
        const mergedRects: { x: number; y: number; w: number; h: number }[] = [];
        const processed = Array.from({ length: height }, () => Array(width).fill(false));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = layer.getTileAt(x, y);
                // Class가 없거나 'Solid'인 경우에만 병합 대상
                const tileClass = tile?.properties.class || (tile?.properties.type);
                const isCollidable = tile?.properties.collides || tileClass === 'Solid';

                if (isCollidable && !processed[y][x]) {
                    // 1. 가로로 얼마나 이어지는지 확인
                    let w = 1;
                    while (x + w < width) {
                        const nextTile = layer.getTileAt(x + w, y);
                        const nextIsCollidable = nextTile?.properties.collides;
                        if (nextIsCollidable && !processed[y][nextTile.x]) {
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
                            const belowIsCollidable = belowTile?.properties.collides;
                            if (!belowIsCollidable || processed[belowTile.y][belowTile.x]) {
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
        const tileWidth = this.map.tileWidth * this.mapScale;
        const tileHeight = this.map.tileHeight * this.mapScale;

        mergedRects.forEach(rect => {
            const pixelWidth = rect.w * tileWidth;
            const pixelHeight = rect.h * tileHeight;
            const centerX = (rect.x * tileWidth) + (pixelWidth / 2);
            const centerY = (rect.y * tileHeight) + (pixelHeight / 2) + this.offsetY + 1; // +1 to fix floating issue

            this.scene.matter.add.rectangle(centerX, centerY, pixelWidth, pixelHeight - 2, {
                isStatic: true,
                label: 'ground',
                friction: 0,
                frictionStatic: 0
            });
        });
    }

    private getObjectProperty(obj: Phaser.Types.Tilemaps.TiledObject, name: string): any {
        if (obj.properties) {
            // properties는 {name, value} 배열일 수도 있고, 키-값 객체일 수도 있습니다 (Phaser 버전에 따라 다름)
            if (Array.isArray(obj.properties)) {
                return obj.properties.find((p: any) => p.name === name)?.value;
            } else {
                return (obj.properties as any)[name];
            }
        }
        return undefined;
    }

    private getAllObjectProperties(obj: Phaser.Types.Tilemaps.TiledObject): any {
        const props: any = {};
        if (obj.properties) {
            if (Array.isArray(obj.properties)) {
                obj.properties.forEach((p: any) => props[p.name] = p.value);
            } else {
                Object.assign(props, obj.properties);
            }
        }
        return props;
    }

    private getLayerProperty(layer: any, name: string): any {
        if (layer.properties) {
            if (Array.isArray(layer.properties)) {
                return layer.properties.find((p: any) => p.name === name)?.value;
            } else {
                return layer.properties[name];
            }
        }
        return undefined;
    }
}
