import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
import MapManager from '../utils/MapManager';

/**
 * Solo3Scene - maps/stage_04_solo.tmj를 사용하는 혼자하기 3 씬
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
        // [FIX] 맵이 화면보다 작아서 MapManager가 OffsetY를 적용한 경우를 대비해 최소 화면 높이 반환
        return Math.max(this.mapManager?.getWorldHeight() || 0, this.scale.height);
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    preload() {
        super.preload();
        // 맵 로드 (stage_04_solo.tmj)
        // 주의: 키워드 'stage_04_solo_map' 사용
        this.load.tilemapTiledJSON('stage_04_solo_map', 'assets/maps/stage_04_solo.tmj');

        // 타일셋 로드 (Tiled의 name과 일치시킴)
        // 1. tiles_tileset: 지형 및 기본 기믹
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        // 2. players_tileset: 범퍼 등 특수 기믹
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });

        // 배경 이미지 로드
        // 배경 타일셋 로드 (Tiled의 'backgrounds_tileset'과 일치시킴)
        this.load.spritesheet('backgrounds_tileset', 'assets/tilesets/tilemap-backgrounds.png', { frameWidth: 16, frameHeight: 16, spacing: 1 });
    }

    protected shouldCreateDefaultFloor(): boolean {
        // Tiled Map에서 바닥(Solid)을 처리하므로 기본 바닥 생성 방지
        return false;
    }

    create() {
        // MapManager 초기화 (맵 로드)
        this.mapManager = new MapManager(this, 'stage_04_solo_map');
        this.offsetY = this.mapManager.getOffsetY();

        // 비동기 맵 초기화 (충돌체 생성 시 프레임 드롭 방지)
        this.mapManager.initializeAsync(
            ['tiles_tileset', 'players_tileset', 'backgrounds_tileset'],
            ['tiles_tileset', 'players_tileset', 'backgrounds_tileset']
        )
            .then(() => {
                super.create();
            });
    }

    protected createGimmicks(): void {
        this.mapManager?.createObjects();
    }

    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        // 맵 로딩 방식이므로 MapManager가 처리하지만, 하위 호환성 또는 수동 생성 시 필요할 수 있음
        return {
            texture: 'tiles_tileset',
            frame: 121,
            width: 64,
            height: 64
        };
    }

    protected onStageComplete(): void {
        // 다음 스테이지로 이동 (Solo 4 -> Solo 5 가정, 혹은 메인으로?)
        // 현재 Solo3Scene이지만 맵은 Stage 4를 쓰고 있음.
        // 클리어 시 다음 단계로 이동.
        this.time.delayedCall(1000, () => {
            useGameStore.getState().selectStage('SOLO_4');
        });
    }
}
