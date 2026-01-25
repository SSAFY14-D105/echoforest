import Phaser from 'phaser';

export interface SignboardConfig {
    id: string;
    x: number;
    y: number;
    message: string;
    width?: number;
    height?: number;
    texture?: string;
    frame?: string | number;
    angle?: number;
}

/**
 * Signboard 기믹 - 가까이 가서 아래(▼) 키를 누르면 메시지 표시
 */
export class Signboard {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;
    private hintText: Phaser.GameObjects.Text;

    public readonly id: string;
    public readonly message: string;

    constructor(scene: Phaser.Scene, config: SignboardConfig) {
        this.scene = scene;
        this.id = config.id;
        this.message = config.message;

        const width = config.width || 48;
        const height = config.height || 48;

        const angle = config.angle || 0;

        // 상호작용 범위 (센서)
        this.body = this.scene.matter.add.rectangle(config.x, config.y, width * 1.5, height, {
            isSensor: true,
            isStatic: true,
            label: `signboard-${this.id}`,
            angle: Phaser.Math.DegToRad(angle)
        });

        // 안내판 그래픽 또는 스프라이트
        if (config.texture) {
            this.sprite = this.scene.add.sprite(config.x, config.y, config.texture, config.frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
            this.sprite.setDepth(2);
        } else {
            this.graphics = this.scene.add.graphics();
            this.drawSign(width, height);
            this.graphics.setPosition(config.x, config.y);
            this.graphics.setAngle(angle);
            this.graphics.setDepth(2);
        }

        // 상호작용 힌트 (기본은 보이지 않음)
        this.hintText = this.scene.add.text(config.x, config.y - height / 2 - 20, 'Press ▼', {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 4, y: 2 }
        })
            .setOrigin(0.5)
            .setDepth(10)
            .setVisible(false);
    }

    private drawSign(width: number, height: number): void {
        if (!this.graphics) return;
        this.graphics.clear();

        // 기둥
        this.graphics.fillStyle(0x5D4037, 1);
        this.graphics.fillRect(-4, height / 4, 8, height / 4);

        // 간판
        this.graphics.fillStyle(0x8D6E63, 1);
        this.graphics.fillRect(-width / 2, -height / 4, width, height / 2);

        // 테두리
        this.graphics.lineStyle(2, 0x3E2723, 1);
        this.graphics.strokeRect(-width / 2, -height / 4, width, height / 2);
    }

    public setOverlap(isOverlapping: boolean): void {
        this.hintText.setVisible(isOverlapping);

        if (isOverlapping) {
            // 힌트에 살짝 애니메이션 (둥실둥실)
            this.scene.tweens.add({
                targets: this.hintText,
                y: this.hintText.y - 5,
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        } else {
            this.scene.tweens.killTweensOf(this.hintText);
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
        this.hintText?.destroy();
    }
}
