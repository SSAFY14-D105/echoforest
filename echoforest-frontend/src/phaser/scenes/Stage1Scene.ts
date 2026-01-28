import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
import MapManager from '../utils/MapManager';

/**
 * Stage1Scene - 스테이지 1
 * tutorial_map.tmj를 사용하며 Solo3Scene의 구현 방식을 따릅니다.
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
        console.log('[Stage1Scene] 🎉 Stage 1 Complete! Advancing to Stage 2...');

        // 스테이지 클리어 처리 (필요시 Store 업데이트)
        useGameStore.getState().clearStage('MULTI_1');

        // 다음 스테이지로 이동 (자연스러운 연결)
        this.scene.start('Stage2Scene');
    }
}
