import Phaser from 'phaser';
import { CURSES } from '../config/curseConfig';

const PLAYER_COLORS = [0x4CAF50, 0x2196F3, 0xFF9800, 0x9C27B0]; // P1~P4 색상
const BASE_PLAYER_SIZE = 60;

// 물리 파라미터
const PHYSICS = {
    FRICTION: 0,           // 동적 마찰 없음 (벽에서 느리게 떨어지는 현상 방지)
    STATIC_FRICTION: 0,    // 벽 충돌 시 덜덜거림 방지를 위해 0으로 설정
    AIR_FRICTION: 0.02,
    RESTITUTION: 0         // 튕김 방지
};

export interface PlayerConfig {
    id: string;
    nickname: string;
    x: number;
    y: number;
    colorIndex: number;
    isLocalPlayer: boolean;
}

export class Player {
    private scene: Phaser.Scene;
    private body: MatterJS.BodyType;
    private sprite: Phaser.GameObjects.Sprite;
    public colorName: string;

    public readonly id: string;
    public readonly nickname: string;
    public color: number;
    public readonly isLocalPlayer: boolean;

    // 저주 시스템
    private currentCurseId: string | null = null;
    private sizeMultiplier: number = 1;
    private speedMultiplier: number = 1;
    private jumpMultiplier: number = 1;
    private reverseControls: boolean = false;

    // HP 저주용
    private curseHP: number = 100;
    private hpDrainTimer: Phaser.Time.TimerEvent | null = null;
    private hpBarGraphics: Phaser.GameObjects.Graphics | null = null;
    private visualProxy: Phaser.GameObjects.Graphics | null = null; // [FALLBACK] 비주얼 백업
    private onDeathCallback: (() => void) | null = null;

    // 밀치기(Knockback) 및 스턴 상태
    private _isStunned: boolean = false;
    private stunTimer: Phaser.Time.TimerEvent | null = null;
    private _isDead: boolean = false;


    // 목표 위치 (원격 플레이어 보간용)
    private targetPos: { x: number, y: number } | null = null;
    private readonly LERP_FACTOR = 0.15; // 0.2 -> 0.15: 더 부드럽게 (지연 시간은 미세하게 증가)

    constructor(scene: Phaser.Scene, config: PlayerConfig) {
        this.scene = scene;
        this.id = config.id;
        this.nickname = config.nickname;
        this.color = PLAYER_COLORS[config.colorIndex % PLAYER_COLORS.length];
        this.isLocalPlayer = config.isLocalPlayer;

        const colors = ['green', 'blue', 'orange', 'purple'];
        this.colorName = colors[config.colorIndex % colors.length];

        // TODO: 씬 준비 상태 체크 로직 개선 필요 - 임시 가드
        if (!this.scene.matter) {
            console.warn('[Player] Scene matter physics not ready, skipping player creation:', config.id);
            throw new Error('Scene matter physics not initialized');
        }

        // 물리 바디 생성
        this.body = this.createBody(config.x, config.y);

        // 초기 목표 위치 설정 (원격 플레이어용)
        if (!this.isLocalPlayer) {
            this.targetPos = { x: config.x, y: config.y };
        }
        // 플레이어 스프라이트 생성
        this.sprite = this.scene.add.sprite(config.x, config.y, `player_${this.colorName}_standing`);
        this.sprite.setOrigin(0.5, 1); // 하단 중앙을 기준으로 설정하여 충돌체 하단과 일치시키기 용이하게 함
        this.sprite.play(`player_idle_${this.colorName}`);
        this.sprite.setDepth(10); // 기믹보다 위로 배치
    }

    private createBody(x: number, y: number): MatterJS.BodyType {
        const size = BASE_PLAYER_SIZE * this.sizeMultiplier;
        const body = this.scene.matter.add.rectangle(x, y, size, size, {
            label: this.id,
            friction: PHYSICS.FRICTION,
            frictionStatic: PHYSICS.STATIC_FRICTION,
            frictionAir: PHYSICS.AIR_FRICTION,
            restitution: PHYSICS.RESTITUTION,
            isSensor: false // 모든 플레이어 물리 충돌 활성화 (상호작용 및 기믹 호환성 복구)
        });

        // 회전 완전 고정 (피코파크 스타일)
        this.scene.matter.body.setInertia(body, Infinity);

        return body;
    }

