import Phaser from 'phaser';

export interface GhostPlatformConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: number;
    alpha?: number;
    texture?: string;
    frame?: string | number;
}

/**
 * GhostPlatform 기믹 - 눈에는 보이지만 충돌하지 않아 통과할 수 있는 플랫폼
 */
export class GhostPlatform {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;
    private color: number;
    private alpha: number;
    private width: number;
    private height: number;

    public readonly id: string;

    constructor(scene: Phaser.Scene, config: GhostPlatformConfig) {
        this.scene = scene;
        this.id = config.id;
        this.width = config.width;
        this.height = config.height;
        this.color = config.color !== undefined ? config.color : 0x3498db;
        this.alpha = config.alpha !== undefined ? config.alpha : 1.0;

        const { x, y } = config;

        // 물리 바디 생성: isSensor를 true로 설정하여 충돌 방지
        this.body = this.scene.matter.add.rectangle(x, y, this.width, this.height, {
            isSensor: true,
            isStatic: true,
            label: `ghost-platform-${this.id}`
        });

        if (config.texture) {
            // 이미지 텍스처가 있는 경우 Sprite 사용 (TileSprite보다 스프라이트시트 프레임 대응에 유리)
            this.sprite = this.scene.add.sprite(x, y, config.texture, config.frame);
            this.sprite.setDisplaySize(this.width, this.height);
            this.sprite.setAlpha(this.alpha);
            this.sprite.setDepth(8);
        } else {
            // 텍스처가 없는 경우 Graphics 사용
            this.graphics = this.scene.add.graphics();
            this.drawPlatform(this.width, this.height, this.color, this.alpha);
            this.graphics.setPosition(x, y);
            this.graphics.setDepth(8);
        }
    }

    private drawPlatform(width: number, height: number, color: number, alpha: number): void {
        if (!this.graphics) return;
        this.graphics.clear();

        // 메인 채우기
        this.graphics.fillStyle(color, alpha);
        this.graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 8);

        // 테두리 (약간 더 진하게)
        this.graphics.lineStyle(2, color, alpha + 0.2 > 1 ? 1 : alpha + 0.2);
        this.graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    private isOverlapping: boolean = false;

    public setOverlap(isOverlapping: boolean): void {
        if (this.isOverlapping === isOverlapping) return;
        this.isOverlapping = isOverlapping;

        const targetAlpha = isOverlapping ? 0.4 : this.alpha;
        const target = this.sprite || this.graphics;

        if (target) {
            this.scene.tweens.add({
                targets: target,
                alpha: targetAlpha,
                duration: 300,
                overwrite: true
            });
        }
    }

    public getPosition(): { x: number, y: number } {
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
