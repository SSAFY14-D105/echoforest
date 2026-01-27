import Phaser from 'phaser';

export interface ElevatorConfig {
    id: string;
    x: number;
    initialY: number;
    targetY: number;
    width: number;
    height: number;
    requiredPlayers: number;
    texture?: string;
    frame?: string | number;
}

export class Elevator {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;
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
            friction: 0,
            frictionStatic: 0,
            restitution: 0
        });

        // 그래픽 또는 스프라이트 생성
        if (config.texture) {
            this.sprite = this.scene.add.sprite(this.x, this.initialY, config.texture, config.frame);
            this.sprite.setDisplaySize(this.width, this.height);
        } else {
            this.graphics = this.scene.add.graphics();
        }

        // 정보 텍스트 생성 (필요 인원 표시)
        this.text = this.scene.add.text(this.x, this.initialY, '0 / 0', {
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.updateVisuals();
    }

    // 서버 동기화용 목표 위치
    private serverTarget: { x: number, y: number } | null = null;

    /**
     * 엘리베이터 업데이트 루프
     * @param weight 현재 탑승 인원 수 (Host용)
     */
    public update(weight: number): void {
        this.currentWeight = weight;
        const currentPosY = this.body.position.y;

        if (this.serverTarget) {
            // [Client] 서버에서 받은 위치로 보간 이동
            // Lerp를 사용하여 부드럽게 추종
            const lerpFactor = 0.15;
            const newY = Phaser.Math.Linear(currentPosY, this.serverTarget.y, lerpFactor);

            // X축은 고정, Y축만 동기화
            this.scene.matter.body.setPosition(this.body, { x: this.x, y: newY });

        } else {
            // [Host] 직접 로직 오쏘리티 (인원에 따른 이동)

            // 목표 위치 결정
            const finalTargetY = this.currentWeight >= this.requiredPlayers ? this.targetY : this.initialY;

            // 부드러운 위치 이동 (목표 지점을 지나치지 않도록 스냅 로직 적용)
            const distance = Math.abs(currentPosY - finalTargetY);
            if (distance > 0.1) {
                const moveStep = Math.min(distance, this.speed);
                const direction = currentPosY < finalTargetY ? 1 : -1;
                const nextY = currentPosY + (moveStep * direction);

                // 실제 물리 바디 위치 업데이트
                this.scene.matter.body.setPosition(this.body, { x: this.x, y: nextY });
            }
        }

        this.updateVisuals();
    }

    private updateVisuals(): void {
        const y = this.body.position.y;

        if (this.sprite) {
            this.sprite.setPosition(this.x, y);
        }

        if (this.graphics) {
            this.graphics.clear();

            // 배경 박스
            const color = this.currentWeight >= this.requiredPlayers ? 0x4CAF50 : 0x7f8c8d;
            this.graphics.fillStyle(color, 0.8);
            this.graphics.fillRect(this.x - this.width / 2, y - this.height / 2, this.width, this.height);

            // 테두리
            this.graphics.lineStyle(2, 0xffffff, 1);
            this.graphics.strokeRect(this.x - this.width / 2, y - this.height / 2, this.width, this.height);
        }

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
        this.sprite?.destroy();
        this.text?.destroy();
    }

    /**
     * 서버 데이터로 위치 동기화 (Remote Update)
     * 이 메서드가 호출되면 클라이언트는 자체 로직을 멈추고 서버 위치를 따라갑니다.
     */
    public sync(data: { x: number; y: number }): void {
        this.serverTarget = { x: this.x, y: data.y }; // X는 고정, Y는 서버 데이터
        // 즉시 이동하지 않고 update 루프에서 보간 처리
    }

    /**
     * 초기 상태로 리셋 (사망 시)
     */
    public reset(): void {
        // 물리 바디 위치 강제 이동
        this.scene.matter.body.setPosition(this.body, { x: this.x, y: this.initialY });
        this.currentWeight = 0;
        this.serverTarget = null;
        this.updateVisuals();
    }
}
