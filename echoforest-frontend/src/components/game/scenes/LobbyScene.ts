import BaseGameScene from './BaseGameScene';

/**
 * LobbyScene - 대기실 씬
 * 기믹 없음, 플레이어만 표시
 */
export default class LobbyScene extends BaseGameScene {
    constructor() {
        super({ key: 'LobbyScene' });
    }

    protected getSceneKey(): string {
        return 'LobbyScene';
    }

    protected getWorldWidth(): number {
        // 대기실은 화면에 보이는 공간이 맵 크기
        return this.scale.width;
    }

    protected getRequiredPlayers(): number {
        return 4;
    }

    protected createGimmicks(): void {
        // 대기실에는 기믹 없음
        console.log('[LobbyScene] No gimmicks (lobby)');
    }
}
