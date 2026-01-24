import Phaser from 'phaser';

export interface ElevatorConfig {
    id: string;
    x: number;
    initialY: number;
    targetY: number;
    width: number;
    height: number;
    requiredPlayers: number;
}

export class Elevator {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;
    private text: Phaser.GameObjects.Text;

    public readonly id: string;
    public readonly x: number;
    public readonly initialY: number;
    public readonly targetY: number;
    public readonly width: number;
    public readonly height: number;
    public readonly requiredPlayers: number;

    private currentWeight: number = 0;
    private speed: number = 2;

    constructor(scene: Phaser.Scene, config: ElevatorConfig) {
        this.scene = scene;
        this.id = config.id;
        this.x = config.x;
        this.initialY = config.initialY;
        this.targetY = config.targetY;
        this.width = config.width;
        this.height = config.height;
        this.requiredPlayers = config.requiredPlayers;

        // 물리 바디 생성 (Static으로 설정하여 플레이어가 밀지 못하게 함)
        this.body = this.scene.matter.add.rectangle(this.x, this.initialY, this.width, this.height, {
            isStatic: true,
            label: `elevator-${this.id}`,
            friction: 0.1,
            restitution: 0
        });

        // 그래픽 생성
        this.graphics = this.scene.add.graphics();

        // 정보 텍스트 생성 (필요 인원 표시)
        this.text = this.scene.add.text(this.x, this.initialY, '0 / 0', {
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.updateVisuals();
    }

    public update(weight: number): void {
        this.currentWeight = weight;
        const currentPosY = this.body.position.y;

        // 목표 위치 결정
        const finalTargetY = this.currentWeight >= this.requiredPlayers ? this.targetY : this.initialY;

        // 부드러운 위치 이동
        if (Math.abs(currentPosY - finalTargetY) > 0.5) {
            const step = currentPosY < finalTargetY ? this.speed : -this.speed;
            const nextY = currentPosY + step;

            // 실제 물리 바디 위치 업데이트
            this.scene.matter.body.setPosition(this.body, { x: this.x, y: nextY });
        }

        this.updateVisuals();
    }

    private updateVisuals(): void {
        const y = this.body.position.y;

        this.graphics.clear();

        // 배경 박스
        const color = this.currentWeight >= this.requiredPlayers ? 0x4CAF50 : 0x7f8c8d;
        this.graphics.fillStyle(color, 0.8);
        this.graphics.fillRect(this.x - this.width / 2, y - this.height / 2, this.width, this.height);

        // 테두리
        this.graphics.lineStyle(2, 0xffffff, 1);
        this.graphics.strokeRect(this.x - this.width / 2, y - this.height / 2, this.width, this.height);

        // 텍스트 위치 및 내용 업데이트
        this.text.setPosition(this.x, y);
        this.text.setText(`${this.currentWeight} / ${this.requiredPlayers}`);
    }

    public getBody(): MatterJS.BodyType {
        return this.body;
    }

    public getPosition(): { x: number, y: number } {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    public destroy(): void {
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        this.graphics?.destroy();
        this.text?.destroy();
    }
}
