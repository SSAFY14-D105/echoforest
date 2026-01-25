import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';

/**
 * Stage1Scene - 스테이지 1
 * TMJ 파일을 읽어서 맵을 생성합니다.
 */
export default class Stage1Scene extends BaseGameScene {
    constructor() {
        super({ key: 'Stage1Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage1Scene';
    }

    protected getWorldWidth(): number {
        return this.worldWidth;
    }

    protected getWorldHeight(): number {
        // TMJ 파싱을 통해 계산된 필드값 사용 (또는 기본값)
        const data = this.cache.json.get('stage_01');
        if (data && data.height) {
            const targetTileSize = this.scale.height / data.height;
            return data.height * targetTileSize;
        }
        return this.scale.height;
    }

    protected getRequiredPlayers(): number {
        return 1; // 테스트를 위해 1명으로 설정
    }

    preload() {
        // Tiled TMJ 파일 로드
        this.load.json('stage_01', '/assets/maps/stage_01.tmj');

        // 타일셋 이미지 로드 (GID 21-24 용)
        // 16x16 크기의 타일들이 들어있는 스프라이트 시트로 로드
        this.load.spritesheet('stage_tiles', '/assets/tilesets/01 Colourful Platformer - Normal Tileset.png', {
            frameWidth: 16,
            frameHeight: 16
        });
    }

    protected createGimmicks(): void {
        // TMJ 데이터 파싱 및 배치
        this.parseTiledData('stage_01');
        console.log('[Stage1Scene] Map parsed from stage_01.tmj');
    }

    protected onStageComplete(): void {
        console.log('[Stage1Scene] 🎉 Stage 1 Complete!');
        useGameStore.getState().clearStage('MULTI_1');
        useGameStore.getState().backToStageSelect();
    }
}