    private updateVisualEffects(): void {
        // 스턴 상태 시 시각적 효과 (빨간색)
        if (this._isStunned) {
            this.sprite.setTint(0xff5555);
        } else {
            this.sprite.clearTint();
        }

        // 크기 배율 적용 (충돌 박스 60px 대비 시각적으로 3배 더 크게 표현)
        // [MERGE] dev-frontend의 3배 확대 적용 + 기존의 visualProxy 비활성화 유지
        const displaySize = BASE_PLAYER_SIZE * this.sizeMultiplier * 3.0;
        this.sprite.setDisplaySize(displaySize, displaySize);

        // [FALLBACK] 비주얼 프록시(도형) 업데이트 - 비활성화됨
        // if (this.visualProxy) {
        //     this.visualProxy.clear();
        //     this.visualProxy.fillStyle(this.color, 1);
        //     const size = BASE_PLAYER_SIZE * this.sizeMultiplier;
        //     const { x, y } = this.body.position;
        //     this.visualProxy.fillCircle(x, y, size / 2);
        //     this.visualProxy.lineStyle(2, 0xffffff, 1);
        //     this.visualProxy.strokeCircle(x, y, size / 2);
        //     this.visualProxy.setDepth(9);
        // }
    }

    public update(isGrounded: boolean): void {
        // 원격 플레이어 보간 이동
        if (!this.isLocalPlayer && this.targetPos) {
            const currentX = this.body.position.x;
            const currentY = this.body.position.y;

            // 거리 계산
            const dx = this.targetPos.x - currentX;
            const dy = this.targetPos.y - currentY;
            const distSq = dx * dx + dy * dy;

            // 아주 작은 움직임은 무시하여 떨림 방지
            if (distSq > 0.01) {
                // 텔레포트 임계값 (100px)
                if (distSq > 10000) {
                    this.scene.matter.body.setPosition(this.body, { x: this.targetPos.x, y: this.targetPos.y });
                } else {
                    // 선형 보간 (Lerp)
                    // LERP_FACTOR를 0.2 -> 0.15로 낮추어 더 부드럽게 이동 (지연은 약간 늘어남)
                    const newX = Phaser.Math.Linear(currentX, this.targetPos.x, this.LERP_FACTOR);
                    const newY = Phaser.Math.Linear(currentY, this.targetPos.y, this.LERP_FACTOR);

                    // 위치 변경
                    this.scene.matter.body.setPosition(this.body, { x: newX, y: newY });
                }
            }

            // 물리 엔진에 의한 불필요한 이동 방지 (중력 등 무시)
            // 원격 플레이어는 서버 좌표를 추종하므로 속도를 0으로 유지
            this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
            this.scene.matter.body.setAngularVelocity(this.body, 0);
        }

        const { x, y } = this.body.position;
        const currentBodyHeight = BASE_PLAYER_SIZE * this.sizeMultiplier;
        // 스프라이트의 origin이 (0.5, 1)이므로 y 좌표를 몸체 하단(y + height/2)에 맞춤
        this.sprite.setPosition(x, y + currentBodyHeight / 2);

        // 애니메이션 상태 업데이트 (로컬 플레이어만)
        if (this.isLocalPlayer) {
            this.updateAnimation(isGrounded);
        }

        // 비주얼 효과 업데이트
        this.updateVisualEffects();

        // HP 바 업데이트 (drain 저주가 있을 때만)
        if (this.hpBarGraphics) {
            this.drawHPBar();
        }

        // 비주얼 프록시(도형) 업데이트 - 비활성화
        // if (this.visualProxy) {
        //     this.visualProxy.clear();
        //     this.visualProxy.fillStyle(this.color, 1);
        //     // 스프라이트가 안 보일 때를 대비해 기본적으로 그림 (반투명 혹은 테두리)
        //     // 혹은 스프라이트 뒤에 백업으로 배치
        //     const size = BASE_PLAYER_SIZE * this.sizeMultiplier;
        //     this.visualProxy.fillCircle(x, y, size / 2);
        //     this.visualProxy.lineStyle(2, 0xffffff, 1);
        //     this.visualProxy.strokeCircle(x, y, size / 2);
        //     this.visualProxy.setDepth(9); // 스프라이트(10)보다 약간 뒤
        // }
    }

