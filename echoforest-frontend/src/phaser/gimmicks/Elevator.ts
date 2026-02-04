import Phaser from 'phaser';

export interface ElevatorConfig {
    id: string;
    x: number;
    initialY: number;
    targetY: number;
    width: number;
    height: number;
    requiredPlayers: number;
    speed?: number; // 이동 속도
    texture?: string;
    frame?: string | number;
    collisionData?: any[];
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
    // [NEW] Debounce timer for weight check
    private lastSufficientWeightTime: number = 0;

    constructor(scene: Phaser.Scene, config: ElevatorConfig) {
        this.scene = scene;
        this.id = config.id;
        this.x = config.x;
        this.initialY = config.initialY;
        this.targetY = config.targetY;
        this.width = config.width;
        this.height = config.height;
        this.requiredPlayers = config.requiredPlayers;
        this.speed = config.speed || 2;

        if (config.collisionData && config.collisionData.length > 0) {
            const bodies: MatterJS.BodyType[] = [];
            const scale = 4;

            // 0. Calculate Original Collision Width (to determine scale factor)
            // 타일셋 데이터 상의 최대 x+width를 구합니다.
            const rawWidth = Math.max(...config.collisionData.map((o: any) => o.x + o.width));
            const originalWidthPixel = rawWidth * scale;

            // 1. Create Parts (relative to *Original* Tile Center)
            config.collisionData.forEach((obj: any) => {
                const w = obj.width * scale;
                const h = obj.height * scale;
                // Center parts relative to the ORIGINAL tile dimensions
                const cx = (obj.x * scale) + (w / 2) - (originalWidthPixel / 2);
                const cy = (obj.y * scale) + (h / 2) - (originalWidthPixel / 2); // Height usually follows width/square aspect in calculation or simple centering

                if (obj.ellipse) {
                    bodies.push(this.scene.matter.bodies.circle(cx, cy, w / 2));
                } else {
                    bodies.push(this.scene.matter.bodies.rectangle(cx, cy, w, h));
                }
            });

            // 2. Create Body
            this.body = this.scene.matter.body.create({
                parts: bodies,
                isStatic: true,
                label: `elevator-${this.id}`,
                friction: 0,
                frictionStatic: 0,
                restitution: 0
            });

            // 3. Scale Body if Target Width is different
            if (this.width > 0 && originalWidthPixel > 0) {
                const scaleX = this.width / originalWidthPixel;
                // ScaleX만 적용 (높이는 유지하거나 필요시 scaleY 적용)
                // 엘리베이터는 주로 가로로 늘어나므로 X만 스케일링
                this.scene.matter.body.scale(this.body, scaleX, 1);
            }

            // 4. Align Position (CoM)
            const coMOffsetX = this.body.position.x;
            const coMOffsetY = this.body.position.y;

            // [FIX] Store Initial CoM Offset
            this.coMOffsetX = this.body.position.x - this.x;
            this.coMOffsetY = this.body.position.y - this.initialY;
            // console.log(`Elevator ${this.id} CoM Offset: ${this.coMOffsetX}, ${this.coMOffsetY}`);

            this.scene.matter.body.setPosition(this.body, {
                x: this.x + this.coMOffsetX,
                y: this.initialY + this.coMOffsetY
            });

            this.scene.matter.world.add(this.body);
        } else {
            // 물리 바디 생성 (Static으로 설정하여 플레이어가 밀지 못하게 함)
            this.body = this.scene.matter.add.rectangle(this.x, this.initialY, this.width, this.height, {
                isStatic: true,
                label: `elevator-${this.id}`,
                friction: 0,
                frictionStatic: 0,
                restitution: 0
            });
        }

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

    // [NEW] Center of Mass Offsets
    private coMOffsetX: number = 0;
    private coMOffsetY: number = 0;

    /**
     * 엘리베이터 업데이트 루프
     * @param weight 현재 탑승 인원 수 (Host용)
     * @param isHost 호스트 여부 (권한 체크)
     */
    public update(weight: number, isHost: boolean = false): void {
        this.currentWeight = weight;
        // [FIX] Use body position relative to visual position (subtract offset) to get "logical" Y
        const currentPosY = this.body.position.y - this.coMOffsetY;
        let nextY = currentPosY;

        // [Client] 비-호스트는 무조건 서버 동기화 값만 따름 (로컬 예측 금지)
        if (!isHost) {
            if (this.serverTarget) {
                // [Client] 서버에서 받은 위치로 보간 이동
                // Snap 로직 제거 (항상 부드럽게 추종)
                const lerpFactor = 0.5; // 반응성 좋게 유지
                nextY = Phaser.Math.Linear(currentPosY, this.serverTarget.y, lerpFactor);
            }
        }
        else {
            // [Host] 직접 로직 오쏘리티 (인원에 따른 이동)

            // [NEW] 인원 인식 Debounce (0.2초 유예 시간)
            // 네트워크 렉으로 인해 순간적으로 인원이 0명으로 인식되더라도 즉시 추락하지 않도록 함
            if (this.currentWeight >= this.requiredPlayers) {
                this.lastSufficientWeightTime = this.scene.time.now;
            }

            // 최근 200ms 내에 인원이 충족된 적이 있다면 올라감
            const isActive = (this.scene.time.now - this.lastSufficientWeightTime) < 200;

            // 목표 위치 결정
            const finalTargetY = isActive ? this.targetY : this.initialY;

            // 부드러운 위치 이동 (목표 지점을 지나치지 않도록 스냅 로직 적용)
            const distance = Math.abs(currentPosY - finalTargetY);
            if (distance > 0.1) {
                const moveStep = Math.min(distance, this.speed);
                const direction = currentPosY < finalTargetY ? 1 : -1;
                nextY = currentPosY + (moveStep * direction);
            } else {
                nextY = finalTargetY; // Snap to exact target if close enough
            }
        }

        // Apply Movement
        if (nextY !== currentPosY) {
            // [FIX] Apply CoM Offset when setting position
            this.scene.matter.body.setPosition(this.body, { x: this.x + this.coMOffsetX, y: nextY + this.coMOffsetY });
        }

        // Calculate Delta for Sticky Logic
        this.deltaY = nextY - currentPosY;

        this.updateVisuals();
    }

    private updateVisuals(): void {
        // [FIX] Visuals follow the "Logical" position (body position - offset)
        const y = this.body.position.y - this.coMOffsetY;

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
        // Return LOGICAL position
        return { x: this.body.position.x - this.coMOffsetX, y: this.body.position.y - this.coMOffsetY };
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
        // 물리 바디 위치 강제 이동 [FIX] Apply Offset
        this.scene.matter.body.setPosition(this.body, { x: this.x + this.coMOffsetX, y: this.initialY + this.coMOffsetY });
        this.currentWeight = 0;
        this.serverTarget = null;
        this.updateVisuals();
    }
}
