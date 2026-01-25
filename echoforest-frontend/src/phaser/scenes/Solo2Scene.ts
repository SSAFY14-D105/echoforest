import BaseGameScene from './BaseGameScene';
import { Key, Lock, Spike, Spring, Goal } from '../gimmicks';
import { useGameStore } from '../../store/useGameStore';

/**
 * Solo2Scene - Tiled 맵을 사용하는 혼자하기 2 씬
 */
export default class Solo2Scene extends BaseGameScene {
    private map?: Phaser.Tilemaps.Tilemap;
    private mapScale: number = 2;
    private offsetY: number = 0;

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
        return 720;
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
        // 배경 타일링 설정 (Parallax 0.2로 설정하여 천천히 움직이게 함)
        this.setupTiledBackground('background_image', 0.2);

        // Solo2Scene 전용: 물리 디버그 충돌선 숨기기
        if (this.matter && this.matter.world && this.matter.world.debugConfig) {
            this.matter.world.debugConfig.showBody = false;
            this.matter.world.debugConfig.showStaticBody = false;
            this.matter.world.debugConfig.showInternalEdges = false;
            this.matter.world.debugConfig.showConvexHulls = false;
        }

        this.map = this.make.tilemap({ key: 'solo_2_game_map' });
        // 타일 크기를 64px로 고정 (기본 16px * 4 = 64px)
        this.mapScale = 64 / this.map.tileHeight;

        // 화면 하단에 맞추기 위한 Offset 계산
        const mapPixelHeightScaled = this.map.heightInPixels * this.mapScale;
        this.offsetY = this.scale.height - mapPixelHeightScaled;

        // 타일셋 이미지 추가
        const ts = this.map.addTilesetImage('tiles_tileset', 'tiles_tileset')!;

        // 배경 타일 레이어 생성 (offsetY 적용)
        const tilesLayer = this.map.createLayer('Tiles', ts, 0, this.offsetY)!;
        tilesLayer.setScale(this.mapScale);
        tilesLayer.setDepth(-10);

        // 충돌 설정 (수동 생성으로 판정 범위를 미세 조정)
        tilesLayer.setCollisionByProperty({ collides: true });

        // 자동 변환 대신 수동으로 타일마다 약간 작은 히트박스 생성
        tilesLayer.forEachTile(tile => {
            if (tile.properties.collides) {
                const baseWidth = tile.width * this.mapScale;
                const baseHeight = tile.height * this.mapScale;

                // 판정 범위를 약간 줄임 (좌우 4px, 상단 2px 정도)
                const adjWidth = baseWidth - 4;
                const adjHeight = baseHeight - 2;

                const centerX = tile.pixelX * this.mapScale + baseWidth / 2;
                // 위쪽을 깎기 위해 중심점을 약간 아래로 보정
                const centerY = tile.pixelY * this.mapScale + baseHeight / 2 + this.offsetY + 1;

                this.matter.add.rectangle(centerX, centerY, adjWidth, adjHeight, {
                    isStatic: true,
                    label: 'ground'
                });
            }
        });

        // Goal 타일 레이어 처리 (offsetY 적용)
        const goalLayer = this.map.createLayer('Goal', ts, 0, this.offsetY);
        if (goalLayer) {
            goalLayer.setScale(this.mapScale);
            goalLayer.setVisible(false); // 기믹 객체로 대체할 것이므로 직접 렌더링은 끔

            // Goal 타일(GID 113)을 찾아 기믹 객체 생성
            goalLayer.forEachTile(tile => {
                if (tile.index === 113 - 1) { // Phaser는 0-indexed frame 사용 (firstgid=1 기준)
                    const width = tile.width * this.mapScale;
                    const height = tile.height * this.mapScale;
                    // pixelX/Y는 레이어 내의 픽셀 좌표이므로 offsetY를 더해줌
                    const centerX = tile.pixelX * this.mapScale + width / 2;
                    const centerY = tile.pixelY * this.mapScale + height / 2 + this.offsetY;

                    const goal = new Goal(this, centerX, centerY, `goal-${tile.x}-${tile.y}`, this.getRequiredPlayers(), width, height, 'tiles_tileset', tile.index);
                    goal.setVisible(false);
                    this.goals.push(goal);
                }
            });
        }

