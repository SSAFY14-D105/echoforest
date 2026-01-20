import BaseGameScene from './BaseGameScene';

/**
 * Stage2Scene - 스테이지 2 (빈 템플릿)
 * 나중에 기믹 추가 예정
 */
export default class Stage2Scene extends BaseGameScene {
    constructor() {
        super({ key: 'Stage2Scene' });
    }

    protected getSceneKey(): string {
        return 'Stage2Scene';
    }

    protected getWorldWidth(): number {
        return 2500;
    }

    protected getRequiredPlayers(): number {
        return 4;
    }

    protected createGimmicks(): void {
        // TODO: 스테이지 2 기믹 배치
        console.log('[Stage2Scene] Gimmicks - TODO');
    }

    protected onStageComplete(): void {
        console.log('[Stage2Scene] 🎉 Stage 2 Complete!');
        // TODO: 스테이지 3으로 이동
    }
}
