import BaseGameScene from './BaseGameScene';
import { Key, Lock, Spike, Spring, Goal, PoisonMushroom, BlockButton, TogglePlatform, TriggerButton, Signboard } from '../gimmicks';
import { useGameStore } from '../../store/useGameStore';

/**
 * Solo2Scene - Tiled 맵을 사용하는 혼자하기 2 씬
 */
export default class Solo2Scene extends BaseGameScene {
    private map?: Phaser.Tilemaps.Tilemap;
    private mapScale: number = 4; // 16px -> 64px

    constructor() {
        super({ key: 'Solo2Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo2Scene';
    }

    protected getWorldWidth(): number {
        return (this.map?.widthInPixels || 0) * this.mapScale;
    }

    protected getWorldHeight(): number {
        const mapHeight = (this.map?.heightInPixels || 0) * this.mapScale;
        return Math.max(this.scale.height, mapHeight);
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    preload() {
        super.preload();
        this.load.tilemapTiledJSON('solo_2_game_map', 'assets/maps/solo_2_game_map.tmj');
        // 새 맵에서 사용하는 타일셋 로드
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        return false;
    }

    create() {
        console.log('[Solo2Scene] Initializing new game map');

        this.map = this.make.tilemap({ key: 'solo_2_game_map' });
        // 타일 크기를 64px로 고정 (기본 16px * 4 = 64px)
        this.mapScale = 64 / this.map.tileHeight;

        // 화면 하단에 맞추기 위한 Offset 계산
        const mapPixelHeightScaled = this.map.heightInPixels * this.mapScale;
        this.offsetY = Math.max(0, this.scale.height - mapPixelHeightScaled);

        // Matter.js 월드 경계 설정
        this.matter.world.setBounds(0, 0, this.getWorldWidth(), this.getWorldHeight());

        // 타일셋 이미지 추가
        const ts = this.map.addTilesetImage('tiles_tileset', 'tiles_tileset')!;

        // 배경 타일 레이어 생성
        const tilesLayer = this.map.createLayer('Tiles', ts, 0, this.offsetY)!;
        tilesLayer.setScale(this.mapScale);
        tilesLayer.setDepth(-10);

        // 수동 충돌체 생성 (Greedy 병합 대신 개별 타일 처리 - 미세 조정 유지)
        tilesLayer.forEachTile(tile => {
            if (tile.properties?.collides) {
                const baseWidth = tile.width * this.mapScale;
                const baseHeight = tile.height * this.mapScale;

                // 판정 범위를 약간 줄임 (좌우 4px, 상단 2px 정도)
                const adjWidth = baseWidth - 4;
                const adjHeight = baseHeight - 2;

                const centerX = tile.pixelX * this.mapScale + baseWidth / 2;
                const centerY = tile.pixelY * this.mapScale + baseHeight / 2 + this.offsetY + 1;

                this.matter.add.rectangle(centerX, centerY, adjWidth, adjHeight, {
                    isStatic: true,
                    label: 'ground',
                    friction: 0,
                    frictionStatic: 0
                });
            }
        });

        // 배경 타일링 설정 (Parallax 0.2)
        this.setupTiledBackground('background_image', 0.2);

        super.create();
    }

    protected createGimmicks(): void {
        if (!this.map) return;

        // 모든 오브젝트 그룹을 순회하며 기믹 생성
        this.map.objects.forEach(layer => {
            if (!layer.objects) return;

            layer.objects.forEach(obj => {
                const width = (obj.width || 0) * this.mapScale;
                const height = (obj.height || 0) * this.mapScale;

                // Tiled 오브젝트 중심점 계산 + offsetY
                let centerX = (obj.x || 0) * this.mapScale + width / 2;
                let centerY = (obj.y || 0) * this.mapScale - height / 2 + this.offsetY;

                const gidRaw = obj.gid || 0;
                const gid = gidRaw & ~(0x80000000 | 0x40000000 | 0x20000000 | 0x10000000);
                const rotation = obj.rotation || 0;

                let texture = '';
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

                // Tiled Object 'Type' 또는 'Class' 속성 확인
                let type = obj.type || (obj as any).class;

                // 타입이 명시되지 않은 경우 GID나 속성으로 추론
                if (!type) {
                    if (gid === 113 || gid === 111 || gid === 131) {
                        if (gid === 113) type = 'Goal';
                        else type = 'Lock';
                    }
                }

                switch (type) {
                    case 'Key': {
                        const lockId = this.getTiledProperty(obj, 'lockId') || 1;
                        const key = new Key(this, centerX, centerY, obj.id.toString(), `lock-${lockId}`, width, height, texture, frame, rotation);
                        this.keys.push(key);
                        break;
                    }
                    case 'Lock': {
                        const lockId = this.getTiledProperty(obj, 'lockId') || 1;
                        const targetGoalId = this.getTiledProperty(obj, 'targetGoalId');
                        const lock = new Lock(this, centerX, centerY, `lock-${lockId}`, width, height, texture, frame, rotation, targetGoalId);
                        this.locks.push(lock);
                        break;
                    }
                    case 'Spike': {
                        const spike = new Spike(this, centerX, centerY, obj.id.toString(), width * 0.8, height, texture, frame, rotation);
                        this.spikes.push(spike);
                        break;
                    }
                    case 'Spring': {
                        const spring = new Spring(this, centerX, centerY, obj.id.toString(), -15, width, height, texture, frame, rotation);
                        this.springs.push(spring);
                        break;
                    }
                    case 'Goal': {
                        const reqPlayers = this.getTiledProperty(obj, 'requiredPlayers') || this.getRequiredPlayers();
                        const targetGoalId = this.getTiledProperty(obj, 'targetGoalId');
                        const goal = new Goal(this, centerX, centerY, obj.id.toString(), reqPlayers, width, height, texture, frame, rotation, targetGoalId);

                        // targetGoalId가 있으면 잠겨있는 골이므로 비활성 상태로 시작
                        goal.setVisible(!targetGoalId);
                        this.goals.push(goal);
                        break;
                    }
                    case 'Mushroom':
                    case 'PoisonMushroom': {
                        const mushroom = new PoisonMushroom(this, centerX, centerY, obj.id.toString(), width, height, texture, frame);
                        this.poisonMushrooms.push(mushroom);
                        break;
                    }
                    case 'Button':
                    case 'BlockButton': {
                        const targetBlockId = this.getTiledProperty(obj, 'targetBlockId');
                        const props: any = {};
                        obj.properties?.forEach((p: any) => props[p.name] = p.value);

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
                                requiredPlayers: props.reqPlayers || 1,
                                texture: 'tiles_tileset',
                                frame: 21
                            }
                        });
                        this.blockButtons.push(button);
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
                    case 'Signboard': {
                        const message = this.getTiledProperty(obj, 'message') || '';
                        const sign = new Signboard(this, {
                            id: obj.id.toString(),
                            x: centerX,
                            y: centerY,
                            message,
                            width,
                            height,
                            texture,
                            frame
                        });
                        this.signboards.push(sign);
                        break;
                    }
                }
            });
        });
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        return {
            texture: 'tiles_tileset',
            frame: 121,
            width: 64,
            height: 64
        };
    }

    private getTiledProperty(obj: any, name: string): any {
        return obj.properties?.find((p: any) => p.name === name)?.value;
    }

    protected shouldSpawnGoalOnUnlock(): boolean {
        return false; // Tiled에서 직접 배치하므로 비활성화
    }

    protected onStageComplete(): void {
        console.log('[Solo2Scene] 🎉 Solo mode stage 2 complete!');
        useGameStore.getState().selectStage('SOLO_3');
    }
}