    private updateAnimation(isGrounded: boolean): void {
        // 죽은 상태면 dead 애니메이션 고정 (HP 기반 또는 강제 사망 상태)
        if (this._isDead || this.curseHP <= 0) {
            if (this.sprite.anims.currentAnim?.key !== `player_dead_${this.colorName}`) {
                this.sprite.play(`player_dead_${this.colorName}`);
            }
            return;
        }

        const velocity = this.body.velocity;
        // 바닥 접촉 여부 (Scene에서 전달받은 값 사용)
        // const isGrounded = Math.abs(velocity.y) < 0.2; // [FIX] 기존 속도 기반 체크 제거

        // 좌우 반전 (임계값을 0.5로 높여 미세한 떨림 시 뒤집힘 방지)
        if (Math.abs(velocity.x) > 0.5) {
            this.sprite.setFlipX(velocity.x < 0);
        }

        if (!isGrounded) {
            // 공중 상태 (점프 또는 추락)
            if (this.sprite.anims.currentAnim?.key !== `player_jump_${this.colorName}`) {
                this.sprite.play(`player_jump_${this.colorName}`);
            }
        } else if (Math.abs(velocity.x) > 0.5) {
            // 걷기 (임계값 상향)
            if (this.sprite.anims.currentAnim?.key !== `player_walk_${this.colorName}`) {
                this.sprite.play(`player_walk_${this.colorName}`);
            }
        } else {
            // 대기
            if (this.sprite.anims.currentAnim?.key !== `player_idle_${this.colorName}`) {
                this.sprite.play(`player_idle_${this.colorName}`);
            }
        }
    }

    public getSprite(): Phaser.GameObjects.Sprite {
        return this.sprite;
    }

    /**
     * 목표 위치 설정 (원격 플레이어 보간용)
     */
    public setTargetPosition(x: number, y: number): void {
        this.targetPos = { x, y };
    }

    // 원격 플레이어의 서버 상태 (방향 및 애니메이션 결정용)
    private remoteVx: number = 0;
    private remoteVy: number = 0;
    private remoteAnim: string | null = null;

    /**
     * 원격 플레이어 상태 동기화 (위치 + 속도 + 애니메이션)
     * @param x 목표 X 좌표
     * @param y 목표 Y 좌표
     * @param vx 서버에서 받은 X 속도 (방향 결정용)
     * @param vy 서버에서 받은 Y 속도 (점프 판정용)
     * @param anim 서버에서 받은 애니메이션 상태
     */
    public setRemoteState(x: number, y: number, vx: number, vy?: number, anim?: string): void {
        this.targetPos = { x, y };
        this.remoteVx = vx;
        if (vy !== undefined) this.remoteVy = vy;
        if (anim !== undefined) this.remoteAnim = anim;
    }

    /**
     * 원격 플레이어 방향(flip) 적용
     * 로컬이 아닌 플레이어의 방향을 서버 속도 기반으로 결정
     */
    public applyRemoteDirection(): void {
        if (this.isLocalPlayer) return;

        // vx 임계값 (0.5 이상일 때만 방향 변경, 미세한 떨림 방지)
        if (Math.abs(this.remoteVx) > 0.5) {
            this.sprite.setFlipX(this.remoteVx < 0);
        }
    }