        super.create();

        console.log(`[Solo2Scene] Initialization complete. Scale: ${this.mapScale.toFixed(2)}, OffsetY: ${this.offsetY}`);
    }

    protected createGimmicks(): void {
        const objectLayer = this.map?.getObjectLayer('Objects');
        if (!objectLayer) {
            console.warn('[Solo2Scene] Objects layer not found');
            return;
        }

        objectLayer.objects.forEach(obj => {
            // Tiled GID 오브젝트 좌표 계산
            const width = (obj.width || 0) * this.mapScale;
            const height = (obj.height || 0) * this.mapScale;

            // offsetY를 더해 화면 하단 정렬 기준 좌표로 변환
            let centerX = (obj.x || 0) * this.mapScale + width / 2;
            let centerY = (obj.y || 0) * this.mapScale - height / 2 + this.offsetY;

            const gidRaw = obj.gid || 0;
            const gid = gidRaw & ~(0x80000000 | 0x40000000 | 0x20000000 | 0x10000000);
            const rotation = obj.rotation || 0;

            let texture = '';
            let frame = 0;

            if (gid > 0 && this.map) {
                const tileset = this.map.tilesets.find(ts =>
                    gid >= ts.firstgid && gid < ts.firstgid + ts.total
                );

                if (tileset) {
                    texture = tileset.name;
                    frame = gid - tileset.firstgid;
                }
            }

            switch (obj.type) {
                case 'Key': {
                    const lockID = this.getTiledProperty(obj, 'lockId') || 1;
                    const key = new Key(this, centerX, centerY, `key-${obj.id}`, `lock-${lockID}`, width, height, texture, frame, rotation);
                    this.keys.push(key);
                    break;
                }
                case 'Lock': {
                    const lockID = this.getTiledProperty(obj, 'lockId') || 1;
                    const lock = new Lock(this, centerX, centerY, `lock-${lockID}`, width, height, texture, frame, rotation);
                    this.locks.push(lock);
                    break;
                }
                case 'Spike': {
                    // 가시는 가로 판정을 80%로 줄여 너그럽게 만들고,
                    // 세로 판정은 Spike 클래스 내부에서 하단 절반으로 자동 처리됩니다.
                    const adjWidth = width * 0.8;
                    const spike = new Spike(this, centerX, centerY, `spike-${obj.id}`, adjWidth, height, texture, frame, rotation);
                    this.spikes.push(spike);
                    break;
                }
                case 'Spring': {
                    const spring = new Spring(this, centerX, centerY, `spring-${obj.id}`, -15, width, height, texture, frame, rotation);
                    this.springs.push(spring);
                    break;
                }
                case 'Goal': {
                    // 이미 Goal 레이어에서 처리했으므로 중복 생성 방지
                    if (this.goals.length === 0) {
                        const goal = new Goal(this, centerX, centerY, `goal-${obj.id}`, this.getRequiredPlayers(), width, height, texture, frame, rotation);
                        goal.setVisible(false);
                        this.goals.push(goal);
                    }
                    break;
                }
            }
        });
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        return {
            texture: 'tiles_tileset',
            frame: 113 - 1,
            width: 18 * this.mapScale,
            height: 18 * this.mapScale
        };
    }

    private getTiledProperty(obj: any, name: string): any {
        return obj.properties?.find((p: any) => p.name === name)?.value;
    }

    protected onStageComplete(): void {
        console.log('[Solo2Scene] 🎉 Solo mode stage 2 complete!');
        // 혼자하기 2 클리어 후 로비로 이동
        useGameStore.getState().clearStage('SOLO_2');
        useGameStore.getState().leaveGame();
    }
}
