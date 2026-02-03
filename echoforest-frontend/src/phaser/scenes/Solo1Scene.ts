import BaseGameScene from './BaseGameScene';
import MapManager from '../utils/MapManager';
import { useGameStore } from '../../store/useGameStore';

/**
 * Solo1Scene - 혼자하기 1 씬
 * test_map.tmj를 사용하며 MapManager를 통해 맵을 로드하고 기믹을 초기화합니다.
 */
export default class Solo1Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Solo1Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo1Scene';
    }

    preload() {
        super.preload();
        // 맵 로드 (test_map.tmj)
        this.load.tilemapTiledJSON('test_map', 'assets/maps/test_map.tmj');

        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
        // 기믹용 타일셋 로드
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
    }

    protected getWorldWidth(): number {
        return this.mapManager?.getWorldWidth() || 3000;
    }

    protected getWorldHeight(): number {
        return this.mapManager?.getWorldHeight() || 720;
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    create() {
        // console.log('[Solo1Scene] Initializing map from test_map.tmj using MapManager');

        // MapManager 초기화
        this.mapManager = new MapManager(this, 'test_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 맵 생성 및 초기화 (배경 이미지 포함)
        this.mapManager.initializeAsync('tiles_tileset', 'tiles_tileset', 'background_image');

        super.create();
    }

    protected createGimmicks(): void {
        if (this.mapManager) {
            this.mapManager.createObjects();
        } else {
            // console.warn('[Solo1Scene] MapManager not initialized');
        }
    }

    protected shouldSpawnGoalOnUnlock(): boolean {
        // 맵에 이미 Goal이 배치되어 있으므로 false
        return false;
    }

    protected onStageComplete(): void {
        // console.log('[Solo1Scene] 🎉 Solo mode stage 1 complete! Moving to Solo 2.');
        useGameStore.getState().selectStage('SOLO_2');
    }
}
