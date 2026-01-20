import Phaser from 'phaser';

/**
 * Spike 기믹 - 플레이어가 닿으면 사망 (맵 재시작)
 * 피코파크 스타일: 위험 장애물
 */
export class Spike {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;

    public readonly id: string;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, width: number = 32) {
        this.scene = scene;
        this.id = id;

        // 가시 물리 바디 (센서로 설정 - 닿으면 사망)
        this.body = this.scene.matter.add.rectangle(x, y, width, 16, {
            isSensor: true,
            isStatic: true,
            label: `spike-${id}`
        });

        // 가시 그래픽 (삼각형 모양)
        this.graphics = this.scene.add.graphics();
        this.drawSpike(width);

        // 위치 설정
        this.graphics.setPosition(x, y);
    }

    private drawSpike(width: number): void {
        this.graphics.clear();
        // 빨간색 가시 (삼각형 여러 개)
        this.graphics.fillStyle(0xC0392B, 1);

        const spikeCount = Math.floor(width / 16);
        const spikeWidth = width / spikeCount;

        for (let i = 0; i < spikeCount; i++) {
            const startX = -width / 2 + i * spikeWidth;
            this.graphics.fillTriangle(
                startX, 8,                    // 왼쪽 하단
                startX + spikeWidth, 8,       // 오른쪽 하단
                startX + spikeWidth / 2, -8   // 상단 꼭지점
            );
        }
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public destroy(): void {
        this.scene.matter.world.remove(this.body);
        this.graphics.destroy();
    }
}
