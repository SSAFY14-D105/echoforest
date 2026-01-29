import BaseGameScene from './BaseGameScene';

import MapManager from '../utils/MapManager';

/**
 * Stage3Scene - 스테이지 3
 * stage_03.tmj를 사용하며 MapManager를 통해 맵을 로드하고 기믹을 초기화합니다.
 */
export default class Stage3Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Stage3Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage3Scene';
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
        // 스테이지 3 맵 로드 (stage_03.tmj)
        this.load.tilemapTiledJSON('stage_03_map', 'assets/maps/stage_03.tmj');

        // 타일셋 로드
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });

        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        return false;
    }

    create() {
        console.log('[Stage3Scene] Initializing map from stage_03.tmj using MapManager');

        // MapManager 초기화
        this.mapManager = new MapManager(this, 'stage_03_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 맵 생성 및 초기화
        // Default tileset: tiles_tileset
        this.mapManager.initialize('tiles_tileset', 'tiles_tileset', 'background_image');

        super.create();
    }

    protected createGimmicks(): void {
        this.mapManager?.createObjects();
    }

    protected onStageComplete(): void {
        console.log('[Stage3Scene] 🎉 Stage 3 Complete! Requesting transition...');
        super.onStageComplete();
    }
}
