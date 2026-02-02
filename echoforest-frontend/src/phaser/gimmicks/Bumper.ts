import Phaser from 'phaser';

export class Bumper {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;
    private width: number;
    private height: number;
    private power: number;

    constructor(scene: Phaser.Scene, x: number, y: number, width: number = 40, height: number = 40, power: number = 10, texture?: string, frame?: string | number, angle: number = 0, collisionData?: any[]) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.power = power; // 전달받은 파워 사용 (기본값 10)

        if (collisionData && collisionData.length > 0) {
            const bodies: MatterJS.BodyType[] = [];
            const scale = 4;

            // 0. Calculate Original Dimensions
            const rawWidth = Math.max(...collisionData.map((o: any) => o.x + o.width));
            const rawHeight = Math.max(...collisionData.map((o: any) => o.y + o.height));
            const originalWidthPixel = rawWidth * scale;
            const originalHeightPixel = rawHeight * scale;

            // 1. Create Parts relative to Original Tile Center
            collisionData.forEach((obj: any) => {
                const w = obj.width * scale;
                const h = obj.height * scale;
                const cx = (obj.x * scale) + (w / 2) - (originalWidthPixel / 2);
                const cy = (obj.y * scale) + (h / 2) - (originalHeightPixel / 2);

                if (obj.ellipse) {
                    bodies.push(this.scene.matter.bodies.circle(cx, cy, w / 2));
                } else {
                    bodies.push(this.scene.matter.bodies.rectangle(cx, cy, w, h));
                }
            });

            // 2. Create Body
            this.body = this.scene.matter.body.create({
                parts: bodies,
                isSensor: true,
                isStatic: true,
                label: 'bumper'
            });

            // 3. Scale Body
            if (width > 0 && height > 0 && originalWidthPixel > 0 && originalHeightPixel > 0) {
                const scaleX = width / originalWidthPixel;
                const scaleY = height / originalHeightPixel;
                if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                    this.scene.matter.body.scale(this.body, scaleX, scaleY);
                }
            }

            // 4. CoM Offset
            const coMOffsetX = this.body.position.x;
            const coMOffsetY = this.body.position.y;

            // 5. Set Body Position
            const rad = Phaser.Math.DegToRad(angle);
            const rotatedCoMX = coMOffsetX * Math.cos(rad) - coMOffsetY * Math.sin(rad);
            const rotatedCoMY = coMOffsetX * Math.sin(rad) + coMOffsetY * Math.cos(rad);

            this.scene.matter.body.setPosition(this.body, {
                x: x + rotatedCoMX,
                y: y + rotatedCoMY
            });

            this.scene.matter.body.setAngle(this.body, rad);
            this.scene.matter.world.add(this.body);

        } else {
            // 원형 물리 바디 생성 defaults
            // Use Min(width, height) for radius if simple circle
            const radius = Math.min(width, height) / 2;
            this.body = this.scene.matter.add.circle(x, y, radius, {
                isStatic: true,
                label: 'bumper',
                isSensor: true, // 플레이어를 직접 튕겨내기 위해 센서로 설정 (충돌 이벤트만 활용)
                angle: Phaser.Math.DegToRad(angle)
            });
        }

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(this.width, this.height);
            this.sprite.setAngle(angle);
        } else {
            this.graphics = this.scene.add.graphics();
            // Use width/height directly
            const radius = Math.min(this.width, this.height) / 2;
            this.graphics.fillStyle(0x00FF00, 1);

            // 외곽선 (네온 느낌)
            this.graphics.lineStyle(3, 0xff00ff, 1);
            this.graphics.strokeCircle(0, 0, radius);

            // 내부 채우기 (반투명)
            this.graphics.fillStyle(0xff00ff, 0.3);
            this.graphics.fillCircle(0, 0, radius - 2); // Corrected from this.size / 2 - 2

            // 중심 점
            this.graphics.fillStyle(0xffffff, 0.8);
            this.graphics.fillCircle(0, 0, 4);

            this.graphics.setPosition(x, y);
            this.graphics.setAngle(angle);
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
