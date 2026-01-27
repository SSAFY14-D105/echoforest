import Phaser from 'phaser';

/**
 * PoisonMushroom 기믹 - 닿으면 무작위 플레이어에게 무작위 저주 부여
 * 한 번 발동되면 사라지는 일회성 기믹
 */
export class PoisonMushroom {
    private scene: Phaser.Scene;
    private body!: MatterJS.BodyType;
    private sprite?: Phaser.GameObjects.Sprite;
    private graphics?: Phaser.GameObjects.Graphics;
    private isTriggered: boolean = false;

    public readonly id: string;
    private initialX: number;
    private initialY: number;
    private width: number;
    private height: number;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, width: number = 32, height: number = 32, texture?: string, frame?: string | number) {
        this.scene = scene;
        this.id = id;
        this.initialX = x;
        this.initialY = y;
        this.width = width;
        this.height = height;

        this.createBody();

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setDepth(5);
        } else {
            // 기본 그래픽 (보라색 원형 갓 + 흰색 기둥)
            this.graphics = this.scene.add.graphics();
            this.drawMushroom(width, height);
            this.graphics.setPosition(x, y);
            this.graphics.setDepth(5);
        }
    }

    private createBody(): void {
        // 독버섯 물리 바디 (센서로 설정)
        this.body = this.scene.matter.add.rectangle(this.initialX, this.initialY, this.width, this.height, {
            isSensor: true,
            isStatic: true,
            label: `mushroom-${this.id}`
        });
    }

    private drawMushroom(width: number, height: number): void {
        if (!this.graphics) return;
        this.graphics.clear();

        // 기둥 (흰색)
        this.graphics.fillStyle(0xFFFFFF, 1);
        this.graphics.fillRect(-width / 4, 0, width / 2, height / 2);

        // 갓 (보라색 독버섯 느낌)
        this.graphics.fillStyle(0x9B59B6, 1);
        this.graphics.fillEllipse(0, -height / 4, width, height * 0.8);

        // 반점 (흰색)
        this.graphics.fillStyle(0xFFFFFF, 0.8);
        this.graphics.fillCircle(-width / 4, -height / 3, 4);
        this.graphics.fillCircle(width / 4, -height / 4, 3);
        this.graphics.fillCircle(0, -height / 10, 5);
    }

    public trigger(): void {
        if (this.isTriggered) return;
        this.isTriggered = true;

        // 시각적으로 제거 및 위치 동기화 중단
        this.sprite?.setVisible(false);
        this.graphics?.setVisible(false);
        if (this.body) this.scene.matter.world.remove(this.body);

        console.log(`[PoisonMushroom] Triggered and removed: ${this.id}`);
    }

    public reset(): void {
        if (!this.isTriggered) return;

        this.isTriggered = false;

        // 시각 효과 복구
        if (this.sprite) this.sprite.setVisible(true);
        if (this.graphics) this.graphics.setVisible(true);

        // 물리 바디 재생성
        this.createBody();

        console.log(`[PoisonMushroom] Reset: ${this.id}`);
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getIsTriggered(): boolean {
        return this.isTriggered;
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