    /**
     * 원격 플레이어 애니메이션 적용
     * 서버에서 받은 anim 또는 vx, vy 기반으로 애니메이션 결정
     */
    public applyRemoteAnimation(): void {
        if (this.isLocalPlayer) return;
        if (this._isDead || this.curseHP <= 0) {
            if (this.sprite.anims.currentAnim?.key !== `player_dead_${this.colorName}`) {
                this.sprite.play(`player_dead_${this.colorName}`);
            }
            return;
        }

        // 서버 애니메이션 상태 우선 사용 (있을 경우)
        // 백엔드에서 'jump', 'walk', 'idle' 등을 전송
        if (this.remoteAnim) {
            // 서버에서 받은 anim이 있으면 매핑
            let targetAnim: string | null = null;
            if (this.remoteAnim.includes('jump')) {
                targetAnim = `player_jump_${this.colorName}`;
            } else if (this.remoteAnim.includes('walk')) {
                targetAnim = `player_walk_${this.colorName}`;
            } else if (this.remoteAnim.includes('idle')) {
                targetAnim = `player_idle_${this.colorName}`;
            }

            if (targetAnim && this.sprite.anims.currentAnim?.key !== targetAnim) {
                this.sprite.play(targetAnim);
                return;
            }
        }

        // Fallback: 속도 기반 애니메이션 결정
        const isAirborne = Math.abs(this.remoteVy) > 1;
        const isMoving = Math.abs(this.remoteVx) > 0.5;

        if (isAirborne) {
            if (this.sprite.anims.currentAnim?.key !== `player_jump_${this.colorName}`) {
                this.sprite.play(`player_jump_${this.colorName}`);
            }
        } else if (isMoving) {
            if (this.sprite.anims.currentAnim?.key !== `player_walk_${this.colorName}`) {
                this.sprite.play(`player_walk_${this.colorName}`);
            }
        } else {
            if (this.sprite.anims.currentAnim?.key !== `player_idle_${this.colorName}`) {
                this.sprite.play(`player_idle_${this.colorName}`);
            }
        }
    }

    /**
     * HP 바 그리기 (플레이어 위에 표시)
     */
    private drawHPBar(): void {
        if (!this.hpBarGraphics) return;

        const size = BASE_PLAYER_SIZE * this.sizeMultiplier;
        const barWidth = size + 10;
        const barHeight = 6;
        const x = this.body.position.x - barWidth / 2;
        const y = this.body.position.y - size / 2 - 15;

        this.hpBarGraphics.clear();

        // 배경
        this.hpBarGraphics.fillStyle(0x333333, 0.8);
        this.hpBarGraphics.fillRect(x, y, barWidth, barHeight);

        // HP
        const hpRatio = this.curseHP / 100;
        const hpColor = hpRatio > 0.5 ? 0x00ff00 : (hpRatio > 0.25 ? 0xffff00 : 0xff0000);
        this.hpBarGraphics.fillStyle(hpColor, 1);
        this.hpBarGraphics.fillRect(x, y, barWidth * hpRatio, barHeight);

        // 테두리
        this.hpBarGraphics.lineStyle(1, 0xffffff, 0.8);
        this.hpBarGraphics.strokeRect(x, y, barWidth, barHeight);
    }

    // ===== 저주 시스템 =====

    public applyCurse(curseId: string): void {
        const curse = CURSES[curseId];
        if (!curse) {
            console.warn(`[Player] Unknown curse: ${curseId}`);
            return;
        }

        console.log(`[Player] Applying curse '${curse.name}' to ${this.id}`);

        this.currentCurseId = curseId;
        this.sizeMultiplier = curse.sizeMultiplier;
        this.speedMultiplier = curse.speedMultiplier;
        this.jumpMultiplier = curse.jumpMultiplier ?? 1;
        this.reverseControls = curse.reverseControls ?? false;

        // HP 저주 처리
        if (curse.hasDrainEffect) {
            this.curseHP = 100;
            this.startHPDrain();
        }

        // 물리 바디 재생성 (크기 변경)
        const pos = this.body.position;
        const vel = this.body.velocity;
        this.scene.matter.world.remove(this.body);
        this.body = this.createBody(pos.x, pos.y);
        this.scene.matter.body.setVelocity(this.body, vel);

        // 비주얼 효과 업데이트
        this.updateVisualEffects();
    }

