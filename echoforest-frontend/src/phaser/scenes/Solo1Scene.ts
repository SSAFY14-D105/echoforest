import BaseGameScene, { PHYSICS } from './BaseGameScene';
import { Key, Lock, Spike, Spring, Elevator, MovableBlock, Bumper, MovingBumper, Goal, PoisonMushroom, BlockButton, TogglePlatform, TriggerButton, Signboard, GhostPlatform, Respawn } from '../gimmicks';
import { useGameStore } from '../../store/useGameStore';

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
        // 기믹용 타일셋 로드
        this.load.spritesheet('tiles_tileset', 'assets/tilesets/tilemap.png', { frameWidth: 18, frameHeight: 18, spacing: 1 });
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

        // 리스폰 위치 설정
        this.spawnPoints.push(new Respawn(100, floorY, 'solo1-default-spawn', undefined, true));

        // Bumper (x: 300 위치) - 테스트용 테두리에 남겨둠
        const bumper1 = new Bumper(this, 300, floorY - 100, 60, 10);
        this.bumpers.push(bumper1);

        // Moving Bumper (x: 1500 ~ 1900 사이 왕복) - 두 번째 가시 위쪽
        const movingBumper1 = new MovingBumper(this, {
            id: 'mb1',
            startX: 1500,
            endX: 1900,
            startY: floorY - 150,
            endY: floorY - 150,
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

        // 독버섯 테스트용 하나 추가 (x: 600 위치)
        const mushroom1 = new PoisonMushroom(this, 600, floorY + 8, 'test-mushroom');
        this.poisonMushrooms.push(mushroom1);

        // 블록 소환 버튼 테스트 (x: 800 위치)
        const button1 = new BlockButton(this, {
            id: 'test-button',
            x: 800,
            y: floorY + 12,
            spawnConfig: {
                id: 'spawned-block-1',
                x: 1000,
                y: floorY,
                width: 32,
                height: 32,
                requiredPlayers: 1
            }
        });
        this.blockButtons.push(button1);

        // 플랫폼 토글 테스트 (x: 1300 위치에 벽 설치, x: 1100 위치에 버튼)
        const platform1 = new TogglePlatform(this, 1300, floorY - 64, 'test-platform', 32, 128);
        this.togglePlatforms.push(platform1);

        const trigger1 = new TriggerButton(this, {
            id: 'test-trigger',
            x: 1100,
            y: floorY + 12,
            targetId: 'test-platform'
        });
        this.triggerButtons.push(trigger1);

        // 안내판 테스트 (시작 지점)
        const sign1 = new Signboard(this, {
            id: 'sign1',
            x: 200,
            y: floorY + 8,
            message: '환영합니다! 아래 방향키(▼)를 눌러 안내판을 읽을 수 있습니다.'
        });
        this.signboards.push(sign1);

        // 유령 플랫폼 테스트 (Reveal 효과)
        const key2 = new Key(this, 2400, floorY - 100, 'key2', 'none');
        this.keys.push(key2);

        const ghost1 = new GhostPlatform(this, {
            id: 'ghost1',
            x: 2400,
            y: floorY - 100,
            width: 96,
            height: 96,
            color: 0x3498db,
            alpha: 1.0 // 평상시에는 불투명하게 설정
        });
        this.ghostPlatforms.push(ghost1);
    }

    create() {
        // 배경 타일링 설정 (Parallax 0.2)
        this.setupTiledBackground('background_image', 0.2);
        super.create();
    }

    protected shouldSpawnGoalOnUnlock(): boolean {
        return true;
    }

    protected onStageComplete(): void {
        console.log('[Solo1Scene] 🎉 Solo mode stage 1 complete! Moving to Solo 2.');
        useGameStore.getState().selectStage('SOLO_2');
    }
}
