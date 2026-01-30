import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
import MapManager from '../utils/MapManager';

/**
 * Solo3Scene - tutorial_map.tmj를 사용하는 혼자하기 3 씬
 */
export default class Solo3Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Solo3Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo3Scene';
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
        // 튜토리얼 맵 로드
        this.load.tilemapTiledJSON('tutorial_map', 'assets/maps/tutorial_map.tmj');

        // 타일셋 로드 (Tiled의 name과 일치시킴)
        // 1. tiles_tileset: 지형 및 기본 기믹
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        // 2. players_tileset: 범퍼 등 특수 기믹
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });

        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        return false;
    }

    create() {
        // console.log('[Solo3Scene] Initializing tutorial map');

        // MapManager 초기화 (맵 로드)
        this.mapManager = new MapManager(this, 'tutorial_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 비동기 맵 초기화 (충돌체 생성 시 프레임 드롭 방지)
        this.mapManager.initializeAsync('tiles_tileset', 'tiles_tileset', 'background_image')
            .then(() => {
                // console.log('[Solo3Scene] Async map initialization complete');
                super.create();
            });
    }

    protected createGimmicks(): void {
        this.mapManager?.createObjects();
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        return {
            texture: 'tiles_tileset',
            frame: 121, // 깃발 타일 (GID 122 -> Index 121)
            width: 64,
            height: 64
        };
    }

    protected onStageComplete(): void {
        // console.log('[Solo3Scene] 🎉 Tutorial Stage Complete! Moving to Forest Stage...');

        // 1초 뒤에 스테이지 선택 상태를 SOLO_4로 변경 (React 및 Phaser 전환 유도)
        this.time.delayedCall(1000, () => {
            useGameStore.getState().selectStage('SOLO_4');
        });
    }
}
