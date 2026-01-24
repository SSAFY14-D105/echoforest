import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../../store/useGameStore';

/**
 * Stage2Scene - 스테이지 2 (빈 템플릿)
 * 혼자하기 2는 Solo2Scene에서 관리함
 */
export default class Stage2Scene extends BaseGameScene {
    constructor() {
        super({ key: 'Stage2Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage2Scene';
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
        console.log('[Stage2Scene] Gimmicks - Stub');
    }

    protected onStageComplete(): void {
        console.log('[Stage2Scene] 🎉 Stage 2 Complete!');
        useGameStore.getState().clearStage('MULTI_2');
        useGameStore.getState().backToStageSelect();
    }
}
