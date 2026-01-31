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

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, width: number = 32, height: number = 16, texture?: string, frame?: string | number, angle: number = 0, collisionData?: any[]) {
        this.scene = scene;
        this.id = id;

        // Custom Collision Handling
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
                isSensor: true, // Spike is sensor
                isStatic: true,
                label: `spike-${id}`
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

            // 5. Set Body Position accounting for CoM offset and Rotation
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
            // Default Collision (Full Box, no hardcoding hacks)
            this.body = this.scene.matter.add.rectangle(x, y, width, height, {
                isSensor: true,
                isStatic: true,
                label: `spike-${id}`,
                angle: Phaser.Math.DegToRad(angle)
            });
        }

        if (texture) {
            this.sprite = this.scene.add.sprite(x, y, texture, frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setAngle(angle);
        } else {
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
