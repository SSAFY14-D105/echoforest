import BaseGameScene from './BaseGameScene';
import { Key, Lock, Spike, Spring, Goal, BlockButton, Elevator, Bumper, Signboard, MovableBlock, Respawn } from '../gimmicks';
import { useGameStore } from '../../store/useGameStore';

/**
 * Stage1Scene - 스테이지 1
 * tutorial_map.tmj를 사용하며 Solo3Scene의 구현 방식을 따릅니다.
 */
export default class Stage1Scene extends BaseGameScene {
    private map?: Phaser.Tilemaps.Tilemap;
    private mapScale: number = 4; // 16px -> 64px

    constructor() {
        super({ key: 'Stage1Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage1Scene';
    }

    protected getWorldWidth(): number {
        return (this.map?.widthInPixels || 0) * this.mapScale;
    }

    protected getWorldHeight(): number {
        return (this.map?.heightInPixels || 0) * this.mapScale;
    }

    protected getRequiredPlayers(): number {
        return 1; // 튜토리얼 성격에 맞춰 1명으로 설정
    }

    preload() {
        super.preload();
        // 튜토리얼 맵 로드
        this.load.tilemapTiledJSON('stage_01_tutorial', 'assets/maps/tutorial_map.tmj');

        // 타일셋 로드 (Tiled의 name과 일치)
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });

        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        return false;
    }

