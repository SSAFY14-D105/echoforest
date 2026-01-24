import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';

/**
 * Stage3Scene - 스테이지 3 (빈 템플릿)
 * 나중에 기믹 추가 예정
 */
export default class Stage3Scene extends BaseGameScene {
    constructor() {
        super({ key: 'Stage3Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage3Scene';
    }

    protected getWorldWidth(): number {
        return 3000;
    }

    protected getWorldHeight(): number {
        return this.scale.height;
    }

    protected getRequiredPlayers(): number {
        return 4;
    }

    protected createGimmicks(): void {
        // TODO: 스테이지 3 기믹 배치
        console.log('[Stage3Scene] Gimmicks - TODO');
    }

    protected onStageComplete(): void {
        console.log('[Stage3Scene] 🎉 Stage 3 Complete! Game Cleared!');
        useGameStore.getState().clearStage('MULTI_3');
        useGameStore.getState().backToStageSelect();
    }
}
