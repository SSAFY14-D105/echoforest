import BaseGameScene from './BaseGameScene';
import MapManager from '../utils/MapManager';

/**
 * Stage4Scene - 스테이지 4
 * stage_04.tmj를 사용하며, 3개의 타일셋(기본, 캐릭터, 배경)을 로드합니다.
 */
export default class Stage4Scene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'Stage4Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage4Scene';
    }

    protected getWorldWidth(): number {
        return this.mapManager?.getWorldWidth() || 0;
    }

    protected getWorldHeight(): number {
        return this.mapManager?.getWorldHeight() || 0;
    }

    protected getRequiredPlayers(): number {
        return 4; // 맵 데이터를 기반으로 추정, 필요 시 수정 가능
    }

    preload() {
        super.preload();
        // 스테이지 4 맵 로드
        this.load.tilemapTiledJSON('stage_04_map', 'assets/maps/stage_04.tmj');

        // 타일셋 로드 (3종류)
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });
        this.load.spritesheet('backgrounds_tileset', 'assets/tilesets/tilemap-backgrounds.png', { frameWidth: 16, frameHeight: 16, spacing: 1 });

        // 배경 이미지 로드 (필요 시 유지, 현재는 공통 배경 사용 중인 것으로 보임)
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        // Tiled Map에서 바닥(Solid)을 처리하므로 기본 바닥 생성 방지
        return false;
    }

    create() {
        // MapManager 초기화
        this.mapManager = new MapManager(this, 'stage_04_map');
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
        // stage_04.tmj는 players_tileset과 backgrounds_tileset을 모두 사용함
        this.mapManager?.getMap().addTilesetImage('players_tileset', 'players_tileset');
        this.mapManager?.getMap().addTilesetImage('backgrounds_tileset', 'backgrounds_tileset');

        this.mapManager?.createObjects();
    }

    protected onStageComplete(): void {
        // 멀티플레이: 서버에 클리어 신호 전송 -> 이후 엔딩 미션 및 이동은 서버 제어
        super.onStageComplete();
    }
}
