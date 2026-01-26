import Phaser from 'phaser';

export class Bumper {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;
    private size: number;
    private power: number;

    constructor(scene: Phaser.Scene, x: number, y: number, size: number = 40, power: number = 8, texture?: string, frame?: string | number, angle: number = 0) {
        this.scene = scene;
        this.size = size;
        this.power = power;

        // 원형 물리 바디 생성
        this.body = this.scene.matter.add.circle(x, y, size / 2, {
            isStatic: true,
            label: 'bumper',
            isSensor: true, // 플레이어를 직접 튕겨내기 위해 센서로 설정 (충돌 이벤트만 활용)
            angle: Phaser.Math.DegToRad(angle)
        });

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(size, size);
            this.sprite.setAngle(angle);
        } else {
            this.graphics = this.scene.add.graphics();
            this.drawBumper();
            this.graphics.setAngle(angle);
        }
    }

    private drawBumper(): void {
        if (!this.graphics) return;
        this.graphics.clear();

        // 외곽선 (네온 느낌)
        this.graphics.lineStyle(3, 0xff00ff, 1);
        this.graphics.strokeCircle(this.body.position.x, this.body.position.y, this.size / 2);

        // 내부 채우기 (반투명)
        this.graphics.fillStyle(0xff00ff, 0.3);
        this.graphics.fillCircle(this.body.position.x, this.body.position.y, this.size / 2 - 2);

        // 중심 점
        this.graphics.fillStyle(0xffffff, 0.8);
        this.graphics.fillCircle(this.body.position.x, this.body.position.y, 4);
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
