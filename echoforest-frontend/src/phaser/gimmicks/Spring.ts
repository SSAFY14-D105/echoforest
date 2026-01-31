import Phaser from 'phaser';

/**
 * Spring 기믹 - 플레이어가 밟으면 높이 튀어오름
 * 피코파크 스타일: 점프 장애물을 넘기 위한 발판
 */
export class Spring {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private sprite?: Phaser.GameObjects.Sprite;
    private graphics?: Phaser.GameObjects.Graphics;

    public readonly id: string;
    public readonly bouncePower: number;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, bouncePower: number = -15, width: number = 48, height: number = 16, texture?: string, frame?: string | number, angle: number = 0) {
        this.scene = scene;
        this.id = id;
        this.bouncePower = bouncePower;

        // 스프링 물리 바디 (센서로 설정)
        this.body = this.scene.matter.add.rectangle(x, y, width, height, {
            isSensor: true,
            isStatic: true,
            label: `spring-${id}`,
            angle: Phaser.Math.DegToRad(angle)
        });

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
        } else {
            // 스프링 그래픽
            this.graphics = this.scene.add.graphics();
            this.drawSpring();
            this.graphics.setPosition(x, y);
            this.graphics.setAngle(angle);
        }
    }

    private drawSpring(): void {
        if (!this.graphics) return;
        this.graphics.clear();

        // 스프링 베이스 (회색)
        this.graphics.fillStyle(0x7F8C8D, 1);
        this.graphics.fillRect(-24, 0, 48, 8);

        // 스프링 코일 (초록색)
        this.graphics.fillStyle(0x2ECC71, 1);
        this.graphics.fillRect(-20, -8, 40, 8);

        // 스프링 탑 (밝은 초록)
        this.graphics.fillStyle(0x27AE60, 1);
        this.graphics.fillRect(-16, -12, 32, 4);
    }

    // 스프링 애니메이션 (눌렸다가 튀어오름)
    public animate(): void {
        const target = this.sprite || this.graphics;
        if (!target) return;

        // 간단한 스케일 애니메이션
        this.scene.tweens.add({
            targets: target,
            scaleY: 0.5,
            duration: 50,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getBouncePower(): number {
        return this.bouncePower;
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
