import BaseGameScene from './BaseGameScene';
import { Key, Lock, Spike, Spring, Goal, BlockButton, Elevator, Bumper, Signboard, MovableBlock, MovingBumper, PoisonMushroom, TogglePlatform, TriggerButton, GhostPlatform, Respawn } from '../gimmicks';
import { useGameStore } from '../../store/useGameStore';

/**
 * Solo4Scene - forest_map.tmj를 사용하는 혼자하기 4 씬
 */
export default class Solo4Scene extends BaseGameScene {
    private map?: Phaser.Tilemaps.Tilemap;
    private mapScale: number = 4; // 16px -> 64px

    constructor() {
        super({ key: 'Solo4Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo4Scene';
    }

    protected getWorldWidth(): number {
        return (this.map?.widthInPixels || 0) * this.mapScale;
    }

    protected getWorldHeight(): number {
        return (this.map?.heightInPixels || 0) * this.mapScale;
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    preload() {
        super.preload();
        // 숲 테마 맵 로드
        this.load.tilemapTiledJSON('forest_map', 'assets/maps/forest_map.tmj');

        // 타일셋 로드 (Tiled의 name과 일치시킴)
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });

        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        return false;
    }

    create() {
        console.log('[Solo4Scene] Initializing forest map');

        this.map = this.make.tilemap({ key: 'forest_map' });
        // 타일 크기 64px 기준 스케일 계산
        this.mapScale = 64 / this.map.tileHeight;

        const mapPixelHeightScaled = this.map.heightInPixels * this.mapScale;
        this.offsetY = Math.max(0, this.scale.height - mapPixelHeightScaled);

        // Matter.js 월드 경계
        const worldWidth = this.getWorldWidth();
        const worldHeight = this.getWorldHeight();
        this.matter.world.setBounds(0, 0, worldWidth, worldHeight);

        // 플레이어 스폰 지점 설정
        this.spawnPoints.push(new Respawn(80 * this.mapScale, worldHeight - 400, 'solo4-default-spawn', undefined, true));

        // 타일셋
        const ts = this.map.addTilesetImage('tiles_tileset', 'tiles_tileset')!;

        // 타일 레이어
        const tilesLayer = this.map.createLayer('tiles', ts, 0, this.offsetY)!;
        tilesLayer.setScale(this.mapScale);
        tilesLayer.setDepth(-10);

        this.createMergedCollisions(tilesLayer);

        // 배경 설정
        this.setupTiledBackground('background_image', 0.2);

        // 기믹 생성 (BaseGameScene의 create()에서 자동으로 호출됨)
        super.create();
    }


    protected createGimmicks(): void {
        if (!this.map) return;

        const objectLayers = this.map.objects;

        objectLayers.forEach(layer => {
            if (!layer.objects) return;

            layer.objects.forEach(obj => {
                const width = (obj.width || 0) * this.mapScale;
                const height = (obj.height || 0) * this.mapScale;

                let centerX = (obj.x || 0) * this.mapScale + width / 2;
                let centerY = (obj.y || 0) * this.mapScale - height / 2 + this.offsetY;

                const gidRaw = obj.gid || 0;
                const gid = gidRaw & ~(0x80000000 | 0x40000000 | 0x20000000 | 0x10000000);

                let texture = '';
                let type = obj.type;

                // Tiled에서 'Spawn' 타입의 오브젝트가 있다면 스폰 지점으로 설정
                if (type === 'Spawn' || obj.name === 'Spawn' || type === 'SpawnPoint') {
                    const playerIndex = this.getTiledProperty(obj, 'playerIndex');
                    const isDefault = this.getTiledProperty(obj, 'isDefault');
                    this.spawnPoints.push(new Respawn(
                        centerX,
                        centerY,
                        `solo4-spawn-${obj.id}`,
                        playerIndex !== undefined ? Number(playerIndex) : undefined,
                        isDefault === true || isDefault === 'true'
                    ));
                    console.log(`[${this.getSceneKey()}] Custom spawn point registered via Tiled: (${centerX}, ${centerY})`);
                    return;
                }

                let frame = 0;

                if (gid > 0) {
                    const tileset = this.map!.tilesets.find(ts =>
                        gid >= ts.firstgid && gid < ts.firstgid + ts.total
                    );
                    if (tileset) {
                        texture = tileset.name;
                        frame = gid - tileset.firstgid;
                    }
                }

                const rotation = obj.rotation || 0;

                // 타입 추론 개선 (class 속성 지원 및 속성 기반 추론)
                const objectType = ((obj as any).type || (obj as any).class || "").trim();

                if (!type) {
                    if (objectType) {
                        type = objectType;
                    } else if (gid === 111 || gid === 131) {
                        type = 'Lock';
                    } else if (gid === 113) {
                        type = 'Goal';
                    } else if (gid === 96 || gid === 30 || obj.name === 'Spawn' || obj.name === 'SpawnPoint') {
                        type = 'Spawn';
                    } else if (this.getTiledProperty(obj, 'playerIndex') !== undefined || this.getTiledProperty(obj, 'isDefault') !== undefined) {
                        type = 'Spawn';
                    } else if (this.getTiledProperty(obj, 'targetX') !== undefined || this.getTiledProperty(obj, 'targetY') !== undefined) {
                        // targetX나 targetY가 있으면 MovingBumper나 Elevator일 가능성이 높음
                        if (this.getTiledProperty(obj, 'speed') !== undefined) {
                            type = 'MovingBumper';
                        } else {
                            type = 'Elevator';
                        }
                    } else if (this.getTiledProperty(obj, 'collides') === true) {
                        type = 'Solid';
                    }
                }

                switch (type) {
                    case 'Signboard': {
                        const message = this.getTiledProperty(obj, 'message') || '내용이 없습니다.';
                        const sign = new Signboard(this, {
                            id: obj.id.toString(),
                            x: centerX,
                            y: centerY,
                            message: message,
                            width,
                            height,
                            texture,
                            frame,
                            angle: rotation
                        });
                        this.signboards.push(sign);
                        break;
                    }
                    case 'Lock': {
                        const doorId = this.getTiledProperty(obj, 'doorId') || 1;
                        const targetGoalId = this.getTiledProperty(obj, 'targetGoalId');
                        const lock = new Lock(this, centerX, centerY, `lock-${doorId}`, width, height, texture, frame, rotation, targetGoalId);
                        this.locks.push(lock);
                        break;
                    }
                    case 'MovableBlock': {
                        const targetBlockId = this.getTiledProperty(obj, 'targetBlockId');
                        const reqPlayers = this.getTiledProperty(obj, 'requiredPlayers') || 1;
                        const block = new MovableBlock(this, {
                            id: obj.id.toString(),
                            x: centerX,
                            y: centerY,
                            width,
                            height,
                            requiredPlayers: reqPlayers,
                            texture,
                            frame,
                            // @ts-ignore
                            targetBlockId: targetBlockId
                        });

                        if (targetBlockId) {
                            block.setVisible(false);
                        }
                        this.movableBlocks.push(block);
                        break;
                    }
                    case 'Goal': {
                        const reqPlayers = this.getTiledProperty(obj, 'requiredPlayers') || this.getRequiredPlayers();
                        const targetGoalId = this.getTiledProperty(obj, 'targetGoalId');
                        const goal = new Goal(this, centerX, centerY, obj.id.toString(), reqPlayers, width, height, texture, frame, rotation, targetGoalId);
                        goal.setVisible(false);
                        this.goals.push(goal);
                        break;
                    }
                    case 'BlockButton': {
                        const props: any = {};
                        obj.properties?.forEach((p: any) => props[p.name] = p.value);
                        const targetBlockId = this.getTiledProperty(obj, 'targetBlockId');

                        const button = new BlockButton(this, {
                            id: obj.id.toString(),
                            x: centerX,
                            y: centerY,
                            width,
                            height,
                            texture,
                            frame,
                            targetBlockId: targetBlockId,
                            spawnConfig: targetBlockId ? undefined : {
                                id: `spawned-block-${obj.id}`,
                                x: (props.spawnX || 0) * this.mapScale,
                                y: (props.spawnY || 0) * this.mapScale + this.offsetY,
                                width: (props.blockWidth || 16) * this.mapScale,
                                height: (props.blockHeight || 16) * this.mapScale,
                                requiredPlayers: props.requiredPlayers || 1,
                                texture: 'tiles_tileset',
                                frame: 21
                            }
                        });
                        this.blockButtons.push(button);
                        break;
                    }
                    case 'Elevator': {
                        const props: any = {};
                        obj.properties?.forEach((p: any) => props[p.name] = p.value);

                        const elevator = new Elevator(this, {
                            id: obj.id.toString(),
                            x: centerX,
                            initialY: centerY,
                            targetY: (props.targetY || 0) * this.mapScale + this.offsetY,
                            width,
                            height,
                            requiredPlayers: props.requiredPlayers || 1,
                            texture,
                            frame
                        });
                        this.elevators.push(elevator);
                        break;
                    }
                    case 'Spring': {
                        const spring = new Spring(this, centerX, centerY, obj.id.toString(), -15, width, height, texture, frame, rotation);
                        this.springs.push(spring);
                        break;
                    }
                    case 'Spike': {
                        const spike = new Spike(this, centerX, centerY, obj.id.toString(), width * 0.8, height, texture, frame, rotation);
                        this.spikes.push(spike);
                        break;
                    }
                    case 'Bumper': {
                        const bumper = new Bumper(this, centerX, centerY, width, height, texture, frame, rotation);
                        this.bumpers.push(bumper);
                        break;
                    }
                    case 'Mushroom':
                    case 'PoisonMushroom': {
                        const mushroom = new PoisonMushroom(this, centerX, centerY, obj.id.toString(), width, height, texture, frame);
                        this.poisonMushrooms.push(mushroom);
                        break;
                    }
                    case 'TogglePlatform': {
                        const platform = new TogglePlatform(this, centerX, centerY, obj.id.toString(), width, height);
                        this.togglePlatforms.push(platform);
                        break;
                    }
                    case 'TriggerButton': {
                        const props: any = {};
                        obj.properties?.forEach((p: any) => props[p.name] = p.value);

                        const button = new TriggerButton(this, {
                            id: obj.id.toString(),
                            x: centerX,
                            y: centerY,
                            targetId: props.targetId || '',
                            width,
                            height,
                            oneTime: props.oneTime !== undefined ? props.oneTime : true
                        });
                        this.triggerButtons.push(button);
                        break;
                    }
                    case 'Key': {
                        const doorId = this.getTiledProperty(obj, 'doorId') || 1;
                        const key = new Key(this, centerX, centerY, obj.id.toString(), `lock-${doorId}`, width, height, texture, frame, rotation);
                        this.keys.push(key);
                        break;
                    }
                    case 'GhostPlatform': {
                        const platform = new GhostPlatform(this, {
                            id: obj.id.toString(),
                            x: centerX,
                            y: centerY,
                            width,
                            height,
                            texture,
                            frame
                        });
                        this.ghostPlatforms.push(platform);
                        break;
                    }
                    case 'MovingBumper': {
                        const targetX = this.getTiledProperty(obj, 'targetX');
                        const targetY = this.getTiledProperty(obj, 'targetY');
                        const speed = this.getTiledProperty(obj, 'speed');
                        const power = this.getTiledProperty(obj, 'power');
                        const offset = this.getTiledProperty(obj, 'offset');

                        const bumper = new MovingBumper(this, {
                            id: obj.id.toString(),
                            startX: centerX,
                            endX: targetX !== undefined ? targetX * this.mapScale : centerX,
                            startY: centerY,
                            endY: targetY !== undefined ? targetY * this.mapScale + this.offsetY : centerY,
                            size: width,
                            speed: speed || 0.002,
                            power: power,
                            offset: offset,
                            texture,
                            frame
                        });
                        this.movingBumpers.push(bumper);
                        break;
                    }
                    case 'Solid': {
                        // 일반적인 충돌체 (Static Body)
                        this.matter.add.rectangle(centerX, centerY, width, height, {
                            isStatic: true,
                            label: 'ground'
                        });
                        break;
                    }
                }
            });
        });
    }

    private getTiledProperty(obj: any, name: string): any {
        return obj.properties?.find((p: any) => p.name === name)?.value;
    }

    /**
     * Greedy Merging 알고리즘을 사용하여 인접한 충돌 타일들을 하나의 물리 바디로 병합
     */
    private createMergedCollisions(layer: Phaser.Tilemaps.TilemapLayer): void {
        const { width, height } = this.map!;
        const mergedRects: { x: number; y: number; w: number; h: number }[] = [];
        const processed = Array.from({ length: height }, () => Array(width).fill(false));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = layer.getTileAt(x, y);
                // GID 기반 하드코딩 필터 제거. Tiled의 'collides' 속성을 신뢰함.
                if (tile?.properties.collides && !processed[y][x]) {
                    // 1. 가로로 얼마나 이어지는지 확인
                    let w = 1;
                    while (x + w < width) {
                        const nextTile = layer.getTileAt(x + w, y);
                        if (nextTile?.properties.collides && !processed[y][nextTile.x]) {
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
                            if (!belowTile?.properties.collides || processed[belowTile.y][belowTile.x]) {
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
        const tileWidth = this.map!.tileWidth * this.mapScale;
        const tileHeight = this.map!.tileHeight * this.mapScale;

        mergedRects.forEach(rect => {
            const pixelWidth = rect.w * tileWidth;
            const pixelHeight = rect.h * tileHeight;
            const centerX = (rect.x * tileWidth) + (pixelWidth / 2);
            const centerY = (rect.y * tileHeight) + (pixelHeight / 2) + this.offsetY + 1;

            this.matter.add.rectangle(centerX, centerY, pixelWidth, pixelHeight - 2, {
                isStatic: true,
                label: 'ground',
                friction: 0,
                frictionStatic: 0
            });
        });
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        return {
            texture: 'tiles_tileset',
            frame: 112,
            width: 64,
            height: 64
        };
    }

    protected onStageComplete(): void {
        console.log('[Solo4Scene] 🎉 Forest Stage Complete!');
        useGameStore.getState().clearStage('SOLO_4');
        useGameStore.getState().leaveGame();
    }
}
