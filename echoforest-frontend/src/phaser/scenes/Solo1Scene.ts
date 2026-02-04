import BaseGameScene from './BaseGameScene';
import MapManager from '../utils/MapManager';
import { useGameStore } from '../../store/useGameStore';

/**
 * Solo1Scene - 혼자하기 1 씬
 * stage_02.tmj를 사용하며 MapManager를 통해 맵을 로드하고 기믹을 초기화합니다.
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
        // 스테이지 2 맵 로드
        this.load.tilemapTiledJSON('stage_02_map', 'assets/maps/stage_02.tmj');

        // 타일셋 로드 (3종류)
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });
        this.load.spritesheet('backgrounds_tileset', 'assets/tilesets/tilemap-backgrounds.png', { frameWidth: 16, frameHeight: 16, spacing: 1 });

        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected getWorldWidth(): number {
        return this.mapManager?.getWorldWidth() || 0;
    }

    protected getWorldHeight(): number {
        return this.mapManager?.getWorldHeight() || 0;
    }

    protected shouldCreateDefaultFloor(): boolean {
        // Tiled Map에서 바닥(Solid)을 처리하므로 기본 바닥 생성 방지
        return false;
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    create() {
        // MapManager 초기화
        this.mapManager = new MapManager(this, 'stage_02_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 비동기 맵 초기화 (모든 타일셋 전달)
        this.mapManager.initializeAsync(
            ['tiles_tileset', 'players_tileset', 'backgrounds_tileset'],
            ['tiles_tileset', 'players_tileset', 'backgrounds_tileset'],
            'background_image'
        )
            .then(() => {
                super.create();
            });
    }

    protected createGimmicks(): void {
        // [중요] 추가 타일셋 등록
        // stage_02.tmj는 players_tileset과 backgrounds_tileset을 모두 사용함
        this.mapManager?.getMap().addTilesetImage('players_tileset', 'players_tileset');
        this.mapManager?.getMap().addTilesetImage('backgrounds_tileset', 'backgrounds_tileset');

        this.mapManager?.createObjects();
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
