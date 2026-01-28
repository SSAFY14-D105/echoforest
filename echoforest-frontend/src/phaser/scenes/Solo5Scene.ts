import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
import MapManager from '../utils/MapManager';

/**
 * Solo5Scene
 * 'forest_test_map.tmj' 맵을 사용하여 MapManager 시스템을 테스트하는 스테이지.
 */
export default class Solo5Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Solo5Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo5Scene';
    }

    protected getWorldWidth(): number {
        return this.mapManager?.getWorldWidth() || 0;
    }

    protected getWorldHeight(): number {
        return this.mapManager?.getWorldHeight() || 0;
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    preload() {
        super.preload();
        // 1. 맵 파일 로드 (Tiled JSON)
        this.load.tilemapTiledJSON('forest_test_map', 'assets/maps/forest_test_map.tmj');

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
        console.log('[Solo5Scene] Initializing forest_test_map');

        // 4. MapManager 초기화
        this.mapManager = new MapManager(this, 'forest_test_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 5. 맵 생성 (Tileset Name, Phaser Cache Key, Background Key)
        this.mapManager.initialize('tiles_tileset', 'tiles_tileset', 'background_image');

        super.create();
    }

    protected createGimmicks(): void {
        // 6. 기믹 생성 위임
        this.mapManager?.createObjects();
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        // forest_test_map.tmj에서 Goal의 GID는 113. (firstgid=1 이므로 frame=112)
        return {
            texture: 'tiles_tileset',
            frame: 112,
            width: 64,
            height: 64
        };
    }

    protected onStageComplete(): void {
        console.log('[Solo5Scene] 🎉 Stage Complete!');
        // 스테이지 클리어 처리 및 선택 화면으로 이동
        useGameStore.getState().clearStage('SOLO_5');
        useGameStore.getState().backToStageSelect();
    }
}
