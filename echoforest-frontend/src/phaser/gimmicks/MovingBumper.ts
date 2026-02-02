import Phaser from 'phaser';

export interface MovingBumperConfig {
    id: string;
    startX: number;
    endX: number;
    startY: number;
    endY: number;
    size?: number;
    power?: number;
    speed?: number; // 이동 속도 (라디안 단위 속도)
    offset?: number; // 초기 위상차
    texture?: string;
    frame?: string | number;
    angle?: number; // 회전 각도 (도)
}

export class MovingBumper {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;

    private startX: number;
    private endX: number;
    private startY: number;
    private endY: number;
    private size: number;
    private power: number;
    private speed: number;
    private offset: number;
    private angle: number;

    public readonly id: string;

    constructor(scene: Phaser.Scene, config: MovingBumperConfig) {
        this.scene = scene;
        this.id = config.id;
        this.startX = config.startX;
        this.endX = config.endX;
        this.startY = config.startY;
        this.endY = config.endY;
        this.size = config.size || 40;
        this.power = config.power || 8;
        this.speed = config.speed || 0.002;
        this.offset = config.offset || 0;
        this.angle = config.angle || 0;

        const centerX = (this.startX + this.endX) / 2;
        const centerY = (this.startY + this.endY) / 2;

        // 원형 물리 바디 생성 (초기 위치는 중심)
        this.body = this.scene.matter.add.circle(centerX, centerY, this.size / 2, {
            isStatic: true,
            isSensor: true,
            label: `moving-bumper-${this.id}`
        });

        if (config.texture) {
            this.sprite = this.scene.add.sprite(centerX, centerY, config.texture, config.frame);
            this.sprite.setDisplaySize(this.size, this.size);
            this.sprite.setAngle(this.angle); // 회전 적용
            this.sprite.setDepth(5);
        } else {
            this.graphics = this.scene.add.graphics();
            this.drawBumper();
            this.graphics.setDepth(5);
        }
    }

    private drawBumper(): void {
        if (!this.graphics) return;
        this.graphics.clear();

        const color = 0x00ffff;
        this.graphics.lineStyle(3, color, 1);
        this.graphics.strokeCircle(0, 0, this.size / 2);
        this.graphics.fillStyle(color, 0.3);
        this.graphics.fillCircle(0, 0, this.size / 2 - 2);
        this.graphics.fillStyle(0xffffff, 0.8);
        this.graphics.fillCircle(0, 0, 4);
    }

    public update(time: number): void {
        const rangeX = (this.endX - this.startX) / 2;
        const centerX = (this.startX + this.endX) / 2;

        const rangeY = (this.endY - this.startY) / 2;
        const centerY = (this.startY + this.endY) / 2;

        const sinValue = Math.sin(time * this.speed + this.offset);
        const newX = centerX + sinValue * rangeX;
        const newY = centerY + sinValue * rangeY;

        this.scene.matter.body.setPosition(this.body, { x: newX, y: newY });

        if (this.sprite) {
            this.sprite.setPosition(newX, newY);
        }
        if (this.graphics) {
            this.graphics.setPosition(newX, newY);
        }
    }

    public getBodyLabel(): string {
        return this.body.label!;
    }

    public getPosition(): { x: number, y: number } {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    public getPower(): number {
        return this.power;
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
