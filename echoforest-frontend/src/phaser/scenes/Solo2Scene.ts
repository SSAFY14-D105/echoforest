import BaseGameScene from './BaseGameScene';
import MapManager from '../utils/MapManager';
import { Respawn } from '../gimmicks';
import { useGameStore } from '../../store/useGameStore';

/**
 * Solo2Scene - Tiled 맵을 사용하는 혼자하기 2 씬
 * Refactored to use MapManager and stage_03_solo.tmj
 */
export default class Solo2Scene extends BaseGameScene {
    private mapManager!: MapManager;

    constructor() {
        super({ key: 'Solo2Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo2Scene';
    }

    protected getWorldWidth(): number {
        return this.mapManager ? this.mapManager.getWorldWidth() : 0;
    }

    protected getWorldHeight(): number {
        return this.mapManager ? this.mapManager.getWorldHeight() : 0;
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    preload() {
        super.preload();
        // stage_03_solo.tmj 로드
        this.load.tilemapTiledJSON('stage_03_solo', 'assets/maps/stage_03_solo.tmj');
        // 새 맵에서 사용하는 타일셋 로드
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });
        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        return false;
    }

    create() {
        // console.log('[Solo2Scene] Initializing new game map with MapManager');

        // MapManager 인스턴스 생성 (getWorldWidth/Height 등에서 사용 위함)
        this.mapManager = new MapManager(this, 'stage_03_solo');

        super.create();
    }

    protected createGimmicks(): void {
        // console.log('[Solo2Scene] Creating gimmicks via MapManager');

        // 타일 및 레이어 초기화
        this.mapManager.initialize('tiles_tileset', 'tiles_tileset', 'background_image');
        this.mapManager.getMap().addTilesetImage('players_tileset', 'players_tileset');

        // 기믹 생성
        this.mapManager.createObjects();

        // [Fix] 맵에 스폰 포인트가 없는 경우 기본 스폰 포인트 생성 (임시 위치)
        if (this.spawnPoints.length === 0) {
            console.warn('[Solo2Scene] No spawn points found in map. Creating default spawn point.');
            const defaultSpawn = new Respawn(this, 200, 400, 'default-spawn', 0, true);
            this.spawnPoints.push(defaultSpawn);
        }

        // offsetY 설정 (MapManager에서 계산된 값 사용)
        this.offsetY = this.mapManager.getOffsetY();
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        return {
            texture: 'tiles_tileset',
            frame: 121,
            width: 64,
            height: 64
        };
    }

    protected shouldSpawnGoalOnUnlock(): boolean {
        return false; // Tiled에서 직접 배치하므로 비활성화
    }

    protected onStageComplete(): void {
        // console.log('[Solo2Scene] 🎉 Solo mode stage 2 complete!');
        useGameStore.getState().selectStage('SOLO_3');
    }
}
