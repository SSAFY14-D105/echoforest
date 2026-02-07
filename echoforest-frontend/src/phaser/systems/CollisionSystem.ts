/**
 * CollisionSystem - 충돌 처리 시스템
 * 
 * BaseGameScene에서 분리된 모든 충돌 관련 로직을 담당합니다.
 * - 열쇠/자물쇠, 가시, 골, 스프링, 범퍼 등 기믹 충돌
 * - 플레이어 지지 관계
 * - 사망 처리
 */

import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { Key, Lock, Spike, Goal, Spring, Bumper, MovingBumper, PoisonMushroom, BlockButton, TogglePlatform, TriggerButton, Signboard, GhostPlatform, MovableBlock } from '../gimmicks';
import { getRandomCurseId } from '../config/curseConfig';

// 씬에서 필요한 기믹과 상태에 접근하기 위한 인터페이스
export interface CollisionContext {
    // 기믹 접근
    players: Map<string, Player>;
    keys: Key[];
    locks: Lock[];
    spikes: Spike[];
    goals: Goal[];
    springs: Spring[];
    bumpers: Bumper[];
    movingBumpers: MovingBumper[];
    poisonMushrooms: PoisonMushroom[];
    blockButtons: BlockButton[];
    togglePlatforms: TogglePlatform[];
    triggerButtons: TriggerButton[];
    signboards: Signboard[];
    ghostPlatforms: GhostPlatform[];
    movableBlocks: MovableBlock[];

    // 상태
    myPlayerId: string;
    isDead: boolean;

    // 콜백
    triggerDeath: (reason: string) => void;
    applyCurseToPlayer: (playerId: string, curseId: string) => void;
    showFloatingText: (x: number, y: number, text: string, color: number) => void;
    spawnMovableBlock: (config: any) => void;
    hideMessagePopup: () => void;
    showMessagePopup: (text: string) => void;
    getSceneKey: () => string;
    getRequiredPlayers: () => number;
    shouldSpawnGoalOnUnlock: () => boolean;
    getGoalConfig: () => { texture?: string; frame?: string | number; width?: number; height?: number };
}

export class CollisionSystem {
    private scene: Phaser.Scene;
    private context: CollisionContext;

    // 지지 관계 추적 (밑에 있는 것의 label -> 위에 있는 것들의 label Set)
    private supportMap: Map<string, Set<string>> = new Map();
    // 밀기 관계 추적
    private pushMapLeft: Map<string, Set<string>> = new Map();
    private pushMapRight: Map<string, Set<string>> = new Map();
    // 블록 접촉 관계
    private blockContactLeft: Map<string, string | null> = new Map();
    private blockContactRight: Map<string, string | null> = new Map();
    // 코요테 타임
    private groundedFrames: Map<string, number> = new Map();
    private readonly COYOTE_FRAMES = 6;

    // 표지판 상태는 context를 통해 씬에서 관리

    constructor(scene: Phaser.Scene, context: CollisionContext) {
        this.scene = scene;
        this.context = context;
    }

    /**
     * 충돌 이벤트 리스너 등록
     */
    public setup(): void {
        const matter = (this.scene as any).matter;
        matter.world.on('collisionstart', this.onCollisionStart, this);
        matter.world.on('collisionactive', this.onCollisionActive, this);
        matter.world.on('collisionend', this.onCollisionEnd, this);
    }

    /**
     * 충돌 이벤트 리스너 제거
     */
    public destroy(): void {
        const matter = (this.scene as any).matter;
        matter.world.off('collisionstart', this.onCollisionStart, this);
        matter.world.off('collisionactive', this.onCollisionActive, this);
        matter.world.off('collisionend', this.onCollisionEnd, this);

        this.supportMap.clear();
        this.pushMapLeft.clear();
        this.pushMapRight.clear();
        this.blockContactLeft.clear();
        this.blockContactRight.clear();
        this.groundedFrames.clear();
    }

    /**
     * 지지 관계 맵 반환 (엘리베이터 등에서 사용)
     */
    public getSupportMap(): Map<string, Set<string>> {
        return this.supportMap;
    }

    /**
     * 코요테 타임 프레임 반환
     */
    public getGroundedFrames(): Map<string, number> {
        return this.groundedFrames;
    }

