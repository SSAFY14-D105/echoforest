import BaseGameScene, { PHYSICS } from './BaseGameScene';
import { Key, Lock, Spike, Spring, Elevator, MovableBlock, Bumper, MovingBumper, Goal } from '../gimmicks';
import { useGameStore } from '../../../store/useGameStore';

/**
 * Solo1Scene - 혼자하기 1 씬
 * 기존 SoloScene에서 이름 변경
 */
export default class Solo1Scene extends BaseGameScene {
    constructor() {
        super({ key: 'Solo1Scene' });
    }

    protected getSceneKey(): string {
        return 'Solo1Scene';
    }

    preload() {
        super.preload();
        // 배경 이미지 로드
        this.load.image('background_image', 'assets/backgrounds/background_image.png');
    }

    protected getWorldWidth(): number {
        return 3000;
    }

    protected getWorldHeight(): number {
        return this.scale.height;
    }

    protected getRequiredPlayers(): number {
        return 1;
    }

    protected createGimmicks(): void {
        const floorY = this.gameHeight - 40 - PHYSICS.PLAYER_SIZE / 2;

        // Bumper (x: 300 위치) - 테스트용 테두리에 남겨둠
        const bumper1 = new Bumper(this, 300, floorY - 50, 60, 10);
        this.bumpers.push(bumper1);

        // Moving Bumper (x: 1500 ~ 1900 사이 왕복) - 두 번째 가시 위쪽
        const movingBumper1 = new MovingBumper(this, {
            id: 'mb1',
            startX: 1500,
            endX: 1900,
            y: floorY - 150,
            size: 50,
            speed: 0.003,
            power: 12
        });
        this.movingBumpers.push(movingBumper1);

        // Key & Lock (1세트)
        // Key는 앞부분, Lock(Goal 위치)은 맨 끝에 배치
        const key1 = new Key(this, 400, floorY - 50, 'key1', 'lock1');
        const lock1 = new Lock(this, 2900, floorY - 32, 'lock1', 32, 64);
        this.keys.push(key1);
        this.locks.push(lock1);

        // Spike (x: 900 위치)
        const spike1 = new Spike(this, 900, floorY + 8, 'spike1', 64);
        this.spikes.push(spike1);

        // Spring (x: 1600 위치) - 스파이크 넘기용
        const spring1 = new Spring(this, 1600, floorY + 8, 'spring1', -18);
        this.springs.push(spring1);

        // Spike (x: 1700 위치) - 스프링으로 넘어야 함
        const spike2 = new Spike(this, 1700, floorY + 8, 'spike2', 96);
        this.spikes.push(spike2);

        // Elevator (x: 1950 위치)
        const elevator1 = new Elevator(this, {
            id: 'elevator1',
            x: 1950,
            initialY: floorY + 8,
            targetY: floorY - 200,
            width: 120,
            height: 20,
            requiredPlayers: 1
        });
        this.elevators.push(elevator1);

        // MovableBlock 1 (x: 2100 위치)
        const block1 = new MovableBlock(this, {
            id: 'block1',
            x: 2100,
            y: floorY,
            width: 32,
            height: 32,
            requiredPlayers: 1
        });
        this.movableBlocks.push(block1);

        // MovableBlock 2 (x: 2600 위치)
        const block2 = new MovableBlock(this, {
            id: 'block2',
            x: 2600,
            y: floorY - 16,
            width: 64,
            height: 64,
            requiredPlayers: 2 // 혼자하기에서도 테스트를 위해 2인용으로 유지
        });
        this.movableBlocks.push(block2);

        // Goal (Lock 바로 뒤 또는 같은 위치에 배치)
        const goal1 = new Goal(this, 2950, floorY - 32, 'goal1', 1);
        goal1.setVisible(false);
        this.goals.push(goal1);

        console.log('[SoloScene] Gimmicks restored to original layout (1 Key-Lock-Goal Set)');
    }

    create() {
        // 배경 타일링 설정 (Parallax 0.2)
        this.setupTiledBackground('background_image', 0.2);
        super.create();
    }


    protected onStageComplete(): void {
        console.log('[Solo1Scene] 🎉 Solo mode stage 1 complete! Moving to Solo 2.');
        useGameStore.getState().selectStage('SOLO_2');
    }
}
