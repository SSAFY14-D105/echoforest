import Phaser from 'phaser';

const PLAYER_COLORS = [0x4CAF50, 0x2196F3, 0xFF9800, 0x9C27B0]; // P1~P4 색상

// 물리 파라미터
const PHYSICS = {
    FRICTION: 0.05,
    AIR_FRICTION: 0.02,
    RESTITUTION: 0.1
};

export interface PlayerConfig {
    id: string;
    nickname: string;
    x: number;
    y: number;
    colorIndex: number;
    isLocalPlayer: boolean;
}

export class Player {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;

    public readonly id: string;
    public readonly nickname: string;
    public readonly color: number;
    public readonly isLocalPlayer: boolean;

    constructor(scene: Phaser.Scene, config: PlayerConfig) {
        this.scene = scene;
        this.id = config.id;
        this.nickname = config.nickname;
        this.color = PLAYER_COLORS[config.colorIndex % PLAYER_COLORS.length];
        this.isLocalPlayer = config.isLocalPlayer;

        // TODO: 씬 준비 상태 체크 로직 개선 필요 - 임시 가드
        if (!this.scene.matter) {
            console.warn('[Player] Scene matter physics not ready, skipping player creation:', config.id);
            throw new Error('Scene matter physics not initialized');
        }

        // 물리 바디 생성
        this.body = this.scene.matter.add.rectangle(config.x, config.y, 32, 48, {
            label: this.id,
            friction: PHYSICS.FRICTION,
            frictionAir: PHYSICS.AIR_FRICTION,
            restitution: PHYSICS.RESTITUTION
        });

        // 회전 완전 고정 (피코파크 스타일)
        this.scene.matter.body.setInertia(this.body, Infinity);

        // 플레이어 그래픽 생성
        this.graphics = this.scene.add.graphics();
        this.drawPlayer();
    }

    private drawPlayer(): void {
        this.graphics.clear();
        this.graphics.fillStyle(this.color, 1);
        this.graphics.fillRect(-16, -24, 32, 48);

        // 닉네임 표시 (로컬 플레이어만 "나" 표시)
        // TODO: 텍스트 추가 시 구현
    }

    public update(): void {
        // 그래픽 위치를 물리 바디에 맞춤
        this.graphics.setPosition(this.body.position.x, this.body.position.y);
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    public getVelocity(): { x: number; y: number } {
        return { x: this.body.velocity.x, y: this.body.velocity.y };
    }

    public setVelocity(x: number, y: number): void {
        this.scene.matter.body.setVelocity(this.body, { x, y });
    }

    public setPosition(x: number, y: number): void {
        this.scene.matter.body.setPosition(this.body, { x, y });
    }

    public destroy(): void {
        // 물리 바디 제거
        this.scene.matter.world.remove(this.body);
        // 그래픽 제거
        this.graphics.destroy();
    }
}
