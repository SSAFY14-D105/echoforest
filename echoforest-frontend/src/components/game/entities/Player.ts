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
    private sprite: Phaser.GameObjects.Sprite;
    private colorName: string;

    public readonly id: string;
    public readonly nickname: string;
    public readonly color: number;
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

        // 플레이어 스프라이트 생성
        this.sprite = this.scene.add.sprite(config.x, config.y, `player_${this.colorName}`);
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
            restitution: PHYSICS.RESTITUTION
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

        // 크기 배율 적용 (충돌 박스 32px 대비 시각적으로 1.5배 더 크게 표현)
        this.sprite.setScale((BASE_PLAYER_SIZE / 528) * this.sizeMultiplier * 1.5);
    }

    public update(): void {
        const { x, y } = this.body.position;
        this.sprite.setPosition(x, y);

        // 애니메이션 상태 업데이트
        this.updateAnimation();

        // 비주얼 효과 업데이트
        this.updateVisualEffects();

        // HP 바 업데이트 (drain 저주가 있을 때만)
        if (this.hpBarGraphics) {
            this.drawHPBar();
        }
    }

    private updateAnimation(): void {
        // 죽은 상태면 dead 애니메이션 고정 (HP 기반 또는 사망 상태)
        if (this.curseHP <= 0) {
            if (this.sprite.anims.currentAnim?.key !== `player_dead_${this.colorName}`) {
                this.sprite.play(`player_dead_${this.colorName}`);
            }
            return;
        }

        const velocity = this.body.velocity;
        // 바닥 접촉 여부 (Y축 속도가 거의 없고 아래 방향 힘이 작용할 때)
        const isGrounded = Math.abs(velocity.y) < 0.1;

        // 좌우 반전
        if (Math.abs(velocity.x) > 0.1) {
            this.sprite.setFlipX(velocity.x < 0);
        }

        if (!isGrounded) {
            // 공중 상태 (점프 또는 추락)
            if (this.sprite.anims.currentAnim?.key !== `player_jump_${this.colorName}`) {
                this.sprite.play(`player_jump_${this.colorName}`);
            }
        } else if (Math.abs(velocity.x) > 0.1) {
            // 걷기
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

        // 배경 (어두운 빨강)
        this.hpBarGraphics.fillStyle(0x333333, 0.8);
        this.hpBarGraphics.fillRect(x, y, barWidth, barHeight);

        // HP (초록 → 빨강 그라데이션 효과)
        const hpRatio = this.curseHP / 100;
        const hpColor = hpRatio > 0.5 ? 0x00ff00 : (hpRatio > 0.25 ? 0xffff00 : 0xff0000);
        this.hpBarGraphics.fillStyle(hpColor, 1);
        this.hpBarGraphics.fillRect(x, y, barWidth * hpRatio, barHeight);

        // 테두리
        this.hpBarGraphics.lineStyle(1, 0xffffff, 0.8);
        this.hpBarGraphics.strokeRect(x, y, barWidth, barHeight);
    }

    // ===== 저주 시스템 =====

    /**
     * 저주 적용
     * @param curseId 저주 ID (curseConfig.ts에 정의된 ID)
     */
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

        // 비주얼 효과 업데이트
        this.updateVisualEffects();
    }

    /**
     * HP 감소 타이머 시작
     */
    private startHPDrain(): void {
        // 기존 타이머 제거
        this.stopHPDrain();

        // HP 바 생성
        if (!this.hpBarGraphics) {
            this.hpBarGraphics = this.scene.add.graphics();
        }

        // 1초마다 HP 20% 감소 (5초 후 좽음)
        this.hpDrainTimer = this.scene.time.addEvent({
            delay: 1000,
            repeat: 4,  // 5회 실행 (0, 1, 2, 3, 4)
            callback: () => {
                this.curseHP -= 20;
                console.log(`[Player] ${this.id} HP: ${this.curseHP}%`);

                if (this.curseHP <= 0) {
                    this.curseHP = 0;
                    this.onCurseDeath();
                }
            }
        });
    }

    /**
     * HP 감소 타이머 정지
     */
    private stopHPDrain(): void {
        if (this.hpDrainTimer) {
            this.hpDrainTimer.destroy();
            this.hpDrainTimer = null;
        }
        if (this.hpBarGraphics) {
            this.hpBarGraphics.destroy();
            this.hpBarGraphics = null;
        }
        this.curseHP = 100;
    }

    /**
     * 저주로 인한 좽음 처리
     */
    private onCurseDeath(): void {
        console.log(`[Player] ${this.id} died from curse!`);
        this.stopHPDrain();
        if (this.onDeathCallback) {
            this.onDeathCallback();
        }
    }

    /**
     * 좽음 콜백 설정 (BaseGameScene에서 설정)
     */
    public setOnDeathCallback(callback: () => void): void {
        this.onDeathCallback = callback;
    }

    /**
     * 저주 해제
     */
    public removeCurse(): void {
        if (!this.currentCurseId) return;

        console.log(`[Player] Removing curse from ${this.id}`);

        // HP 타이머 정지
        this.stopHPDrain();

        this.currentCurseId = null;
        this.sizeMultiplier = 1;
        this.speedMultiplier = 1;
        this.reverseControls = false;

        // 물리 바디 재생성 (원래 크기)
        const pos = this.body.position;
        const vel = this.body.velocity;
        this.scene.matter.world.remove(this.body);
        this.body = this.createBody(pos.x, pos.y);
        this.scene.matter.body.setVelocity(this.body, vel);

        // 비주얼 효과 업데이트
        this.updateVisualEffects();
    }

    /**
     * 속도 수정자 반환 (이동 로직에서 사용)
     */
    public getSpeedMultiplier(): number {
        return this.speedMultiplier;
    }

    /**
     * 저주 상태 확인
     */
    public hasCurse(): boolean {
        return this.currentCurseId !== null;
    }

    /**
     * 현재 저주 ID 반환
     */
    public getCurrentCurseId(): string | null {
        return this.currentCurseId;
    }

    /**
     * 조작 반전 여부 반환
     */
    public isControlReversed(): boolean {
        return this.reverseControls;
    }

    /**
     * 현재 HP 반환 (0~100)
     */
    public getCurseHP(): number {
        return this.curseHP;
    }

    // ===== 밀치기 및 스턴 시스템 =====

    /**
     * 밀치기 적용 및 스턴 상태 돌입
     * @param forceX X측 힘
     * @param forceY Y측 힘
     * @param duration 스턴 지속 시간 (ms)
     */
    public applyKnockback(forceX: number, forceY: number, duration: number = 300): void {
        if (this._isHidden) return;

        // 힘 적용 (경량화를 위해 setVelocity 사용)
        this.setVelocity(forceX, forceY);

        // 스턴 상태 돌입
        this._isStunned = true;
        this.updateVisualEffects(); // 색상 변경을 위해 즉시 업데이트

        // 기존 타이머 제거
        if (this.stunTimer) {
            this.stunTimer.destroy();
        }

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

    public getBodyLabel(): string {
        return this.body.label || this.id;
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

        // 물리 바디 제거
        if (this.body) {
            this.scene.matter.world.remove(this.body);
        }

        // 스프라이트 제거
        if (this.sprite) {
            this.sprite.destroy();
        }

        console.log(`[Player] ${this.nickname} destroyed`);
    }
}

