import Phaser from 'phaser';

export interface MovableBlockConfig {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    requiredPlayers: number;
    texture?: string;
    frame?: string | number;
}

/**
 * MovableBlock - 협동 밀기 블록 기믹
 * 체인 시스템: 연결된 블록들의 밀기 인원을 공유하되, 각 블록은 자기 조건을 독립적으로 판단
 */
export class MovableBlock {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private graphics?: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Sprite;
    private text: Phaser.GameObjects.Text;

    public readonly id: string;
    public readonly targetBlockId?: number;
    private width: number;
    private height: number;
    private requiredPlayers: number;
    private _isVisible: boolean = true;
    private moveSpeed: number = 2;
    private initialX: number;
    private initialY: number;

    private pushersLeft: number = 0;
    private pushersRight: number = 0;

    private lockedX: number;
    private wasMovedThisFrame: boolean = false;

    constructor(scene: Phaser.Scene, config: MovableBlockConfig) {
        this.scene = scene;
        this.id = config.id;
        this.width = config.width;
        this.height = config.height;
        this.requiredPlayers = config.requiredPlayers;
        this.lockedX = config.x;
        this.initialX = config.x;
        this.initialY = config.y;
        this.targetBlockId = (config as any).targetBlockId;

        // 동적 바디 (중력 적용)
        this.body = this.scene.matter.add.rectangle(config.x, config.y, this.width, this.height, {
            isStatic: false,
            label: `block-${this.id}`,
            friction: 0, // [FIX] 타일 이음새 걸림 방지
            frictionStatic: 0,
            frictionAir: 0.1, // [FIX] 공기 저항으로 제동
            restitution: 0
        });

        this.scene.matter.body.setInertia(this.body, Infinity); // 회전 방지
        this.scene.matter.body.setMass(this.body, 1000); // 플레이어 충돌로 쉽게 밀리지 않도록 질량 증가

        if (config.texture) {
            this.sprite = this.scene.add.sprite(config.x, config.y, config.texture, config.frame);
            this.sprite.setDisplaySize(this.width, this.height);
        } else {
            this.graphics = this.scene.add.graphics();
        }

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
        const nextX = currentPos.x + this.moveSpeed;
        this.scene.matter.body.setPosition(this.body, {
            x: nextX,
            y: currentPos.y
        });
        this.lockedX = nextX;
        this.wasMovedThisFrame = true;
    }

    public moveLeft(): void {
        const currentPos = this.body.position;
        const nextX = currentPos.x - this.moveSpeed;
        this.scene.matter.body.setPosition(this.body, {
            x: nextX,
            y: currentPos.y
        });
        this.lockedX = nextX;
        this.wasMovedThisFrame = true;
    }

    // 서버 동기화용 목표 위치
    private serverTarget: { x: number, y: number } | null = null;

