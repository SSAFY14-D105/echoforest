import Phaser from 'phaser';
import { CURSES } from '../config/curseConfig';

const PLAYER_COLORS = [0x4CAF50, 0x2196F3, 0xFF9800, 0x9C27B0]; // P1~P4 색상
const BASE_PLAYER_SIZE = 32;

// 물리 파라미터
const PHYSICS = {
    FRICTION: 0,           // 동적 마찰 없음 (벽에서 느리게 떨어지는 현상 방지)
    STATIC_FRICTION: 0.3,  // 정지 상태에서만 약간의 마찰
    AIR_FRICTION: 0.02,
    RESTITUTION: 0.1
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
    private graphics: Phaser.GameObjects.Graphics;

    public readonly id: string;
    public readonly nickname: string;
    public color: number;
    public readonly isLocalPlayer: boolean;

    // 저주 시스템
    private currentCurseId: string | null = null;
    private sizeMultiplier: number = 1;
    private speedMultiplier: number = 1;
    private reverseControls: boolean = false;

    // HP 저주용
    private curseHP: number = 100;
    private hpDrainTimer: Phaser.Time.TimerEvent | null = null;
    private hpBarGraphics: Phaser.GameObjects.Graphics | null = null;
    private onDeathCallback: (() => void) | null = null;

    // 밀치기(Knockback) 및 스턴 상태
    private _isStunned: boolean = false;
    private stunTimer: Phaser.Time.TimerEvent | null = null;

    // 목표 위치 (원격 플레이어 보간용)
    private targetPos: { x: number, y: number } | null = null;
    private readonly LERP_FACTOR = 0.15; // 0.2 -> 0.15: 더 부드럽게 (지연 시간은 미세하게 증가)

    constructor(scene: Phaser.Scene, config: PlayerConfig) {
        this.scene = scene;
        this.id = config.id;
        this.nickname = config.nickname;
        this.color = PLAYER_COLORS[config.colorIndex % PLAYER_COLORS.length];
        this.isLocalPlayer = config.isLocalPlayer;

        // 임시 가드
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

        // 플레이어 그래픽 생성
        this.graphics = this.scene.add.graphics();
        this.drawPlayer();
    }

    private createBody(x: number, y: number): MatterJS.BodyType {
        const size = BASE_PLAYER_SIZE * this.sizeMultiplier;
        const body = this.scene.matter.add.rectangle(x, y, size, size, {
            label: this.id,
            frictionStatic: PHYSICS.STATIC_FRICTION,
            frictionAir: PHYSICS.AIR_FRICTION,
            restitution: PHYSICS.RESTITUTION,
            isSensor: false // 모든 플레이어 물리 충돌 활성화 (상호작용 및 기믹 호환성 복구)
        });

        // 회전 완전 고정 (피코파크 스타일)
        this.scene.matter.body.setInertia(body, Infinity);

        return body;
    }

    private drawPlayer(): void {
        const size = BASE_PLAYER_SIZE * this.sizeMultiplier;

        this.graphics.clear();

        // 저주 효과 시각화 (테두리)
        if (this.currentCurseId) {
            this.graphics.lineStyle(3, CURSES[this.currentCurseId]?.color ?? 0xff0000, 0.8);
            this.graphics.strokeRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
        }

        // 스턴 상태 시 시각적 효과
        if (this._isStunned) {
            this.graphics.fillStyle(0xff5555, 1);
        } else {
            this.graphics.fillStyle(this.color, 1);
        }
        this.graphics.fillRect(-size / 2, -size / 2, size, size);
    }

    public update(): void {
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

        // 그래픽 위치를 물리 바디에 맞춤
        this.graphics.setPosition(this.body.position.x, this.body.position.y);

        // HP 바 업데이트 (drain 저주가 있을 때만)
        if (this.hpBarGraphics) {
            this.drawHPBar();
        }
    }

    /**
     * 목표 위치 설정 (원격 플레이어 보간용)
     */
    public setTargetPosition(x: number, y: number): void {
        this.targetPos = { x, y };
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

        // 그래픽 다시 그리기
        this.drawPlayer();
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
        this.reverseControls = false;

        this.stopHPDrain();

        // 물리 바디 재생성
        const pos = this.body.position;
        const vel = this.body.velocity;
        this.scene.matter.world.remove(this.body);
        this.body = this.createBody(pos.x, pos.y);
        this.scene.matter.body.setVelocity(this.body, vel);

        this.drawPlayer();
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

    public setColor(colorIndex: number): void {
        const newColor = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
        if (this.color !== newColor) {
            this.color = newColor;
            this.drawPlayer(); // 색상 변경 후 다시 그리기
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
        this.drawPlayer(); // 색상 변경 등 시각적 효과

        // 일정 시간 후 스턴 해제
        if (this.stunTimer) this.stunTimer.destroy();

        this.stunTimer = this.scene.time.addEvent({
            delay: duration,
            callback: () => {
                this._isStunned = false;
                this.drawPlayer();
            }
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
        this.graphics.setVisible(false);
        // 센서로 변경 (충돌 블로킹 해제, 다른 플레이어가 통과 가능)
        this.body.isSensor = true;
        this.scene.matter.body.setStatic(this.body, true);
        this.setVelocity(0, 0);
        console.log(`[Player] Hidden: ${this.id}`);
    }

    public show(): void {
        if (!this._isHidden) return;
        this._isHidden = false;
        this.graphics.setVisible(true);
        // 센서 해제 (다시 충돌 블로킹)
        this.body.isSensor = false;
        this.scene.matter.body.setStatic(this.body, false);
        console.log(`[Player] Shown: ${this.id}`);
    }

    public get isHidden(): boolean {
        return this._isHidden;
    }

    public getBodyLabel(): string {
        return this.body.label || this.id;
    }

    public destroy(): void {
        // 물리 바디 제거 - 씬이 이미 종료되었을 수 있으므로 체크
        if (this.scene?.matter?.world) {
            this.scene.matter.world.remove(this.body);
        }
        // 그래픽 제거
        this.graphics?.destroy();
    }
}
