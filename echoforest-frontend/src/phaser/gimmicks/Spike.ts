import Phaser from 'phaser';

/**
 * Spike 기믹 - 플레이어가 닿으면 사망 (맵 재시작)
 * 피코파크 스타일: 위험 장애물
 */
export class Spike {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private sprite?: Phaser.GameObjects.Sprite;
    private graphics?: Phaser.GameObjects.Graphics;

    public readonly id: string;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, width: number = 32, height: number = 16, texture?: string, frame?: string | number, angle: number = 0) {
        this.scene = scene;
        this.id = id;

        // 가시 물리 바디 (센서로 설정 - 닿으면 사망)
        // 사용자의 요청에 따라 판정 범위를 아래쪽 절반으로 설정
        const bodyHeight = height * 0.5;
        const bodyYOffset = height * 0.25; // 아래로 이동 (센터 기준)

        this.body = this.scene.matter.add.rectangle(x, y + bodyYOffset, width, bodyHeight, {
            isSensor: true,
            isStatic: true,
            label: `spike-${id}`,
            angle: Phaser.Math.DegToRad(angle)
        });

        if (texture) {
            // 타일셋 이미지를 사용하는 경우
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
        } else {
            // 기본 그래픽 (삼각형 모양)
            this.graphics = this.scene.add.graphics();
            this.drawSpike(width, height);
            this.graphics.setPosition(x, y);
            this.graphics.setAngle(angle);
        }
    }

    private drawSpike(width: number, height: number): void {
        if (!this.graphics) return;
        this.graphics.clear();
        // 빨간색 가시 (삼각형 여러 개)
        this.graphics.fillStyle(0xC0392B, 1);

        const spikeCount = Math.floor(width / 16) || 1;
        const spikeWidth = width / spikeCount;

        for (let i = 0; i < spikeCount; i++) {
            const startX = -width / 2 + i * spikeWidth;
            this.graphics.fillTriangle(
                startX, height / 2,                    // 왼쪽 하단
                startX + spikeWidth, height / 2,       // 오른쪽 하단
                startX + spikeWidth / 2, -height / 2   // 상단 꼭지점
            );
        }
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
