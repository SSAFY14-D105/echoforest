import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
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
        console.log('[Stage2Scene] Initializing stage_02.tmj');

        // 4. MapManager 초기화
        this.mapManager = new MapManager(this, 'stage_02_map');
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
        // stage_02.tmj의 Goal GID는 113 (frame 112)
        return {
            texture: 'tiles_tileset',
            frame: 112,
            width: 64,
            height: 64
        };
    }

    protected onStageComplete(): void {
        console.log('[Stage2Scene] 🎉 Stage 2 Complete! Requesting transition...');

        // 멀티플레이: 서버에 클리어 신호 전송 (부모 클래스 로직 사용)
        // Stage 3가 있다면 서버가 MULTI_3로 보낼 것이고, 없다면 서버 로직에 따라 처리됨
        super.onStageComplete();
    }
}