    // 밀기 인원 정보 업데이트 (시각적 피드백용, 이동은 BaseGameScene에서 처리)
    public update(pushersLeft: number, pushersRight: number): void {
        this.pushersLeft = pushersLeft;
        this.pushersRight = pushersRight;

        if (this.serverTarget) {
            // [Remote Client] 서버 목표 위치로 보간 이동
            const currentPos = this.body.position;
            const lerpFactorX = 0.1; // X축은 더 부드럽게 (0.15 -> 0.1)
            const lerpFactorY = 0.2; // Y축은 반응성 좋게

            const newX = Phaser.Math.Linear(currentPos.x, this.serverTarget.x, lerpFactorX);

            // friction을 0으로 설정하여 타일 이음새 걸림 방지 (createBody에서 설정 권장하지만 여기서도 확인)
            // this.body.friction = 0; // (필요 시 주석 해제하여 동적 적용)

            // Y축 동기화 (Deadzone 대폭 확대):
            // 10px 이내의 차이는 물리 엔진(중력)에 맡겨서 바닥에 자연스럽게 안착되도록 함
            // 호스트와 미세하게 높이가 달라도 클라이언트는 굳이 그 높이를 맞추려다 공중에 뜰 필요 없음
            let newY = currentPos.y;
            const diffY = Math.abs(currentPos.y - this.serverTarget.y);

            // 10px 이상 차이나면 서버 위치 추종 (공중 낙하, 엘리베이터 이동 등 큰 변화 시)
            if (diffY > 10) {
                newY = Phaser.Math.Linear(currentPos.y, this.serverTarget.y, lerpFactorY);
            } else {
                // 차이가 작으면 로컬 물리 엔진(중력) 유지
                // [CRITICAL] Sleep 상태 방지: 강제로 깨워 중력 적용 (공중 부양 방지)
                if ((this.body as any).isSleeping) {
                    (this.body as any).isSleeping = false;
                }
            }

            this.scene.matter.body.setPosition(this.body, { x: newX, y: newY });

            // 속도 제어
            // Y축 속도는 강제 이동 시에만 초기화하고, 그 외에는 물리 엔진의 낙하 속도 유지
            if (diffY > 10) {
                this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
            } else {
                // X축만 0으로 제어하고 Y축(낙하)은 건드리지 않음
                this.scene.matter.body.setVelocity(this.body, { x: 0, y: this.body.velocity.y });
            }

            this.lockedX = newX; // 고정 위치 업데이트

        } else {
            // [Local Interactor] 물리 및 로직 기반 이동

            // X축 고정 로직: 이번 프레임에 논리적 이동이 없었다면 강제로 X를 lockedX로 스냅
            // Y축은 건드리지 않아 중력 낙하 유지
            if (!this.wasMovedThisFrame) {
                const currentPos = this.body.position;
                const currentVel = this.body.velocity;

                // 미세한 차이라도 있으면 강제 고정 및 X 속도 초기화
                if (Math.abs(currentPos.x - this.lockedX) > 0.01) {
                    this.scene.matter.body.setPosition(this.body, { x: this.lockedX, y: currentPos.y });
                    this.scene.matter.body.setVelocity(this.body, { x: 0, y: currentVel.y });
                }
            }
        }

        this.updateVisuals();
        this.wasMovedThisFrame = false; // 플래그 초기화
    }

    public setVisible(visible: boolean): void {
        this._isVisible = visible;
        if (this.sprite) this.sprite.setVisible(visible);
        if (this.graphics) this.graphics.setVisible(visible);
        this.text.setVisible(visible);

        // 비활성 상태일 때는 물리 연산 정지 및 상호작용 방지
        this.body.isStatic = !visible;
        this.body.isSensor = !visible;
    }

    public getIsVisible(): boolean {
        return this._isVisible;
    }

    private updateVisuals(): void {
        if (!this._isVisible) return;
        const pos = this.body.position;
        const maxPushers = Math.max(this.pushersLeft, this.pushersRight);
        const isActivated = maxPushers >= this.requiredPlayers;

        if (this.sprite) {
            this.sprite.setPosition(pos.x, pos.y);
            // 스프라이트의 경우 색상 변경은 틴트(Tint) 등을 사용할 수 있으나 일단 위치만 동기화
        }

        if (this.graphics) {
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
        }

        // 밀기 인원 표시
        const leftInfo = this.pushersLeft > 0 ? `←${this.pushersLeft}` : '';
        const rightInfo = this.pushersRight > 0 ? `${this.pushersRight}→` : '';
        const statusText = maxPushers >= this.requiredPlayers ? '이동!' : `${maxPushers}/${this.requiredPlayers}명`;
        this.text.setText(`${leftInfo} ${statusText} ${rightInfo}`.trim());
        this.text.setPosition(pos.x, pos.y);
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
     * 서버 데이터로 위치 동기화 (Hybrid Authority)
     * 내가 밀고 있지 않을 때만 호출됨
     */
    public sync(data: { x: number; y: number }): void {
        this.serverTarget = { x: data.x, y: data.y };
        this.serverTarget = { x: data.x, y: data.y };
        // update 루프에서 보간 처리
    }

    /**
     * 초기 상태로 리셋
     */
    public reset(): void {
        this.scene.matter.body.setPosition(this.body, { x: this.initialX, y: this.initialY });
        this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
        this.lockedX = this.initialX;
        this.serverTarget = null;
        this.pushersLeft = 0;
        this.pushersRight = 0;
        this.updateVisuals();
    }
}

