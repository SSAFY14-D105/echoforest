import BaseGameScene from './BaseGameScene';
import MapManager from '../utils/MapManager';

/**
 * Stage1Scene - 스테이지 1
 * stage_01.tmj를 사용하며 MapManager를 통해 맵을 로드하고 기믹을 초기화합니다.
 */
export default class Stage1Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Stage1Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage1Scene';
    }

    protected getWorldWidth(): number {
        return this.mapManager?.getWorldWidth() || 0;
    }

    protected getWorldHeight(): number {
        return this.mapManager?.getWorldHeight() || 0;
    }

    protected getRequiredPlayers(): number {
        return 4; // 맵 설정(requiredPlayers: 4)에 맞춤, 필요 시 맵 데이터에서 동적으로 가져오게 변경 가능
    }

    preload() {
        super.preload();
        // 스테이지 1 맵 로드 (stage_01.tmj)
        this.load.tilemapTiledJSON('stage_01_map', 'assets/maps/stage_01.tmj');

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
        console.log('[Stage1Scene] Initializing map from stage_01.tmj using MapManager');

        // MapManager 초기화
        this.mapManager = new MapManager(this, 'stage_01_map');
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
        console.log('[Stage1Scene] 🎉 Stage 1 Complete! Requesting transition...');

        // 멀티플레이: 서버에 클리어 신호 전송 (부모 클래스 로직 사용)
        super.onStageComplete();
    }
}
