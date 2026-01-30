import BaseGameScene from './BaseGameScene';
import MapManager from '../utils/MapManager';

/**
 * Stage2Scene
 * 'stage_02.tmj' 맵을 로드하는 두 번째 멀티플레이 스테이지.
 */
export default class Stage2Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Stage2Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage2Scene';
    }

    protected getWorldWidth(): number {
        return this.mapManager?.getWorldWidth() || 0;
    }

    protected getWorldHeight(): number {
        return this.mapManager?.getWorldHeight() || 0;
    }

    protected getRequiredPlayers(): number {
        return 4;
    }

    preload() {
        super.preload();
        // 1. 맵 파일 로드 (Tiled JSON)
        this.load.tilemapTiledJSON('stage_02_map', 'assets/maps/stage_02.tmj');

        // 2. 타일셋 로드
        // Tiled의 tileset name ('tiles_tileset')과 매칭
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });

        // 3. 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        // Tiled Map에서 바닥(Solid)을 처리하므로 기본 바닥 생성 방지
        return false;
    }

    create() {
        // console.log('[Stage2Scene] Initializing stage_02.tmj');

        // 4. MapManager 초기화
        this.mapManager = new MapManager(this, 'stage_02_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 비동기 맵 초기화 (충돌체 생성 시 프레임 드롭 방지)
        this.mapManager.initializeAsync('tiles_tileset', 'tiles_tileset', 'background_image')
            .then(() => {
                // console.log('[Stage2Scene] Async map initialization complete');
                super.create();
            });
    }

    protected createGimmicks(): void {
        // 6. 기믹 생성 위임
        this.mapManager?.createObjects();
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        // stage_02.tmj의 Goal GID는 113 (frame 112)
        return {
            texture: 'tiles_tileset',
            frame: 112,
            width: 64,
            height: 64
        };
    }

    protected onStageComplete(): void {
        // console.log('[Stage2Scene] 🎉 Stage 2 Complete! Requesting transition...');

        // 멀티플레이: 서버에 클리어 신호 전송 (부모 클래스 로직 사용)
        super.onStageComplete();

        // Stage 3로 이동 (자연스러운 연결)
        // [TODO] 서버에서 MULTI_3 신호를 받으면 이동하는 것이 정석이지만,
        // 현재 로컬 테스트나 강제 이동을 위해 직접 호출할 수도 있음.
        // 일단 서버 로직을 따르되, 타임아웃 후 이동 등의 백업 로직이 필요할 수 있음.
        // 여기서는 즉시 이동하도록 유지.
        this.scene.start('Stage3Scene');
    }
}
