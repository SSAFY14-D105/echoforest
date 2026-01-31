import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
import MapManager from '../utils/MapManager';

/**
 * Solo5Scene
 * 'stage_03_solo.tmj' 맵을 사용하여 MapManager 시스템을 테스트하는 스테이지.
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
        this.load.tilemapTiledJSON('stage_03_solo_map', 'assets/maps/stage_03_solo.tmj');

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
        // console.log('[Solo5Scene] Initializing stage_03_solo.tmj');

        // 4. MapManager 초기화
        this.mapManager = new MapManager(this, 'stage_03_solo_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 비동기 맵 초기화 (충돌체 생성 시 프레임 드롭 방지)
        this.mapManager.initializeAsync('tiles_tileset', 'tiles_tileset', 'background_image')
            .then(() => {
                // console.log('[Solo5Scene] Async map initialization complete');
                super.create();
            });
    }

    protected createGimmicks(): void {
        // 6. 기믹 생성 위임
        this.mapManager?.createObjects();
    }

    protected onStageComplete(): void {
        // console.log('[Solo5Scene] 🎉 Stage Complete!');
        // 스테이지 클리어 처리 및 선택 화면으로 이동
        useGameStore.getState().clearStage('SOLO_5');
        useGameStore.getState().backToStageSelect();
    }
}
