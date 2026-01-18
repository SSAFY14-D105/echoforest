import Phaser from 'phaser';

const PLAYER_COLORS = [0x4CAF50, 0x2196F3, 0xFF9800, 0x9C27B0]; // P1~P4 색상

// 물리 파라미터 (쉽게 조정 가능)
const PHYSICS = {
    GRAVITY: 1,
    MOVE_SPEED: 5,
    ACCELERATION: 0.5,
    DECELERATION: 0.9,
    JUMP_POWER: -12,
    FRICTION: 0.05,
    AIR_FRICTION: 0.02,
    RESTITUTION: 0.1
};

interface Player {
    body: MatterJS.BodyType;
    graphics: Phaser.GameObjects.Graphics;
    playerId: string;
    color: number;
}

export default class MainScene extends Phaser.Scene {
    private players: Map<string, Player> = new Map();
    private myPlayerId: string = 'player1'; // 임시
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private worldWidth: number = 3000; // 횡스크롤 맵 너비

    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // 나중에 에셋 로드
    }

    create() {
        // Matter.js 물리 world 설정 (넓은 맵)
        this.matter.world.setBounds(0, 0, this.worldWidth, 600);

        // 바닥 플랫폼 (긴 바닥)
        this.matter.add.rectangle(this.worldWidth / 2, 580, this.worldWidth, 40, {
            isStatic: true,
            label: 'ground'
        });

        // 테스트: 4명의 플레이어 생성
        this.createPlayer('player1', 100, 300, 0); // P1 녹색
        this.createPlayer('player2', 200, 300, 1); // P2 파란색
        this.createPlayer('player3', 300, 300, 2); // P3 주황색
        this.createPlayer('player4', 400, 300, 3); // P4 보라색

        // 키보드 입력
        this.cursors = this.input.keyboard?.createCursorKeys();

        // 카메라 설정 (월드 전체)
        this.cameras.main.setBounds(0, 0, this.worldWidth, 600);
    }

    createPlayer(playerId: string, x: number, y: number, colorIndex: number) {
        // 플레이어 물리 바디
        const body = this.matter.add.rectangle(x, y, 32, 48, {
            label: playerId,
            friction: PHYSICS.FRICTION,
            frictionAir: PHYSICS.AIR_FRICTION,
            restitution: PHYSICS.RESTITUTION
        });

        // 회전 완전 고정 (피코파크 스타일)
        this.matter.body.setInertia(body, Infinity);

        // 플레이어 그래픽 (색상)
        const graphics = this.add.graphics();
        const color = PLAYER_COLORS[colorIndex];
        graphics.fillStyle(color, 1);
        graphics.fillRect(-16, -24, 32, 48);

        // 플레이어 저장
        this.players.set(playerId, { body, graphics, playerId, color });
    }

    update() {
        // 모든 플레이어의 그래픽을 물리 바디 위치에 맞춤
        this.players.forEach(player => {
            player.graphics.setPosition(player.body.position.x, player.body.position.y);
        });

        // 카메라가 모든 플레이어를 포함하도록 조정
        this.updateCamera();

        // 내 플레이어만 조작
        const myPlayer = this.players.get(this.myPlayerId);
        if (!myPlayer || !this.cursors) return;

        const velocity = myPlayer.body.velocity;

        // 좌우 이동 (가속도 방식)
        if (this.cursors.left.isDown) {
            this.matter.body.setVelocity(myPlayer.body, {
                x: Math.max(velocity.x - PHYSICS.ACCELERATION, -PHYSICS.MOVE_SPEED),
                y: velocity.y
            });
        } else if (this.cursors.right.isDown) {
            this.matter.body.setVelocity(myPlayer.body, {
                x: Math.min(velocity.x + PHYSICS.ACCELERATION, PHYSICS.MOVE_SPEED),
                y: velocity.y
            });
        } else {
            // 키를 떼면 감속
            this.matter.body.setVelocity(myPlayer.body, {
                x: velocity.x * PHYSICS.DECELERATION,
                y: velocity.y
            });
        }

        // 점프 (바닥에 있을 때만)
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && Math.abs(velocity.y) < 0.5) {
            this.matter.body.setVelocity(myPlayer.body, { x: velocity.x, y: PHYSICS.JUMP_POWER });
        }

        // 플레이어가 카메라 밖으로 못 나가게 제한
        this.constrainPlayersToCamera();
    }

    updateCamera() {
        // 모든 플레이어의 위치를 기반으로 카메라 조정
        const positions = Array.from(this.players.values()).map(p => p.body.position);

        if (positions.length === 0) return;

        // 최소/최대 x 계산
        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));

        // 카메라 중심 계산
        const centerX = (minX + maxX) / 2;

        // 카메라 위치 부드럽게 이동
        this.cameras.main.scrollX = Phaser.Math.Linear(
            this.cameras.main.scrollX,
            centerX - this.cameras.main.width / 2,
            0.1
        );

        // 카메라가 월드 밖으로 나가지 않도록
        this.cameras.main.scrollX = Phaser.Math.Clamp(
            this.cameras.main.scrollX,
            0,
            this.worldWidth - this.cameras.main.width
        );
    }

    constrainPlayersToCamera() {
        // 플레이어가 카메라 영역 밖으로 못 나가게
        const camLeft = this.cameras.main.scrollX;
        const camRight = camLeft + this.cameras.main.width;

        this.players.forEach(player => {
            const pos = player.body.position;

            // 왼쪽 경계
            if (pos.x < camLeft + 16) {
                this.matter.body.setPosition(player.body, { x: camLeft + 16, y: pos.y });
            }
            // 오른쪽 경계
            if (pos.x > camRight - 16) {
                this.matter.body.setPosition(player.body, { x: camRight - 16, y: pos.y });
            }
        });
    }
}
