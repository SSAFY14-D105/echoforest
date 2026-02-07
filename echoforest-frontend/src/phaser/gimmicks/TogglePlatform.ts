import Phaser from 'phaser';

/**
 * TogglePlatform 기믹 - 특정 신호를 받으면 사라지거나 나타나는 플랫폼
 * 사라진 상태에서는 물리적 충돌이 발생하지 않음
 */
export class TogglePlatform {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;
    private isVisible: boolean = true;

    public readonly id: string;
    private readonly x: number;
    private readonly y: number;
    private readonly width: number;
    private readonly height: number;

    constructor(scene: Phaser.Scene, x: number, y: number, id: string, width: number = 64, height: number = 64) {
        this.scene = scene;
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        // 플랫폼 물리 바디 (기본적으로 단단한 지형)
        this.body = this.scene.matter.add.rectangle(x, y, width, height, {
            isStatic: true,
            label: `platform-${id}`,
            friction: 0,
            frictionStatic: 0
        });

        this.graphics = this.scene.add.graphics();
        this.drawPlatform();
        this.graphics.setPosition(x, y);
        this.graphics.setDepth(3); // 배경보다는 위, 플레이어보다는 아래
    }

    private drawPlatform(): void {
        this.graphics.clear();

        // 지형 느낌의 갈색 계열
        this.graphics.fillStyle(0x8D6E63, 1);
        this.graphics.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // 테두리
        this.graphics.lineStyle(2, 0x4E342E, 1);
        this.graphics.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // 내부 패턴
        this.graphics.fillStyle(0x6D4C41, 0.5);
        this.graphics.fillRect(-this.width / 2 + 5, -this.height / 2 + 5, this.width - 10, 10);
        this.graphics.fillRect(-this.width / 2 + 10, 0, this.width - 20, 10);
    }

    public hide(): void {
        if (!this.isVisible) return;
        this.isVisible = false;

        this.graphics.setVisible(false);
        this.scene.matter.world.remove(this.body);
        // console.log(`[TogglePlatform] Hidden: ${this.id}`);
    }

    public show(): void {
        if (this.isVisible) return;
        this.isVisible = true;

        this.graphics.setVisible(true);
        // 물리 바디가 이미 월드에서 제거되었으므로 동일 설정으로 다시 추가
        this.body = this.scene.matter.add.rectangle(this.x, this.y, this.width, this.height, {
            isStatic: true,
            label: `platform-${this.id}`,
            friction: 0,
            frictionStatic: 0
        });
        // console.log(`[TogglePlatform] Shown: ${this.id}`);
    }

    public toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    public getIsVisible(): boolean {
        return this.isVisible;
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
    }
}