    private startHPDrain(): void {
        // 기존 타이머 제거
        this.stopHPDrain();

        // HP 바 생성
        if (!this.hpBarGraphics) {
            this.hpBarGraphics = this.scene.add.graphics();
        }

        // 1초마다 HP 20% 감소 (5초 후 죽음)
        this.hpDrainTimer = this.scene.time.addEvent({
            delay: 1000,
            repeat: 4,  // 5회 실행 (0, 1, 2, 3, 4)
            callback: () => {
                this.curseHP -= 20;
                if (this.curseHP <= 0) {
                    this.curseHP = 0;
                    if (this.onDeathCallback) {
                        this.onDeathCallback();
                    }
                }
            }
        });
    }

    private stopHPDrain(): void {
        if (this.hpDrainTimer) {
            this.hpDrainTimer.remove();
            this.hpDrainTimer = null;
        }
        if (this.hpBarGraphics) {
            this.hpBarGraphics.clear();
            this.hpBarGraphics.destroy();
            this.hpBarGraphics = null;
        }
    }

    public removeCurse(): void {
        if (!this.currentCurseId) return;

        console.log(`[Player] Removing curse from ${this.id}`);
        this.currentCurseId = null;
        this.sizeMultiplier = 1;
        this.speedMultiplier = 1;
        this.jumpMultiplier = 1;
        this.reverseControls = false;

        this.stopHPDrain();

        // 물리 바디 재생성
        const pos = this.body.position;
        const vel = this.body.velocity;
        this.scene.matter.world.remove(this.body);
        this.body = this.createBody(pos.x, pos.y);
        this.scene.matter.body.setVelocity(this.body, vel);

        // 비주얼 효과 업데이트
        this.updateVisualEffects();
    }

    public hasCurse(): boolean {
        return this.currentCurseId !== null;
    }

    public setOnDeathCallback(callback: () => void): void {
        this.onDeathCallback = callback;
    }

    public getSpeedMultiplier(): number {
        return this.speedMultiplier;
    }

    public getJumpMultiplier(): number {
        return this.jumpMultiplier;
    }

    public setColor(colorIndex: number): void {
        const newColor = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
        const colors = ['green', 'blue', 'orange', 'purple'];
        const newColorName = colors[colorIndex % colors.length];

        if (this.color !== newColor) {
            this.color = newColor;
            this.colorName = newColorName;

            // 애니메이션 갱신 (현재 상태 유지하며 색상 변경)
            const currentAnim = this.sprite.anims.currentAnim?.key;
            if (currentAnim) {
                // 예: "player_idle_green" -> "player_idle_blue"
                const parts = currentAnim.split('_');
                const action = parts[1]; // idle, walk, jump, dead
                this.sprite.play(`player_${action}_${this.colorName}`, true);
            } else {
                this.sprite.play(`player_idle_${this.colorName}`);
            }
            this.updateVisualEffects();
        }
    }

    public get isControlReversed(): boolean {
        return this.reverseControls;
    }

    public applyKnockback(forceX: number, forceY: number, duration: number): void {
        // 기존 코드 복구: applyForce가 아니라 setVelocity를 사용해야 함
        // Bumper power(8)는 Force로 쓰기엔 너무 크고 Velocity로 쓰기에 적당함
        this.scene.matter.body.setVelocity(this.body, { x: forceX, y: forceY });
        this.stun(duration);
    }

    // ===== 스턴 시스템 =====

    public stun(duration: number): void {
        if (this._isStunned) return;

        this._isStunned = true;
        this.updateVisualEffects(); // 색상 변경을 위해 즉시 업데이트

        // 일정 시간 후 스턴 해제
        if (this.stunTimer) this.stunTimer.destroy();

        // 지속 시간 후 스턴 해제
        this.stunTimer = this.scene.time.delayedCall(duration, () => {
            this._isStunned = false;
            this.stunTimer = null;
            this.updateVisualEffects(); // 원래 색상으로 복구
        });


    }

    public get isStunned(): boolean {
        return this._isStunned;
    }

    // ===== 기존 메서드들 =====

