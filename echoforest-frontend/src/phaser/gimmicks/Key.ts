import Phaser from 'phaser';

/**
 * Key 기믹 - 플레이어가 획득하면 연결된 Lock이 열림
 * 피코파크 스타일: 플레이어가 닿으면 열쇠가 사라지고 자물쇠가 열림
 */
export class Key {
    private scene: Phaser.Scene;
    private body!: MatterJS.BodyType;
    private sprite?: Phaser.GameObjects.Sprite;
    private graphics?: Phaser.GameObjects.Graphics;
    private isCollected: boolean = false;

    public readonly id: string;
    public readonly linkedLockId: string;
    private initialX: number;
    private initialY: number;
    private width: number;
    private height: number;
    private angle: number;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, linkedLockId: string, width: number = 24, height: number = 24, texture?: string, frame?: string | number, angle: number = 0) {
        this.scene = scene;
        this.id = id;
        this.linkedLockId = linkedLockId;
        this.initialX = x;
        this.initialY = y;
        this.width = width;
        this.height = height;
        this.angle = angle;

        this.createBody();

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
            this.sprite.setDepth(5);
        } else {
            // 열쇠 그래픽 (노란색 사각형 + 열쇠 모양)
            this.graphics = this.scene.add.graphics();
            this.drawKey();
            this.graphics.setPosition(x, y);
            this.graphics.setAngle(angle);
            this.graphics.setDepth(5);
        }
    }

    private createBody(): void {
        this.body = this.scene.matter.add.rectangle(this.initialX, this.initialY, this.width, this.height, {
            isSensor: true,
            isStatic: true,
            label: `key-${this.id}`,
            angle: Phaser.Math.DegToRad(this.angle)
        });
    }

    private drawKey(): void {
        if (!this.graphics) return;
        this.graphics.clear();
        // 노란색 열쇠
        this.graphics.fillStyle(0xFFD700, 1);
        this.graphics.fillRect(-12, -12, 24, 24);
        // 열쇠 구멍 표시 (검은색 원)
        this.graphics.fillStyle(0x000000, 1);
        this.graphics.fillCircle(0, -3, 4);
        this.graphics.fillRect(-2, 0, 4, 8);
    }

    public collect(): void {
        if (this.isCollected) return;

        this.isCollected = true;
        this.graphics?.setVisible(false);
        this.sprite?.setVisible(false);
        if (this.body) this.scene.matter.world.remove(this.body);

        // console.log(`[Key] Collected: ${this.id}, unlocks Lock: ${this.linkedLockId}`);
    }

    public reset(): void {
        if (!this.isCollected) return; // 이미 수집되지 않았다면 스킵

        this.isCollected = false;

        // 시각 효과 복구
        if (this.sprite) this.sprite.setVisible(true);
        if (this.graphics) this.graphics.setVisible(true);

        // 물리 바디 재생성 (기존 바디는 이미 제거되었음)
        this.createBody();

        // console.log(`[Key] Reset: ${this.id}`);
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getIsCollected(): boolean {
        return this.isCollected;
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
