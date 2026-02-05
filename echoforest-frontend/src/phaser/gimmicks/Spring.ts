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
    private originalScaleY: number = 1; // [FIX] 원래 스케일 저장

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, bouncePower: number = -15, width: number = 48, height: number = 16, texture?: string, frame?: string | number, angle: number = 0, collisionData?: any[]) {
        this.scene = scene;
        this.id = id;
        this.bouncePower = bouncePower;

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
                label: `spring-${id}`
            });

            // 3. Scale Body
            if (width > 0 && height > 0 && originalWidthPixel > 0 && originalHeightPixel > 0) {
                const scaleX = width / originalWidthPixel;
                const scaleY = height / originalHeightPixel;
                if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                    this.scene.matter.body.scale(this.body, scaleX, scaleY);
                }
            }

            // 4. Calculate CoM Offset
            const coMOffsetX = this.body.position.x;
            const coMOffsetY = this.body.position.y;

            // 4. Set Body Position accounting for CoM offset and Rotation
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
            // 스프링 물리 바디 (센서로 설정)
            this.body = this.scene.matter.add.rectangle(x, y, width, height, {
                isSensor: true,
                isStatic: true,
                label: `spring-${id}`,
                angle: Phaser.Math.DegToRad(angle)
            });
        }

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
            this.originalScaleY = this.sprite.scaleY; // [FIX] 원래 스케일 저장
        } else {
            // 스프링 그래픽
            this.graphics = this.scene.add.graphics();
            this.drawSpring();
            this.graphics.setPosition(x, y);
            this.graphics.setAngle(angle);
            this.originalScaleY = 1; // Graphics는 기본 스케일 1
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

    private pendingTimer?: Phaser.Time.TimerEvent;

    // 스프링 애니메이션 (눌렸다가 튀어오름)
    public animate(): void {
        const target = this.sprite || this.graphics;
        if (!target) return;

        // [FIX] 기존 타이머가 있으면 취소하고 원래 스케일로 복원 후 새로 시작
        if (this.pendingTimer) {
            this.pendingTimer.destroy();
            this.pendingTimer = undefined;
        }

        // [FIX] 원래 스케일 기준으로 수축/펴짐
        const compressedScaleY = this.originalScaleY * 0.5;

        // 수축
        target.setScale(target.scaleX, compressedScaleY);

        // 100ms 후 펴짐
        this.pendingTimer = this.scene.time.delayedCall(100, () => {
            if (target && target.active !== false) {
                target.setScale(target.scaleX, this.originalScaleY);
            }
            this.pendingTimer = undefined;
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
