import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
import MapManager from '../utils/MapManager';

/**
 * Solo4Scene - forest_map.tmj를 사용하는 혼자하기 4 씬
 */
export default class Solo4Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Solo4Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo4Scene';
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

        // MapManager 초기화 (맵 로드)
        this.mapManager = new MapManager(this, 'forest_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 비동기 맵 초기화 (충돌체 생성 시 프레임 드롭 방지)
        this.mapManager.initializeAsync('tiles_tileset', 'tiles_tileset', 'background_image')
            .then(() => {
                console.log('[Solo4Scene] Async map initialization complete');
                super.create();
            });
    }

    protected createGimmicks(): void {
        this.mapManager?.createObjects();
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
        console.log('[Solo4Scene] 🎉 Forest Stage Complete! Moving to Test Stage...');
        // 1초 뒤에 스테이지 선택 상태를 SOLO_5로 변경
        this.time.delayedCall(1000, () => {
            useGameStore.getState().selectStage('SOLO_5');
        });
    }
}