    public getPosition(): { x: number; y: number } {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    public getVelocity(): { x: number; y: number } {
        return { x: this.body.velocity.x, y: this.body.velocity.y };
    }

    public setVelocity(x: number, y: number): void {
        this.scene.matter.body.setVelocity(this.body, { x, y });
    }



    public setPosition(x: number, y: number): void {
        this.scene.matter.body.setPosition(this.body, { x, y });
        this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    }

    // Goal 입장 시 플레이어 숨기기
    private _isHidden: boolean = false;

    public hide(): void {
        if (this._isHidden) return;
        this._isHidden = true;
        this.sprite.setVisible(false);
        // 센서로 변경 (충돌 블로킹 해제, 다른 플레이어가 통과 가능)
        this.body.isSensor = true;
        this.scene.matter.body.setStatic(this.body, true);
        this.setVelocity(0, 0);
        console.log(`[Player] Hidden: ${this.id}`);
    }

    public show(): void {
        if (!this._isHidden) return;
        this._isHidden = false;
        this.sprite.setVisible(true);
        // 센서 해제 (다시 충돌 블로킹)
        this.body.isSensor = false;
        this.scene.matter.body.setStatic(this.body, false);
        console.log(`[Player] Shown: ${this.id}`);
    }

    public get isHidden(): boolean {
        return this._isHidden;
    }

    public die(): void {
        this._isDead = true;
        // 물리 엔진에서 반응하지 않도록 설정 (선택 사항)
        this.setVelocity(0, 0);
        // 애니메이션 즉시 업데이트를 위해 updateAnimation 호출 가능
    }

    public getBodyLabel(): string {
        return this.body.label || this.id;
    }

    public hardResetVisuals(): void {
        console.log(`[Player] Hard resetting visuals for ${this.nickname}`);

        // 1. 기존 스프라이트 제거
        if (this.sprite) {
            this.sprite.destroy();
        }
        // 기존 프록시 제거
        if (this.visualProxy) {
            this.visualProxy.destroy();
        }

        // 2. 스프라이트 새로 생성
        this.sprite = this.scene.add.sprite(this.body.position.x, this.body.position.y, `player_${this.colorName}_standing`);

        // [FALLBACK] 비주얼 프록시(도형) 생성 - 비활성화
        // this.visualProxy = this.scene.add.graphics();

        // 3. 상태 복구
        this.sprite.setDepth(10);
        this.sprite.setVisible(true);
        this.sprite.setActive(true);
        this.sprite.setAlpha(1);

        // 4. 애니메이션 재시작 (Idle)
        const idleAnim = `player_idle_${this.colorName}`;
        if (this.scene.anims.exists(idleAnim)) {
            this.sprite.play(idleAnim, true);
        }

        // 5. 스턴 상태라면 틴트 복구 (메서드 활용)
        this.updateVisualEffects();
    }

    public forceRefreshVisuals(): void {
        if (!this.sprite) return;

        console.log(`[Player] Forcing visual refresh for ${this.nickname}`);

        // 1. 투명도 및 활성 상태 강제 복구
        this.sprite.setVisible(true);
        this.sprite.setActive(true);
        this.sprite.setAlpha(1);
        this.sprite.setDepth(10);

        // 2. 애니메이션 재시작 (Idle로 리셋)
        if (this.scene.anims.exists(`player_idle_${this.colorName}`)) {
            this.sprite.play(`player_idle_${this.colorName}`, true);
        }

        // 3. 틴트 초기화
        this.sprite.clearTint();

        // 4. 크기 재설정
        this.updateVisualEffects();
    }

    public destroy(): void {
        if (this.hpDrainTimer) {
            this.hpDrainTimer.remove();
            this.hpDrainTimer = null;
        }
        if (this.stunTimer) {
            this.stunTimer.remove();
            this.stunTimer = null;
        }
        if (this.hpBarGraphics) {
            this.hpBarGraphics.destroy();
            this.hpBarGraphics = null;
        }
        if (this.visualProxy) {
            this.visualProxy.clear();
            this.visualProxy.destroy();
            this.visualProxy = null;
        }

        // 물리 바디 제거 - 씬이 이미 종료되었을 수 있으므로 체크
        if (this.scene?.matter?.world) {
            if (this.body) {
                this.scene.matter.world.remove(this.body);
            }
        }

        // 스프라이트 제거
        if (this.sprite) {
            this.sprite?.destroy();
        }

        console.log(`[Player] ${this.nickname} destroyed`);
    }
}
