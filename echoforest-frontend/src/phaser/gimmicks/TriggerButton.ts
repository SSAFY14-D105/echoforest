import Phaser from 'phaser';

export interface TriggerButtonConfig {
    id: string;
    x: number;
    y: number;
    targetId: string;
    width?: number;
    height?: number;
    oneTime?: boolean; // 한 번만 발동할지 여부 (기본 true)
}

/**
 * TriggerButton 기믹 - 밟으면 연결된 대상(targetId)을 작동시킴
 */
export class TriggerButton {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;
    private isPressed: boolean = false;

    public readonly id: string;
    public readonly targetId: string;
    public readonly oneTime: boolean;

    constructor(scene: Phaser.Scene, config: TriggerButtonConfig) {
        this.scene = scene;
        this.id = config.id;
        this.targetId = config.targetId;
        this.oneTime = config.oneTime !== undefined ? config.oneTime : true;

        const width = config.width || 48;
        const height = config.height || 12;

        // 버튼 물리 바디 (센서)
        this.body = this.scene.matter.add.rectangle(config.x, config.y, width, height, {
            isSensor: true,
            isStatic: true,
            label: `ttrigger-${this.id}` // 타겟 트리거 구분용 라벨
        });

        this.graphics = this.scene.add.graphics();
        this.drawButton(width, height);
        this.graphics.setPosition(config.x, config.y);
        this.graphics.setDepth(4);
    }

    private drawButton(width: number, height: number): void {
        this.graphics.clear();

        // 베이스 (진회색)
        this.graphics.fillStyle(0x34495E, 1);
        this.graphics.fillRect(-width / 2, -height / 2, width, height);

        // 누르는 부분 (상태에 따라 색 변경 - 노란색 계열)
        const btnColor = this.isPressed ? 0xF1C40F : 0xD35400;
        const btnHeight = this.isPressed ? height * 0.4 : height * 0.8;
        const btnY = this.isPressed ? height * 0.1 : -height * 0.3;

        this.graphics.fillStyle(btnColor, 1);
        this.graphics.fillRect(-width / 2 + 6, btnY, width - 12, btnHeight);
    }

    public press(): boolean {
        if (this.oneTime && this.isPressed) return false;

        this.isPressed = true;

        // 시각적 업데이트
        const width = (this.body as any).width || 48;
        const height = (this.body as any).height || 12;
        this.drawButton(width, height);

        // console.log(`[TriggerButton] Pressed: ${this.id} -> Target: ${this.targetId}`);
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
    }
}
