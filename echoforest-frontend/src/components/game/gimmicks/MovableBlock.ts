import Phaser from 'phaser';

export interface MovableBlockConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    requiredPlayers: number;
}

/**
 * MovableBlock - 협동 밀기 블록 기믹
 * 체인 시스템: 연결된 블록들의 밀기 인원을 공유하되, 각 블록은 자기 조건을 독립적으로 판단
 */
export class MovableBlock {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;
    private text: Phaser.GameObjects.Text;

    public readonly id: string;
    private width: number;
    private height: number;
    private requiredPlayers: number;
    private moveSpeed: number = 2;

    private pushersLeft: number = 0;
    private pushersRight: number = 0;

    constructor(scene: Phaser.Scene, config: MovableBlockConfig) {
        this.scene = scene;
        this.id = config.id;
        this.width = config.width;
        this.height = config.height;
        this.requiredPlayers = config.requiredPlayers;

        // 정적 바디 (물리 충돌로 밀리지 않음)
        this.body = this.scene.matter.add.rectangle(config.x, config.y, this.width, this.height, {
            isStatic: true,
            label: `block-${this.id}`,
            friction: 0.1,
            restitution: 0
        });

        this.graphics = this.scene.add.graphics();

        this.text = this.scene.add.text(config.x, config.y, '', {
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.updateVisuals();
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getRequiredPlayers(): number {
        return this.requiredPlayers;
    }

    public getPosition(): { x: number; y: number } {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    public getWidth(): number {
        return this.width;
    }

    public getHeight(): number {
        return this.height;
    }

    // AABB 바운드 반환 (겹침 체크용)
    public getBounds(): { left: number; right: number; top: number; bottom: number } {
        const pos = this.body.position;
        return {
            left: pos.x - this.width / 2,
            right: pos.x + this.width / 2,
            top: pos.y - this.height / 2,
            bottom: pos.y + this.height / 2
        };
    }

    // 외부에서 호출하는 이동 메서드
    public moveRight(): void {
        const currentPos = this.body.position;
        this.scene.matter.body.setPosition(this.body, {
            x: currentPos.x + this.moveSpeed,
            y: currentPos.y
        });
    }

    public moveLeft(): void {
        const currentPos = this.body.position;
        this.scene.matter.body.setPosition(this.body, {
            x: currentPos.x - this.moveSpeed,
            y: currentPos.y
        });
    }

    // 밀기 인원 정보 업데이트 (시각적 피드백용, 이동은 BaseGameScene에서 처리)
    public update(pushersLeft: number, pushersRight: number): void {
        this.pushersLeft = pushersLeft;
        this.pushersRight = pushersRight;
        this.updateVisuals();
    }

    private updateVisuals(): void {
        const pos = this.body.position;
        const maxPushers = Math.max(this.pushersLeft, this.pushersRight);
        const isActivated = maxPushers >= this.requiredPlayers;

        this.graphics.clear();
        this.graphics.fillStyle(isActivated ? 0x4CAF50 : 0x795548, 1);
        this.graphics.fillRect(
            pos.x - this.width / 2,
            pos.y - this.height / 2,
            this.width,
            this.height
        );

        // 테두리
        this.graphics.lineStyle(2, 0x5D4037, 1);
        this.graphics.strokeRect(
            pos.x - this.width / 2,
            pos.y - this.height / 2,
            this.width,
            this.height
        );

        // 밀기 인원 표시
        const leftInfo = this.pushersLeft > 0 ? `←${this.pushersLeft}` : '';
        const rightInfo = this.pushersRight > 0 ? `${this.pushersRight}→` : '';
        const statusText = maxPushers >= this.requiredPlayers ? '이동!' : `${maxPushers}/${this.requiredPlayers}명`;
        this.text.setText(`${leftInfo} ${statusText} ${rightInfo}`.trim());
        this.text.setPosition(pos.x, pos.y);
    }

    public destroy(): void {
        this.scene.matter.world.remove(this.body);
        this.graphics.destroy();
        this.text.destroy();
    }
}

