import Phaser from 'phaser';

/**
 * Lock 기믹 - 연결된 Key가 수집되면 열림 (통과 가능)
 * 피코파크 스타일: 열리면 사라지거나 길이 열림
 */
export class Lock {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private sprite?: Phaser.GameObjects.Sprite;
    private graphics?: Phaser.GameObjects.Graphics;
    private isUnlocked: boolean = false;

    public readonly id: string;

    private width: number;
    private height: number;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, width: number = 32, height: number = 64, texture?: string, frame?: string | number, angle: number = 0) {
        this.scene = scene;
        this.id = id;
        this.width = width;
        this.height = height;

        // 자물쇠 물리 바디 (센서로 설정 - 통과 가능)
        this.body = this.scene.matter.add.rectangle(x, y, width, height, {
            isStatic: true,
            isSensor: true,
            label: `lock-${id}`,
            angle: Phaser.Math.DegToRad(angle)
        });

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
            this.sprite.setDepth(5);
        } else {
            // 자물쇠 그래픽 (반투명한 빨간색 벽)
            this.graphics = this.scene.add.graphics();
            this.drawLock(width, height);
            this.graphics.setPosition(x, y);
            this.graphics.setAngle(angle);
            this.graphics.setDepth(5);
        }
    }

    private drawLock(width: number, height: number): void {
        if (!this.graphics) return;
        this.graphics.clear();
        // 빨간색 자물쇠 (잠김 상태 - 반투명하게 변경하여 통과 가능함을 암시)
        this.graphics.fillStyle(0xE74C3C, 0.5);
        this.graphics.fillRect(-width / 2, -height / 2, width, height);
        // 테두리
        this.graphics.lineStyle(2, 0xE74C3C, 1);
        this.graphics.strokeRect(-width / 2, -height / 2, width, height);

        // 자물쇠 아이콘 (노란색 구멍)
        this.graphics.fillStyle(0xFFD700, 0.8);
        this.graphics.fillCircle(0, -height / 4, 6);
        this.graphics.fillRect(-3, -height / 4, 6, height / 3);
    }

    public getPosition(): { x: number, y: number } {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    public getDimensions(): { width: number, height: number } {
        return { width: this.width, height: this.height };
    }

    public unlock(): void {
        if (this.isUnlocked) return;

        this.isUnlocked = true;
        this.graphics?.setVisible(false);
        this.sprite?.setVisible(false);
        this.scene.matter.world.remove(this.body);

        console.log(`[Lock] Unlocked: ${this.id}`);
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getIsUnlocked(): boolean {
        return this.isUnlocked;
    }

    public destroy(): void {
        this.scene.matter.world.remove(this.body);
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
