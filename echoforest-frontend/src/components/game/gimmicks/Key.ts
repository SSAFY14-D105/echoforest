import Phaser from 'phaser';

/**
 * Key 기믹 - 플레이어가 획득하면 연결된 Lock이 열림
 * 피코파크 스타일: 플레이어가 닿으면 열쇠가 사라지고 자물쇠가 열림
 */
export class Key {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;
    private isCollected: boolean = false;

    public readonly id: string;
    public readonly linkedLockId: string;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, linkedLockId: string) {
        this.scene = scene;
        this.id = id;
        this.linkedLockId = linkedLockId;

        // 열쇠 물리 바디 (센서로 설정 - 물리적 충돌 없이 감지만)
        this.body = this.scene.matter.add.rectangle(x, y, 24, 24, {
            isSensor: true,
            isStatic: true,
            label: `key-${id}`
        });

        // 열쇠 그래픽 (노란색 사각형 + 열쇠 모양)
        this.graphics = this.scene.add.graphics();
        this.drawKey();

        // 위치 설정
        this.graphics.setPosition(x, y);
    }

    private drawKey(): void {
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
        this.graphics.setVisible(false);
        this.scene.matter.world.remove(this.body);

        console.log(`[Key] Collected: ${this.id}, unlocks Lock: ${this.linkedLockId}`);
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getIsCollected(): boolean {
        return this.isCollected;
    }

    public destroy(): void {
        this.scene.matter.world.remove(this.body);
        this.graphics.destroy();
    }
}