    create() {
        console.log('[Stage1Scene] Initializing map from tutorial_map.tmj');

        this.map = this.make.tilemap({ key: 'stage_01_tutorial' });
        this.mapScale = 64 / this.map.tileHeight;

        const mapPixelHeightScaled = this.map.heightInPixels * this.mapScale;
        this.offsetY = Math.max(0, this.scale.height - mapPixelHeightScaled);

        // Matter.js 월드 경계
        this.matter.world.setBounds(0, 0, this.getWorldWidth(), this.getWorldHeight());

        // 타일셋 및 레이어 설정
        const ts = this.map.addTilesetImage('tiles_tileset', 'tiles_tileset')!;
        const tilesLayer = this.map.createLayer('tiles', ts, 0, this.offsetY)!;
        tilesLayer.setScale(this.mapScale);
        tilesLayer.setDepth(-10);

        this.createMergedCollisions(tilesLayer);

        // 배경 설정
        this.setupTiledBackground('background_image', 0.2);

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
                let frame = 0;
                if (gid > 0) {
                    const tileset = this.map!.tilesets.find(ts => gid >= ts.firstgid && gid < ts.firstgid + ts.total);
                    if (tileset) {
                        texture = tileset.name;
                        frame = gid - tileset.firstgid;
                    }
                }

                // [FIX] Tiled 버전에 따라 type, class 중 하나에 값이 있음
                const objectType = ((obj as any).type || (obj as any).class || "").trim();
                const objName = (obj.name || "").trim();
                let type = obj.type || objectType;

                // GID 또는 다른 속성으로 타입 보정 (96 = Spawn/Respawn gid)
                if (!type) {
                    if (gid === 96 || gid === 30 || objName === 'Spawn' || objName === 'SpawnPoint' || objName === 'Respawn') {
                        type = 'Respawn';
                    }
                }

                // 스폰 지점 처리 (Spawn, SpawnPoint, Respawn 모두 지원)
                if (type === 'Spawn' || type === 'SpawnPoint' || type === 'Respawn' || objName === 'Spawn' || objName === 'SpawnPoint' || objectType === 'Respawn' || gid === 96) {
                    const playerIndex = this.getTiledProperty(obj, 'playerIndex');
                    const isDefault = this.getTiledProperty(obj, 'isDefault');
                    this.spawnPoints.push(new Respawn(
                        centerX,
                        centerY,
                        `stage1-spawn-${obj.id}`,
                        playerIndex !== undefined ? Number(playerIndex) : undefined,
                        isDefault === true || isDefault === 'true'
                    ));
                    console.log(`[Stage1Scene] Respawn point registered: ID ${obj.id}, Index ${playerIndex}, Default: ${isDefault}`);
                    return;
                }

                const rotation = obj.rotation || 0;

                // 기믹 생성 스위치
                switch (type) {
                    case 'Signboard': {
                        const message = this.getTiledProperty(obj, 'message') || '...';
                        this.signboards.push(new Signboard(this, { id: obj.id.toString(), x: centerX, y: centerY, message, width, height, texture, frame, angle: rotation }));
                        break;
                    }
                    case 'Lock': {
                        const doorId = this.getTiledProperty(obj, 'doorId') || 1;
                        const targetGoalId = this.getTiledProperty(obj, 'targetGoalId');
                        this.locks.push(new Lock(this, centerX, centerY, `lock-${doorId}`, width, height, texture, frame, rotation, targetGoalId));
                        break;
                    }
                    case 'Key': {
                        const doorId = this.getTiledProperty(obj, 'doorId') || 1;
                        this.keys.push(new Key(this, centerX, centerY, obj.id.toString(), `lock-${doorId}`, width, height, texture, frame, rotation));
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
                    case 'Spring':
                        this.springs.push(new Spring(this, centerX, centerY, obj.id.toString(), -15, width, height, texture, frame, rotation));
                        break;
                    case 'Spike':
                        this.spikes.push(new Spike(this, centerX, centerY, obj.id.toString(), width * 0.8, height, texture, frame, rotation));
                        break;
                    case 'Bumper':
                        this.bumpers.push(new Bumper(this, centerX, centerY, width, height, texture, frame, rotation));
                        break;
                    case 'MovableBlock':
                        this.movableBlocks.push(new MovableBlock(this, { id: obj.id.toString(), x: centerX, y: centerY, width, height, requiredPlayers: this.getTiledProperty(obj, 'requiredPlayers') || 1, texture, frame }));
                        break;
                    case 'Elevator':
                        const targetY = (this.getTiledProperty(obj, 'targetY') || 0) * this.mapScale + this.offsetY;
                        this.elevators.push(new Elevator(this, { id: obj.id.toString(), x: centerX, initialY: centerY, targetY, width, height, requiredPlayers: this.getTiledProperty(obj, 'requiredPlayers') || 1, texture, frame }));
                        break;
                    case 'BlockButton':
                        const targetBlockId = this.getTiledProperty(obj, 'targetBlockId');
                        this.blockButtons.push(new BlockButton(this, { id: obj.id.toString(), x: centerX, y: centerY, width, height, texture, frame, targetBlockId }));
                        break;
                }
            });
        });
    }

    private getTiledProperty(obj: any, name: string): any {
        return obj.properties?.find((p: any) => p.name === name)?.value;
    }

    private createMergedCollisions(layer: Phaser.Tilemaps.TilemapLayer): void {
        const { width, height } = this.map!;
        const processed = Array.from({ length: height }, () => Array(width).fill(false));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = layer.getTileAt(x, y);
                if (tile?.properties.collides && !processed[y][x]) {
                    let w = 1;
                    while (x + w < width && layer.getTileAt(x + w, y)?.properties.collides && !processed[y][x + w]) w++;

                    let h = 1;
                    while (y + h < height) {
                        let match = true;
                        for (let k = 0; k < w; k++) {
                            if (!layer.getTileAt(x + k, y + h)?.properties.collides || processed[y + h][x + k]) {
                                match = false;
                                break;
                            }
                        }
                        if (match) h++; else break;
                    }

                    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) processed[r][c] = true;

                    const tileWidth = this.map!.tileWidth * this.mapScale;
                    const tileHeight = this.map!.tileHeight * this.mapScale;
                    const pixelWidth = w * tileWidth;
                    const pixelHeight = h * tileHeight;
                    const centerX = x * tileWidth + pixelWidth / 2;
                    const centerY = y * tileHeight + pixelHeight / 2 + this.offsetY + 1;

                    this.matter.add.rectangle(centerX, centerY, pixelWidth, pixelHeight - 2, { isStatic: true, label: 'ground', friction: 0, frictionStatic: 0 });
                }
            }
        }
    }

    protected onStageComplete(): void {
        console.log('[Stage1Scene] 🎉 Stage 1 Complete!');
        useGameStore.getState().clearStage('MULTI_1');
        useGameStore.getState().backToStageSelect();
    }
}
