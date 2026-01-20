import Phaser from 'phaser';

export interface MovingBumperConfig {
    id: string;
    startX: number;
    endX: number;
    y: number;
    size?: number;
    power?: number;
    speed?: number; // 이동 속도 (라디안 단위 속도)
    offset?: number; // 초기 위상차 (여러 개 배치 시 서로 다른 타이밍 부여 용도)
}

export class MovingBumper {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics: Phaser.GameObjects.Graphics;

    private startX: number;
    private endX: number;
    private y: number;
    private size: number;
    private power: number;
    private speed: number;
    private offset: number;

    public readonly id: string;

    constructor(scene: Phaser.Scene, config: MovingBumperConfig) {
        this.scene = scene;
        this.id = config.id;
        this.startX = config.startX;
        this.endX = config.endX;
        this.y = config.y;
        this.size = config.size || 40;
        this.power = config.power || 8;
        this.speed = config.speed || 0.002;
        this.offset = config.offset || 0;

        const centerX = (this.startX + this.endX) / 2;

        // 원형 물리 바디 생성
        this.body = this.scene.matter.add.circle(centerX, this.y, this.size / 2, {
            isStatic: true,
            isSensor: true,
            label: 'bumper' // 기존 범퍼 충돌 로직 재사용을 위해 'bumper' 라벨 사용
        });

        this.graphics = this.scene.add.graphics();
        this.drawBumper();
    }

    private drawBumper(): void {
        this.graphics.clear();

        // 이동형 범퍼는 약간 다른 색상 (사이안/블루 계열)으로 구분
        const color = 0x00ffff;

        // 외곽선 (네온 느낌)
        this.graphics.lineStyle(3, color, 1);
        this.graphics.strokeCircle(0, 0, this.size / 2);

        // 내부 채우기 (반투명)
        this.graphics.fillStyle(color, 0.3);
        this.graphics.fillCircle(0, 0, this.size / 2 - 2);

        // 중심 점
        this.graphics.fillStyle(0xffffff, 0.8);
        this.graphics.fillCircle(0, 0, 4);
    }

    /**
     * 매 프레임 위치 업데이트
     * @param time 현재 씬 시간 (ms)
     */
    public update(time: number): void {
        const range = (this.endX - this.startX) / 2;
        const centerX = (this.startX + this.endX) / 2;

        // Math.sin을 사용하여 왕복 운동 구현
        const newX = centerX + Math.sin(time * this.speed + this.offset) * range;

        // 물리 바디 위치 업데이트
        this.scene.matter.body.setPosition(this.body, { x: newX, y: this.y });

        // 그래픽 위치 업데이트
        this.graphics.setPosition(newX, this.y);
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
        this.scene.matter.world.remove(this.body);
        this.graphics.destroy();
    }
}
