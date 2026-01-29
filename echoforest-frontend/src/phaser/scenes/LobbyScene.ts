import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';
import MapManager from '../utils/MapManager';

/**
 * LobbyScene - 대기실 씬
 * lobby_map.tmj를 사용하며 MapManager를 통해 맵을 로드하고 기믹을 초기화합니다.
 */
export default class LobbyScene extends BaseGameScene {
    private mapManager?: MapManager;

    constructor() {
        super({ key: 'LobbyScene' });
    }

    protected getSceneKey(): string {
        return 'LobbyScene';
    }

    protected getWorldWidth(): number {
        // MapManager를 사용하여 맵의 크기 반환
        return this.mapManager?.getWorldWidth() || 1280;
    }

    protected getWorldHeight(): number {
        return this.mapManager?.getWorldHeight() || 720;
    }

    protected getRequiredPlayers(): number {
        return 4;
    }

    preload() {
        super.preload();
        // 로비 맵 로드 (lobby_map.tmj)
        this.load.tilemapTiledJSON('lobby_map', 'assets/maps/lobby_map.tmj');

        // 타일셋 로드 (Stage1과 동일한 타일셋 사용)
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
        this.load.spritesheet('players_tileset', 'assets/tilesets/tilemap-characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1 });

        // 배경 이미지 로드 (필요시)
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected shouldCreateDefaultFloor(): boolean {
        // 맵 파일에서 충돌체를 로드하므로 기본 바닥 생성 방지
        return false;
    }

    create() {
        console.log('[LobbyScene] Initializing map from lobby_map.tmj using MapManager');

        // MapManager 초기화
        this.mapManager = new MapManager(this, 'lobby_map');
        // 로비는 하단 정렬 오프셋을 사용할지 여부를 결정해야 함. 
        // 일반적으로 다른 씬과 동일하게 처리.
        this.offsetY = this.mapManager.getOffsetY();

        // 로비 입장 시 모든 지속성 저주 및 콜백 초기화
        BaseGameScene.resetPersistentCurses();
        useGameStore.getState().setOnMoveCallback(null);

        // 비동기 맵 초기화 (충돌체 생성 시 프레임 드롭 방지)
        this.mapManager.initializeAsync('tiles_tileset', 'tiles_tileset', 'background_image')
            .then(() => {
                console.log('[LobbyScene] Async map initialization complete');
                super.create();
            });
    }

    protected createGimmicks(): void {
        if (this.mapManager) {
            this.mapManager.createObjects();
        } else {
            console.warn('[LobbyScene] MapManager not initialized');
        }
    }
}