    /**
     * 밀기 관계 맵 반환
     */
    public getPushMaps(): { left: Map<string, Set<string>>, right: Map<string, Set<string>> } {
        return { left: this.pushMapLeft, right: this.pushMapRight };
    }

    /**
     * 블록 접촉 관계 반환
     */
    public getBlockContacts(): { left: Map<string, string | null>, right: Map<string, string | null> } {
        return { left: this.blockContactLeft, right: this.blockContactRight };
    }

    // === 충돌 이벤트 핸들러 ===

    private onCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
        event.pairs.forEach((pair) => {
            const labelA = pair.bodyA.label || '';
            const labelB = pair.bodyB.label || '';

            if (labelA.startsWith('key-') || labelB.startsWith('key-')) {
                this.handleKeyCollision(labelA, labelB);
            }
            if (labelA.startsWith('spike-') || labelB.startsWith('spike-')) {
                this.handleSpikeCollision(labelA, labelB);
            }
            if (labelA.startsWith('goal-') || labelB.startsWith('goal-')) {
                this.handleGoalEnter(labelA, labelB);
            }
            if (labelA.startsWith('spring-') || labelB.startsWith('spring-')) {
                this.handleSpringCollision(labelA, labelB);
            }

            // 낙사 센서
            if (labelA === 'death-zone' || labelB === 'death-zone') {
                const playerLabel = this.context.players.has(labelA) ? labelA :
                    (this.context.players.has(labelB) ? labelB : null);
                if (playerLabel) {
                    this.context.triggerDeath('fall');
                }
            }

            // 지지 관계
            if (labelA.startsWith('elevator-') || labelB.startsWith('elevator-') ||
                (this.context.players.has(labelA) && this.context.players.has(labelB))) {
                this.handleSupportStart(pair);
            }

            // 범퍼
            const bumperType = (labelA === 'bumper' || labelA.startsWith('moving-bumper-')) ? labelA :
                ((labelB === 'bumper' || labelB.startsWith('moving-bumper-')) ? labelB : null);

            if (bumperType) {
                if (bumperType === 'bumper') {
                    this.handleBumperCollision(labelA, labelB);
                } else if (bumperType.startsWith('moving-bumper-')) {
                    this.handleMovingBumperCollision(labelA, labelB);
                }
            }

            if (labelA.startsWith('mushroom-') || labelB.startsWith('mushroom-')) {
                this.handleMushroomCollision(labelA, labelB);
            }

            if (labelA.startsWith('button-') || labelB.startsWith('button-')) {
                this.handleButtonCollision(labelA, labelB);
            }

            if (labelA.startsWith('ttrigger-') || labelB.startsWith('ttrigger-')) {
                this.handleTriggerButtonCollision(labelA, labelB);
            }

            if (labelA.startsWith('signboard-') || labelB.startsWith('signboard-')) {
                this.handleSignboardOverlap(labelA, labelB, true);
            }

            if (labelA.startsWith('ghost-platform-') || labelB.startsWith('ghost-platform-')) {
                this.handleGhostPlatformOverlap(labelA, labelB, true);
            }
        });
    }

    private onCollisionActive(event: Phaser.Physics.Matter.Events.CollisionActiveEvent): void {
        event.pairs.forEach((pair) => {
            const labelA = pair.bodyA.label || '';
            const labelB = pair.bodyB.label || '';
            const normal = pair.collision.normal;
            const isSensorA = pair.bodyA.isSensor;
            const isSensorB = pair.bodyB.isSensor;

            // 코요테 타임 리셋
            if (this.context.players.has(labelA) && normal.y < -0.5 && !isSensorB) {
                this.groundedFrames.set(labelA, this.COYOTE_FRAMES);
            }
            if (this.context.players.has(labelB) && normal.y > 0.5 && !isSensorA) {
                this.groundedFrames.set(labelB, this.COYOTE_FRAMES);
            }

            // 블록 밀기
            if ((labelA.startsWith('block-') && this.context.players.has(labelB)) ||
                (labelB.startsWith('block-') && this.context.players.has(labelA))) {
                this.handleBlockPush(pair);
            }

            // 블록-블록 접촉
            if (labelA.startsWith('block-') && labelB.startsWith('block-')) {
                if (Math.abs(normal.x) > 0.5) {
                    const posA = pair.bodyA.position;
                    const posB = pair.bodyB.position;
                    if (posA.x < posB.x) {
                        this.blockContactRight.set(labelA, labelB);
                        this.blockContactLeft.set(labelB, labelA);
                    } else {
                        this.blockContactLeft.set(labelA, labelB);
                        this.blockContactRight.set(labelB, labelA);
                    }
                }
            }
        });
    }

    private onCollisionEnd(event: Phaser.Physics.Matter.Events.CollisionEndEvent): void {
        event.pairs.forEach((pair) => {
            const labelA = pair.bodyA.label || '';
            const labelB = pair.bodyB.label || '';

            if (labelA.startsWith('signboard-') || labelB.startsWith('signboard-')) {
                this.handleSignboardOverlap(labelA, labelB, false);
            }

            if (labelA.startsWith('ghost-platform-') || labelB.startsWith('ghost-platform-')) {
                this.handleGhostPlatformOverlap(labelA, labelB, false);
            }

            if (labelA.startsWith('goal-') || labelB.startsWith('goal-')) {
                this.handleGoalExit(labelA, labelB);
            }

            this.handleSupportEnd(labelA, labelB);
        });
    }

    // === 개별 충돌 핸들러 ===

    private handleSupportStart(pair: any): void {
        const normal = pair.collision.normal;
        if (Math.abs(normal.y) < 0.5) return;

        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        let top = bodyA;
        let bottom = bodyB;

        if (bodyA.position.y > bodyB.position.y) {
            top = bodyB;
            bottom = bodyA;
        }

        const topLabel = top.label;
        const bottomLabel = bottom.label;

        if (!this.supportMap.has(bottomLabel)) {
            this.supportMap.set(bottomLabel, new Set());
        }
        this.supportMap.get(bottomLabel)!.add(topLabel);
    }

    private handleSupportEnd(labelA: string, labelB: string): void {
        if (this.supportMap.has(labelA)) {
            this.supportMap.get(labelA)!.delete(labelB);
        }
        if (this.supportMap.has(labelB)) {
            this.supportMap.get(labelB)!.delete(labelA);
        }
    }

    private handleKeyCollision(labelA: string, labelB: string): void {
        const keyLabel = labelA.startsWith('key-') ? labelA : labelB;
        const keyId = keyLabel.replace('key-', '');

        const key = this.context.keys.find(k => k.id === keyId);
        if (key && !key.getIsCollected()) {
            key.collect();

            const targetLocks = this.context.locks.filter(l => l.id === key.linkedLockId);

            targetLocks.forEach(lock => {
                if (lock.getIsUnlocked()) return;

                lock.unlock();

                if (lock.targetGoalId !== undefined) {
                    const targetGoals = this.context.goals.filter(g => g.targetGoalId === lock.targetGoalId);

                    if (targetGoals.length > 0) {
                        targetGoals.forEach(targetGoal => {
                            targetGoal.setVisible(true);
                            // console.log(`[${this.context.getSceneKey()}] Goal activated via Lock: ${lock.id}`);
                        });
                    }
                } else if (this.context.shouldSpawnGoalOnUnlock()) {
                    const fallbackGoalId = `goal-lock-${lock.id}`;
                    const existingGoal = this.context.goals.find(g => g.id === fallbackGoalId);

                    if (!existingGoal) {
                        // Goal 생성은 씬에서 처리해야 함 - 로그만 남김
                        // console.log(`[${this.context.getSceneKey()}] Goal should spawn at Lock position: ${lock.id}`);
                    }
                }

            });
        }
    }

    private handleSpikeCollision(labelA: string, labelB: string): void {
        if (this.context.isDead) return;

        const playerLabel = labelA.startsWith('spike-') ? labelB : labelA;
        const player = this.context.players.get(playerLabel);

        if (player) {
            // console.log(`[${this.context.getSceneKey()}] Player hit spike!`);
            this.context.triggerDeath('spike');
        }
    }

    private handleBumperCollision(labelA: string, labelB: string): void {
        const playerLabel = this.context.players.has(labelA) ? labelA :
            (this.context.players.has(labelB) ? labelB : null);
        if (!playerLabel) return;

        const player = this.context.players.get(playerLabel)!;
        const playerPos = player.getPosition();
        let closestBumper: Bumper | null = null;
        let minDist = Infinity;

        for (const bumper of this.context.bumpers) {
            const bPos = bumper.getPosition();
            const dist = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, bPos.x, bPos.y);
            if (dist < minDist) {
                minDist = dist;
                closestBumper = bumper;
            }
        }

        if (closestBumper) {
            const bPos = closestBumper.getPosition();
            const power = closestBumper.getPower();
            const angle = Phaser.Math.Angle.Between(bPos.x, bPos.y, playerPos.x, playerPos.y);
            const forceX = Math.cos(angle) * power;
            const forceY = Math.sin(angle) * power;

            player.applyKnockback(forceX, forceY, 400);
        }
    }

    private handleMovingBumperCollision(labelA: string, labelB: string): void {
        const playerLabel = this.context.players.has(labelA) ? labelA :
            (this.context.players.has(labelB) ? labelB : null);
        if (!playerLabel) return;

        const player = this.context.players.get(playerLabel)!;
        const playerPos = player.getPosition();
        let closestMBumper: MovingBumper | null = null;
        let minDist = Infinity;

        for (const mBumper of this.context.movingBumpers) {
            const bPos = mBumper.getPosition();
            const dist = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, bPos.x, bPos.y);
            if (dist < minDist) {
                minDist = dist;
                closestMBumper = mBumper;
            }
        }

        if (closestMBumper) {
            const bPos = closestMBumper.getPosition();
            const power = closestMBumper.getPower();
            const angle = Phaser.Math.Angle.Between(bPos.x, bPos.y, playerPos.x, playerPos.y);
            const forceX = Math.cos(angle) * power;
            const forceY = Math.sin(angle) * power;

            player.applyKnockback(forceX, forceY, 400);
        }
    }

    private handleGoalEnter(labelA: string, labelB: string): void {
        const playerLabel = labelA.startsWith('goal-') ? labelB : labelA;
        if (this.context.players.has(playerLabel)) {
            this.context.goals.forEach(goal => goal.playerNear(playerLabel));
        }
    }

    private handleGoalExit(labelA: string, labelB: string): void {
        const playerLabel = labelA.startsWith('goal-') ? labelB : labelA;
        if (this.context.players.has(playerLabel)) {
            this.context.goals.forEach(goal => goal.playerAway(playerLabel));
        }
    }

    private handleSpringCollision(labelA: string, labelB: string): void {
        const springLabel = labelA.startsWith('spring-') ? labelA : labelB;
        const playerLabel = labelA.startsWith('spring-') ? labelB : labelA;
        const springId = springLabel.replace('spring-', '');

        const spring = this.context.springs.find(s => s.id === springId);
        const player = this.context.players.get(playerLabel);

        if (spring && player) {
            const velocity = player.getVelocity();
            const playerPos = player.getPosition();
            const springPos = spring.getPosition();

            if (velocity.y > 1 && playerPos.y < springPos.y) {
                player.setVelocity(velocity.x, spring.getBouncePower());
                spring.animate();
            }
        }
    }

    private handleMushroomCollision(labelA: string, labelB: string): void {
        const mushroomLabel = labelA.startsWith('mushroom-') ? labelA : labelB;
        const mushroomId = mushroomLabel.replace('mushroom-', '');
        const mushroom = this.context.poisonMushrooms.find(m => m.id === mushroomId);

        if (mushroom && !mushroom.getIsTriggered()) {
            mushroom.trigger();

            const playerNicknames = Array.from(this.context.players.keys());
            if (playerNicknames.length > 0) {
                const randomIdx = Math.floor(Math.random() * playerNicknames.length);
                const randomTarget = playerNicknames[randomIdx];
                const randomCurse = getRandomCurseId();

                this.context.applyCurseToPlayer(randomTarget, randomCurse);

                const targetPlayer = this.context.players.get(randomTarget);
                if (targetPlayer) {
                    const pos = targetPlayer.getPosition();
                    this.context.showFloatingText(pos.x, pos.y - 40, `독버섯 저주: ${randomCurse}!`, 0x9B59B6);
                }
            }
        }
    }

    private handleButtonCollision(labelA: string, labelB: string): void {
        const buttonLabel = labelA.startsWith('button-') ? labelA : labelB;
        const buttonId = buttonLabel.replace('button-', '');
        const button = this.context.blockButtons.find(b => b.id === buttonId);

        if (button && !button.getIsPressed()) {
            if (button.press()) {
                if (button.targetBlockId !== undefined) {
                    const targetBlocks = this.context.movableBlocks.filter(b => b.targetBlockId === button.targetBlockId);

                    if (targetBlocks.length > 0) {
                        targetBlocks.forEach(block => block.setVisible(true));
                    }
                } else if (button.spawnConfig) {
                    this.context.spawnMovableBlock(button.spawnConfig);
                }

                const feedback = button.targetBlockId !== undefined ? "블록 활성화!" : "블록 소환!";
                this.context.showFloatingText(button.getBody().position.x, button.getBody().position.y - 40, feedback, 0x2ECC71);
            }
        }
    }

    private handleTriggerButtonCollision(labelA: string, labelB: string): void {
        const buttonLabel = labelA.startsWith('ttrigger-') ? labelA : labelB;
        const buttonId = buttonLabel.replace('ttrigger-', '');
        const button = this.context.triggerButtons.find(b => b.id === buttonId);

        if (button && (!button.oneTime || !button.getIsPressed())) {
            if (button.press()) {
                const targetId = button.targetId;
                const platform = this.context.togglePlatforms.find(p => p.id === targetId);

                if (platform) {
                    platform.toggle();
                    const feedback = platform.getIsVisible() ? "문 닫힘!" : "문 열림!";
                    this.context.showFloatingText(button.getBody().position.x, button.getBody().position.y - 40, feedback, 0xF1C40F);
                }
            }
        }
    }

    private handleSignboardOverlap(labelA: string, labelB: string, isStart: boolean): void {
        const signboardLabel = labelA.startsWith('signboard-') ? labelA : labelB;
        const playerLabel = labelA.startsWith('signboard-') ? labelB : labelA;

        if (playerLabel === this.context.myPlayerId) {
            const signboardId = signboardLabel.replace('signboard-', '');
            const signboard = this.context.signboards.find(sb => sb.id === signboardId);

            if (signboard) {
                signboard.setOverlap(isStart);

                if (!isStart) {
                    this.context.hideMessagePopup();
                }
            }
        }
    }


    private handleGhostPlatformOverlap(labelA: string, labelB: string, isStart: boolean): void {
        const ghostLabel = labelA.startsWith('ghost-platform-') ? labelA : labelB;
        const playerLabel = labelA.startsWith('ghost-platform-') ? labelB : labelA;

        if (this.context.players.has(playerLabel)) {
            const ghostId = ghostLabel.replace('ghost-platform-', '');
            const ghost = this.context.ghostPlatforms.find(gp => gp.id === ghostId);
            if (ghost) {
                ghost.setOverlap(isStart);
            }
        }
    }

    private handleBlockPush(pair: any): void {
        const normal = pair.collision.normal;
        if (Math.abs(normal.x) < 0.5) return;

        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        const labelA = bodyA.label || '';
        const labelB = bodyB.label || '';

        let blockLabel: string;
        let playerLabel: string;

        if (labelA.startsWith('block-')) {
            blockLabel = labelA;
            playerLabel = labelB;
        } else {
            blockLabel = labelB;
            playerLabel = labelA;
        }

        const blockPos = labelA.startsWith('block-') ? bodyA.position : bodyB.position;
        const playerPos = labelA.startsWith('block-') ? bodyB.position : bodyA.position;

        if (playerPos.x < blockPos.x) {
            if (!this.pushMapLeft.has(blockLabel)) {
                this.pushMapLeft.set(blockLabel, new Set());
            }
            this.pushMapLeft.get(blockLabel)!.add(playerLabel);
        } else {
            if (!this.pushMapRight.has(blockLabel)) {
                this.pushMapRight.set(blockLabel, new Set());
            }
            this.pushMapRight.get(blockLabel)!.add(playerLabel);
        }
    }
}
