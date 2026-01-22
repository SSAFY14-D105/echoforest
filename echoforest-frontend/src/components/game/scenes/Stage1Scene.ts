import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../../store/useGameStore';

/**
 * Stage1Scene - 스테이지 1 (빈 템플릿)
 * 나중에 기믹 추가 예정
 */
export default class Stage1Scene extends BaseGameScene {
    constructor() {
        super({ key: 'Stage1Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage1Scene';
    }

    protected getWorldWidth(): number {
        return 2000;
    }

    protected getWorldHeight(): number {
        return this.scale.height;
    }

    protected getRequiredPlayers(): number {
        return 4;
    }

    protected createGimmicks(): void {
        // TODO: 스테이지 1 기믹 배치
        console.log('[Stage1Scene] Gimmicks - TODO');
    }

    protected onStageComplete(): void {
        console.log('[Stage1Scene] 🎉 Stage 1 Complete!');
        useGameStore.getState().clearStage('MULTI_1');
        useGameStore.getState().backToStageSelect();
    }
}
