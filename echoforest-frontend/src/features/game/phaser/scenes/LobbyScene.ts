import BaseGameScene from './BaseGameScene';
import { useGameStore } from '../../store/useGameStore';

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

    protected getWorldHeight(): number {
        return this.scale.height;
    }

    protected getRequiredPlayers(): number {
        return 4;
    }

    create() {
        // 로비 입장 시 모든 지속성 저주 및 콜백 초기화
        BaseGameScene.resetPersistentCurses();
        useGameStore.getState().setOnMoveCallback(null);

        super.create();
    }

    protected createGimmicks(): void {
        // 대기실에는 기믹 없음
        console.log('[LobbyScene] No gimmicks (lobby)');
    }
}
