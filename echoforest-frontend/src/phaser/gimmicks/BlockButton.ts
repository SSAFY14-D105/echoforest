import Phaser from 'phaser';
import type { MovableBlockConfig } from './MovableBlock';

export interface BlockButtonConfig {
    id: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    spawnConfig?: MovableBlockConfig;
    targetBlockId?: number;
    texture?: string;
    frame?: string | number;
}

/**
 * BlockButton 기믹 - 플레이어가 밟으면 특정 위치에 MovableBlock 소환
 * 한 번 발동되면 눌린 상태로 고정됨
 */
export class BlockButton {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;
    private isPressed: boolean = false;

    public readonly id: string;
    public readonly spawnConfig?: MovableBlockConfig;
    public readonly targetBlockId?: number;

    constructor(scene: Phaser.Scene, config: BlockButtonConfig) {
        this.scene = scene;
        this.id = config.id;
        this.spawnConfig = config.spawnConfig;
        this.targetBlockId = config.targetBlockId;

        const width = config.width || 48;
        const height = config.height || 10;

        // 버튼 물리 바디 (센서)
        this.body = this.scene.matter.add.rectangle(config.x, config.y, width, height, {
            isSensor: true,
            isStatic: true,
            label: `button-${this.id}`
        });

        if (config.texture) {
            this.sprite = this.scene.add.sprite(config.x, config.y, config.texture, config.frame);
            this.sprite.setDisplaySize(width, height);
            this.sprite.setDepth(4);
        } else {
            this.graphics = this.scene.add.graphics();
            this.drawButton(width, height);
            this.graphics.setPosition(config.x, config.y);
            this.graphics.setDepth(4);
        }
    }

    private drawButton(width: number, height: number): void {
        if (this.sprite) {
            // 스프라이트의 경우 눌린 상태를 프레임 변경이나 틴트로 표현
            // (여기서는 간단히 틴트 적용)
            this.sprite.setTint(this.isPressed ? 0x2ECC71 : 0xffffff);
            return;
        }

        if (this.graphics) {
            this.graphics.clear();

            // 베이스 (회색)
            this.graphics.fillStyle(0x7F8C8D, 1);
            this.graphics.fillRect(-width / 2, -height / 2, width, height);

            // 누르는 부분 (상태에 따라 색 변경)
            const btnColor = this.isPressed ? 0x2ECC71 : 0xE74C3C;
            const btnHeight = this.isPressed ? height * 0.4 : height * 0.8;
            const btnY = this.isPressed ? height * 0.1 : -height * 0.3;

            this.graphics.fillStyle(btnColor, 1);
            this.graphics.fillRect(-width / 2 + 4, btnY, width - 8, btnHeight);
        }
    }

    public press(): boolean {
        if (this.isPressed) return false;

        this.isPressed = true;

        // 시각적 업데이트
        const width = (this.body as any).width || 48;
        const height = (this.body as any).height || 10;
        this.drawButton(width, height);

        // console.log(`[BlockButton] Pressed: ${this.id}`);
        return true;
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getIsPressed(): boolean {
        return this.isPressed;
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
        this.sprite?.destroy();
    }
}
