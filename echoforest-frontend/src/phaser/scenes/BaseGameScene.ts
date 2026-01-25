import Phaser from 'phaser';
import { useGameStore } from '../../store/useGameStore';
import { Player } from '../entities/Player';
import type { PlayerConfig } from '../entities/Player';
import type { Player as StorePlayer } from '../../store/useGameStore';
import { Key, Lock, Spike, Goal, Spring, Elevator, MovableBlock, Bumper, MovingBumper } from '../gimmicks';
import { getRandomCurseId } from '../config/curseConfig';
import { createPlayerAnimations, preloadPlayerAssets, parseTiledMap, showFloatingText, setupTiledBackground as setupTiledBg } from '../utils';

// 물리 파라미터
export const PHYSICS = {
    MOVE_SPEED: 6,
    JUMP_POWER: -11,
    PLAYER_SIZE: 64
};

/**
 * BaseGameScene - 모든 게임 씬의 기본 클래스
 * 공통 로직: 플레이어 관리, 물리 설정, 입력 처리, 카메라
 * 서브클래스에서 createGimmicks()를 오버라이드하여 기믹 배치
 */
export default abstract class BaseGameScene extends Phaser.Scene {
    protected players: Map<string, Player> = new Map();
    protected myPlayerId: string = '';
    protected cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    protected gameHeight: number = 600;
    protected worldWidth: number = 800;
    protected storeUnsubscribe?: () => void;

    // 기믹들
    protected keys: Key[] = [];
    protected locks: Lock[] = [];
    protected spikes: Spike[] = [];
    protected goals: Goal[] = [];
    protected springs: Spring[] = [];
    protected elevators: Elevator[] = [];
    protected movableBlocks: MovableBlock[] = [];
    protected bumpers: Bumper[] = [];
    protected movingBumpers: MovingBumper[] = [];

    // 지지 관계 추적 (밑에 있는 것의 label -> 위에 있는 것들의 label Set)
    private supportMap: Map<string, Set<string>> = new Map();
    // 밀기 관계 추적 (블록 label -> 왼쪽/오른쪽에서 미는 플레이어 label Set)
    private pushMapLeft: Map<string, Set<string>> = new Map();
    private pushMapRight: Map<string, Set<string>> = new Map();
    // 블록-블록 접촉 관계 (블록 label -> 왼쪽/오른쪽에 접촉한 블록 label)
    private blockContactLeft: Map<string, string | null> = new Map();
    private blockContactRight: Map<string, string | null> = new Map();
    // 플레이어 바닥 접촉 코요테 타임 (플레이어 label -> 남은 프레임 수)
    private groundedFrames: Map<string, number> = new Map();
    private readonly COYOTE_FRAMES = 6;  // 약 0.1초 (60fps 기준)

    // 플레이어 상태
    protected isDead: boolean = false;

    // 저주 지속성 관리 (playerId -> curseId)
    // drain 저주는 제외하고 매 세션(씬 재시작)마다 유지됩니다.
    private static persistentCurses: Map<string, string> = new Map();

    // ===== Authoritative Server 모델용 =====
    // 서버 상태 전송 콜백 (GamePage에서 설정)
    // x, y, vx, vy, anim
    protected sendStateCallback: ((x: number, y: number, vx: number, vy: number, anim: string) => void) | null = null;

    // 상태 전송 쓰로틀링 (50ms마다 전송 = 20 TPS)
    private lastStateSendTime: number = 0;
    // 에러 로그 쓰로틀링 (1초마다)
    private lastErrorLogTime: number = 0;
    private readonly STATE_SEND_INTERVAL: number = 33;
    // 솔로 모드 여부 (로컬 물리 사용)
    protected isSoloMode: boolean = false;
    public static resetPersistentCurses(): void {
        BaseGameScene.persistentCurses.clear();
    }

    // 서브클래스에서 구현해야 할 추상 메서드
    protected abstract getSceneKey(): string;
    protected abstract getWorldWidth(): number;
    protected abstract getWorldHeight(): number;
    protected abstract getRequiredPlayers(): number;
    protected abstract createGimmicks(): void;

    // Goal 기믹의 시각적 설정을 정의 (텍스트, 프레임 등)
    protected getGoalConfig(): { texture?: string; frame?: string | number; width?: number; height?: number } {
        return { width: 48, height: 64 }; // 기본값
    }

    preload() {
        preloadPlayerAssets(this);
    }

    private createAnimations(): void {
        createPlayerAnimations(this);
    }

    /**
     * TMJ (Tiled JSON) 데이터를 파싱하여 맵과 기믹을 생성합니다.
     * 핵심 로직은 utils/TiledParser.ts로 분리되었습니다.
     * @param mapKey 로드된 JSON 에셋의 키
     */
    protected parseTiledData(mapKey: string): void {
        this.worldWidth = parseTiledMap(this, mapKey, this.keys, this.locks, this.springs);
    }

    create() {
        try {
            this.resetState();
            this.setupPhysics();
            this.setupInput();

            // 맵 및 카메라 설정
            this.createGimmicks(); // 맵 파싱 및 월드 크기 확정
            this.setupCamera();    // 확정된 월드 크기로 카메라 바운드 설정 (DEV는 setupCamera 먼저 호출하지만, worldWidth가 필요하므로 순서 유지)

            // 애니메이션 생성 (DEV)
            this.createAnimations();

            this.setupCollisions();
            this.syncPlayersFromStore();
            this.subscribeToStore();

            // 배경색 설정 (HEAD)
            // 맵이 안 보일 때 대비
            this.cameras.main.setBackgroundColor('#2d2d2d');

            // 탭 전환/최소화 시 안전장치 (HEAD)
            // 중복 리스너 방지를 위해 기존 것 제거 후 추가
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
            document.addEventListener('visibilitychange', this.handleVisibilityChange);

            // 씬 중지/삭제 시 클린업 등록 (DEV + HEAD)
            this.events.on('shutdown', this.shutdown, this);
            this.events.on('destroy', () => {
                this.shutdown();
                document.removeEventListener('visibilitychange', this.handleVisibilityChange);
            });

            // [LIFECYCLE] Scene Created Log
            console.log(`[LIFECYCLE] ${this.getSceneKey()} Created`);
        } catch (e) {
            console.error(`[CRITICAL] Error in ${this.getSceneKey()} create():`, e);
        }
    }



    // [CRITICAL FIX] Visibility Change 핸들러 분리 w/ Null Check
    private handleVisibilityChange = () => {
        console.log(`[VISIBILITY] State: ${document.visibilityState}, Scene: ${this.getSceneKey()}`);

        if (document.hidden) {
            // [SNAP] 화면이 숨겨졌을 때: 공중 부양 방지를 위해 바닥으로 강제 착지
            if (this.myPlayerId && this.sendStateCallback) {
                const player = this.players.get(this.myPlayerId);
                if (player) {
                    // gameHeight가 0이거나 이상할 경우 안전값(720) 사용
                    const safeHeight = (this.gameHeight > 0) ? this.gameHeight : 720;
                    const groundY = safeHeight - 40;
                    const currentPos = player.getPosition();

                    player.setPosition(currentPos.x, groundY);

                    // 즉시 상태 전송
                    this.sendStateCallback(currentPos.x, groundY, 0, 0, 'idle_down');
                }
            }
        } else {
            // [CHECKPOINT] 중요한 객체들이 살아있는지 확인
            if (!this.scene || !this.cameras || !this.cameras.main) {
                return;
            }

            const cam = this.cameras.main;

            // [CRITICAL FIX] 카메라 좌표가 NaN이면 즉시 0으로 초기화
            if (!Number.isFinite(cam.scrollX) || !Number.isFinite(cam.scrollY)) {
                cam.scrollX = 0;
                cam.scrollY = 0;
            }

            // [SNAP RE-RENDER] 강제 렌더링 리프레시
            this.scale?.refresh();
            this.game?.loop?.wake();
        }
    };

    private resetState(): void {
        // 기존 플레이어 물리 바디 삭제
        this.players.forEach(player => player.destroy());
        this.players.clear();

        // 기존 기믹 삭제
        this.keys.forEach(key => key.destroy());
        this.locks.forEach(lock => lock.destroy());
        this.spikes.forEach(spike => spike.destroy());
        this.goals.forEach(goal => goal.destroy());
        this.springs.forEach(spring => spring.destroy());
        this.elevators.forEach(elevator => elevator.destroy());
        this.movableBlocks.forEach(block => block.destroy());

        this.keys = [];
        this.locks = [];
        this.spikes = [];
        this.goals = [];
        this.springs = [];
        this.elevators = [];
        this.movableBlocks = [];
        // ... (이하 동일하게 bumper 등 정리)
        this.bumpers.forEach(b => b.destroy());
        this.bumpers = [];
        this.movingBumpers.forEach(b => b.destroy());
        this.movingBumpers = [];
        this.supportMap.clear();
        this.pushMapLeft.clear();
        this.pushMapRight.clear();
        this.blockContactLeft.clear();
        this.blockContactRight.clear();
        this.myPlayerId = '';
        this.isDead = false;

        // Matter.js 이벤트 리스너 초기화 (중복 방지)
        this.matter.world.off('collisionstart');
        this.matter.world.off('collisionend');
        this.matter.world.off('collisionactive');
    }

    protected shouldCreateDefaultFloor(): boolean {
        return true;
    }

    private setupPhysics(): void {
        this.gameHeight = this.getWorldHeight();

        // 기존 월드 경계 초기화 (이전 씬의 벽 제거)
        // setBounds를 false로 호출하면 기존 경계 제거
        this.matter.world.setBounds(0, 0, 0, 0);

        // 새 월드 경계 설정 (이 씬의 맵 크기에 맞게)
        this.matter.world.setBounds(0, 0, this.getWorldWidth(), this.gameHeight, 1, true, true, false, true);
        // 파라미터: x, y, width, height, thickness, left, right, top, bottom
        // bottom을 false로 설정하여 별도 바닥 플랫폼 사용

        // 바닥 플랫폼 (별도 생성)
        if (this.shouldCreateDefaultFloor()) {
            const platformHeight = 40;
            this.matter.add.rectangle(
                this.getWorldWidth() / 2,
                this.gameHeight - platformHeight / 2,
                this.getWorldWidth(),
                platformHeight,
                { isStatic: true, label: 'ground' }
            );
        }

        // [추가] 화면 하단 낙사 센서 (death-zone)
        // 맵의 전체 너비를 커버하며, 바닥보다 조금 아래에 배치하여 완전히 떨어졌을 때 발동
        this.matter.add.rectangle(
            this.getWorldWidth() / 2,
            this.gameHeight + 50,
            this.getWorldWidth() * 2, // 넉넉하게 설정
            100,
            {
                isStatic: true,
                isSensor: true,
                label: 'death-zone'
            }
        );
    }

    /**
     * 배경 이미지를 맵 전체 너비에 걸쳐 타일링합니다.
     * 핵심 로직은 utils/SceneHelper.ts로 분리되었습니다.
     * @param textureKey 배경 이미지 키
     * @param scrollFactor 시차 효과 (0: 고정, 1: 맵과 동일 속도)
     */
    protected setupTiledBackground(textureKey: string, scrollFactor: number = 0.5): void {
        setupTiledBg(this, textureKey, this.getWorldWidth(), this.getWorldHeight(), scrollFactor);
    }

    private setupInput(): void {
        this.cursors = this.input.keyboard?.createCursorKeys();
    }

    private setupCamera(): void {
        const worldWidth = this.getWorldWidth();
        this.cameras.main.setBounds(0, 0, worldWidth, this.gameHeight);
        console.log(`[BaseGameScene] Camera setup: Bounds(0, 0, ${worldWidth}, ${this.gameHeight})`);
    }

    private subscribeToStore(): void {
        // 필히 감시해야 할 상태: players 배열 전체 및 본인 nickname
        let prevPlayersJson = JSON.stringify(useGameStore.getState().players);
        let prevNickname = useGameStore.getState().nickname;

        this.storeUnsubscribe = useGameStore.subscribe((state) => {
            const currentPlayersJson = JSON.stringify(state.players);
            const currentNickname = state.nickname;

            // 플레이어 목록이나 닉네임이 변경된 경우만 동기화
            if (currentPlayersJson !== prevPlayersJson || currentNickname !== prevNickname) {
                console.log(`[${this.getSceneKey()}] Store state changed, syncing players...`);
                prevPlayersJson = currentPlayersJson;
                prevNickname = currentNickname;
                this.syncPlayersFromStore();
            }
        });

        console.log(`[${this.getSceneKey()}] Store subscription enabled`);
    }

    // 충돌 처리 설정
    private setupCollisions(): void {
        this.matter.world.on('collisionstart', this.onCollisionStart, this);
        this.matter.world.on('collisionactive', this.onCollisionActive, this);
        this.matter.world.on('collisionend', this.onCollisionEnd, this);
    }

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

            // [추가] 낙사 센서 충돌 체크
            if (labelA === 'death-zone' || labelB === 'death-zone') {
                const playerLabel = this.players.has(labelA) ? labelA : (this.players.has(labelB) ? labelB : null);
                if (playerLabel) {
                    this.triggerDeath('fall');
                }
            }

            // 지지 관계 체크 (엘리베이터 위 또는 플레이어 위)
            if (labelA.startsWith('elevator-') || labelB.startsWith('elevator-') ||
                (this.players.has(labelA) && this.players.has(labelB))) {
                this.handleSupportStart(pair);
            }

            if (labelA === 'bumper' || labelB === 'bumper') {
                this.handleBumperCollision(labelA, labelB);
            }
        });
    }

    private onCollisionActive(event: Phaser.Physics.Matter.Events.CollisionActiveEvent): void {
        event.pairs.forEach((pair) => {
            const labelA = pair.bodyA.label || '';
            const labelB = pair.bodyB.label || '';
            const normal = pair.collision.normal;

            // 플레이어 바닥 접촉 감지 (코요테 타임 리셋)
            if (this.players.has(labelA) && normal.y < -0.5) {
                this.groundedFrames.set(labelA, this.COYOTE_FRAMES);
            }
            if (this.players.has(labelB) && normal.y > 0.5) {
                this.groundedFrames.set(labelB, this.COYOTE_FRAMES);
            }

            // 블록-플레이어 측면 밀기 체크
            if ((labelA.startsWith('block-') && this.players.has(labelB)) ||
                (labelB.startsWith('block-') && this.players.has(labelA))) {
                this.handleBlockPush(pair);
            }

            // 블록-블록 측면 접촉 체크
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

            if (labelA.startsWith('goal-') || labelB.startsWith('goal-')) {
                this.handleGoalExit(labelA, labelB);
            }

            // 지지 관계 종료
            this.handleSupportEnd(labelA, labelB);
        });
    }

    // 지지 관계 시작 처리
    private handleSupportStart(pair: any): void {
        // 충돌 법선(Normal) 체크: 상하 충돌인지 확인
        // normal.y의 절대값이 크면 상하 충돌, normal.x의 절대값이 크면 측면 충돌
        const normal = pair.collision.normal;
        if (Math.abs(normal.y) < 0.5) {
            // 측면 충돌인 경우 무시
            return;
        }

        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // 정규화된 상하 관계 파악 (Y 위치로 판단)
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

    // 지지 관계 종료 처리
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

        const key = this.keys.find(k => k.id === keyId);
        if (key && !key.getIsCollected()) {
            key.collect();
            const lock = this.locks.find(l => l.id === key.linkedLockId);
            if (lock) {
                lock.unlock();

                // Lock이 있던 자리에 Goal 생성
                const pos = lock.getPosition();
                const config = this.getGoalConfig();

                const goal = new Goal(
                    this,
                    pos.x,
                    pos.y,
                    `goal-${lock.id}`,
                    this.getRequiredPlayers(),
                    config.width || 48,
                    config.height || 64,
                    config.texture,
                    config.frame
                );
                this.goals.push(goal);

                console.log(`[${this.getSceneKey()}] Goal spawned at Lock position: ${lock.id}`);
            }
        }
    }

    private handleSpikeCollision(labelA: string, labelB: string): void {
        if (this.isDead) return;

        const playerLabel = labelA.startsWith('spike-') ? labelB : labelA;
        const player = this.players.get(playerLabel);

        if (player) {
            console.log(`[${this.getSceneKey()}] Player hit spike!`);
            this.triggerDeath('spike');
        }
    }

    /**
     * 플레이어 좽음 및 맵 재시작 처리
     * @param reason 좽음 이유 (spike, curse 등)
     */
    private triggerDeath(reason: string): void {
        if (this.isDead) return;

        this.isDead = true;
        console.log(`[${this.getSceneKey()}] Death triggered by ${reason}. Restarting scene...`);

        // 모든 플레이어 정지 및 사망 모션 적용
        this.players.forEach(p => {
            p.setVelocity(0, 0);
            p.die();
        });

        // 0.5초 후 재시작
        this.time.delayedCall(500, () => {
            this.scene.restart();
        });
    }

    private handleBumperCollision(labelA: string, labelB: string): void {
        const playerLabel = this.players.has(labelA) ? labelA : (this.players.has(labelB) ? labelB : null);
        if (!playerLabel) return;

        const player = this.players.get(playerLabel)!;

        // 범퍼 찾기 (위치 기반으로 가장 가까운 것 선택하거나, label 활용)
        // 현재는 모든 범퍼가 'bumper' label을 가짐
        const playerPos = player.getPosition();
        let closestBumper: Bumper | null = null;
        let minDist = Infinity;

        for (const bumper of this.bumpers) {
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

            // 방사형 방향 계산 (범퍼 중심 -> 플레이어 중심)
            let angle = Phaser.Math.Angle.Between(bPos.x, bPos.y, playerPos.x, playerPos.y);

            const forceX = Math.cos(angle) * power;
            const forceY = Math.sin(angle) * power;

            player.applyKnockback(forceX, forceY, 400);
            console.log(`[${this.getSceneKey()}] Player knockback applied: angle=${angle.toFixed(2)}`);
            return;
        }

        // 이동형 범퍼에서도 찾기
        let closestMBumper: MovingBumper | null = null;
        minDist = Infinity;

        for (const mBumper of this.movingBumpers) {
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
            console.log(`[${this.getSceneKey()}] Player moving-knockback applied`);
        }
    }

    private handleGoalEnter(labelA: string, labelB: string): void {
        const playerLabel = labelA.startsWith('goal-') ? labelB : labelA;
        if (this.players.has(playerLabel)) {
            this.goals.forEach(goal => goal.playerNear(playerLabel));
        }
    }

    private handleGoalExit(labelA: string, labelB: string): void {
        const playerLabel = labelA.startsWith('goal-') ? labelB : labelA;
        if (this.players.has(playerLabel)) {
            this.goals.forEach(goal => goal.playerAway(playerLabel));
        }
    }

    private handleSpringCollision(labelA: string, labelB: string): void {
        const springLabel = labelA.startsWith('spring-') ? labelA : labelB;
        const playerLabel = labelA.startsWith('spring-') ? labelB : labelA;
        const springId = springLabel.replace('spring-', '');

        const spring = this.springs.find(s => s.id === springId);
        const player = this.players.get(playerLabel);

        if (spring && player) {
            const velocity = player.getVelocity();
            const playerPos = player.getPosition();
            const springPos = spring.getPosition();

            // [개선] 윗면을 밟았을 때만 작동하도록 조건 추가
            // 1. 플레이어가 아래로 떨어지는 중이어야 함 (velocity.y > 0)
            // 2. 플레이어의 중심이 스프링의 중심보다 위에 있어야 함
            if (velocity.y > 1 && playerPos.y < springPos.y) {
                player.setVelocity(velocity.x, spring.getBouncePower());
                spring.animate();
                console.log(`[${this.getSceneKey()}] Player stepped on spring`);
            }
        }
    }

    // === Authoritative Server 모델 지원 ===
    public setSendStateCallback(callback: (x: number, y: number, vx: number, vy: number, anim: string) => void): void {
        this.sendStateCallback = callback;
    }

    public setIsSoloMode(isSolo: boolean): void {
        this.isSoloMode = isSolo;
    }

    // Store의 players 배열과 동기화
    private syncPlayersFromStore(): void {
        const state = useGameStore.getState();
        const storePlayers = state.players;
        const currentNickname = state.nickname;

        // Store에 있는데 게임에 없는 플레이어 추가 또는 위치 동기화
        // 핵심: nickname을 키로 사용 (서버와 일치)
        storePlayers.forEach((storePlayer, index) => {
            const existingPlayer = this.players.get(storePlayer.nickname);

            // 본인 여부가 바뀌었는지 확인 (닉네임 설정 시점 차이 대응)
            const isLocal = storePlayer.nickname === currentNickname;
            if (existingPlayer && existingPlayer.isLocalPlayer !== isLocal) {
                console.log(`[${this.getSceneKey()}] Player ${storePlayer.nickname} local status changed, recreating...`);
                this.removePlayer(storePlayer.nickname);
            }

            if (!this.players.has(storePlayer.nickname)) {
                // 새 플레이어 추가
                this.addPlayer(storePlayer, index, currentNickname);
            } else {
                // 원격 플레이어 위치 동기화 (서버에서 받은 좌표로 업데이트)
                const player = this.players.get(storePlayer.nickname);
                if (player && storePlayer.x !== undefined && storePlayer.y !== undefined) {
                    const currentPos = player.getPosition();
                    const dx = Math.abs(currentPos.x - storePlayer.x);
                    const dy = Math.abs(currentPos.y - storePlayer.y);

                    if (player.isLocalPlayer) {
                        // 로컬 플레이어: 서버 위치 무시 (Client Authoritative)
                        // 기믹(범퍼 등)에 의한 즉각적인 반응을 위해 로컬 위치를 우선함
                    } else {
                        // 원격 플레이어: 보간 이동 + 방향/애니메이션 동기화
                        const isTeleport = dx > 100 || dy > 100;
                        const serverVx = storePlayer.params?.vx ?? 0;
                        const serverVy = storePlayer.params?.vy ?? 0;
                        const serverAnim = storePlayer.params?.anim;

                        if (isTeleport) {
                            player.setPosition(storePlayer.x, storePlayer.y);
                        }

                        // 항상 상태 업데이트 (위치, 속도, 애니메이션)
                        player.setRemoteState(storePlayer.x, storePlayer.y, serverVx, serverVy, serverAnim);

                        // 방향 및 애니메이션 적용
                        player.applyRemoteDirection();
                        player.applyRemoteAnimation();
                    }
                } else if (!player) {
                    console.warn(`[Scene] Sync failed: Player ${storePlayer.nickname} not found in scene map`);
                }
            }
        });

        // 게임에 있는데 Store에 없는 플레이어 제거
        const storeNicknames = new Set(storePlayers.map(p => p.nickname));
        this.players.forEach((_, playerNickname) => {
            if (!storeNicknames.has(playerNickname)) {
                this.removePlayer(playerNickname);
            }
        });
    }

    private addPlayer(storePlayer: StorePlayer, index: number, currentNickname: string): void {
        const isLocalPlayer = storePlayer.nickname === currentNickname;
        // 서버에서 받은 x, y가 있으면 사용, 없으면 기본 위치
        const xPos = storePlayer.x ?? (100 + (index * 100));
        // Spawn precisely on top of the ground (Ground Top = gameHeight - 40)
        // Player Center Y = Ground Top - Half Size
        const yPos = storePlayer.y ?? (this.gameHeight - 40 - (PHYSICS.PLAYER_SIZE / 2));

        // colorIndex 결정: Store에서 계산된 값(접속 순서) 사용
        // 방장은 항상 0번(초록), 이후 접속자는 순서대로 할당됨
        const colorIndex = storePlayer.colorIndex ?? index;

        const config: PlayerConfig = {
            id: storePlayer.nickname,  // nickname을 id로 사용 (서버와 일치)
            nickname: storePlayer.nickname,
            x: xPos,
            y: yPos,
            colorIndex: colorIndex,
            isLocalPlayer
        };

        console.log(`[${this.getSceneKey()}] Adding player: ${storePlayer.nickname}, isHost: ${storePlayer.isHost}, colorIndex: ${colorIndex}, isLocal: ${isLocalPlayer}`);

        try {
            const player = new Player(this, config);

            // 죽음 콜백 설정 (저주 HP 0 등)
            player.setOnDeathCallback(() => this.triggerDeath('curse'));

            // 저장된 저주가 있다면 복구 (drain 제외)
            const savedCurseId = BaseGameScene.persistentCurses.get(storePlayer.nickname);
            if (savedCurseId) {
                console.log(`[Curse] Restoring saved curse '${savedCurseId}' for ${storePlayer.nickname}`);
                player.applyCurse(savedCurseId);
            }

            // nickname을 키로 저장 (서버와 일치)
            this.players.set(storePlayer.nickname, player);

            if (isLocalPlayer) {
                this.myPlayerId = storePlayer.nickname;
            }
            console.log(`[${this.getSceneKey()}] Player added: ${storePlayer.nickname} at (${xPos.toFixed(0)}, ${yPos.toFixed(0)})`);
        } catch (error) {
            console.warn(`[${this.getSceneKey()}] Failed to add player:`, error);
        }
    }

    private removePlayer(nickname: string): void {
        const player = this.players.get(nickname);
        if (player) {
            player.destroy();
            this.players.delete(nickname);
            BaseGameScene.persistentCurses.delete(nickname);
            console.log(`[${this.getSceneKey()}] Player removed: ${nickname}`);
        }
    }

    update(time: number, delta: number) {
        // [CRITICAL SAFETY] 카메라 좌표 NaN/Infinity 강제 복구 (가장 먼저 실행)
        if (this.cameras.main) {
            if (!Number.isFinite(this.cameras.main.scrollX)) {
                this.cameras.main.scrollX = 0;
            }
            if (!Number.isFinite(this.cameras.main.scrollY)) {
                this.cameras.main.scrollY = 0;
            }
        }

        // [PHYSICS] 수동 업데이트 (탭 복귀 시 대형 Delta로 인한 폭주 방지)
        // Delta 시간을 최대 100ms(0.1초)로 제한
        const clampedDelta = Math.min(delta, 100);
        this.matter.world.step(clampedDelta);


        // 이동형 범퍼 업데이트
        this.movingBumpers.forEach(bumper => bumper.update(time));

        this.players.forEach(player => player.update());

        // 엘리베이터 무게 계산 및 업데이트
        this.elevators.forEach(elevator => {
            const weight = this.calculateTotalWeight(elevator.getBody().label);
            elevator.update(weight);
        });

        // 블록-블록 접촉 수동 감지 (Static 바디끼리는 물리 충돌 안 함)
        this.detectBlockContacts();

        // 블록 체인 평가 및 이동
        const processedBlocks = new Set<string>();
        this.movableBlocks.forEach(block => {
            const label = block.getBody().label;
            if (processedBlocks.has(label)) return;

            const pushLeft = this.pushMapLeft.get(label)?.size || 0;
            const pushRight = this.pushMapRight.get(label)?.size || 0;

            // 밀기 방향 결정 및 체인 처리 (체인 내 모든 블록 업데이트는 tryMoveBlockChain에서 처리)
            const netPush = pushLeft - pushRight;
            if (netPush > 0) {
                this.tryMoveBlockChain(label, 'right', pushLeft, processedBlocks);
            } else if (netPush < 0) {
                this.tryMoveBlockChain(label, 'left', pushRight, processedBlocks);
            } else {
                // 밀기 인원이 없으면 기본 표시
                block.update(0, 0);
            }
        });

        this.updateCamera();
        this.handleLocalPlayerInput();
        this.constrainPlayersToCamera();

        // 다음 프레임을 위해 맵 초기화
        this.pushMapLeft.clear();
        this.pushMapRight.clear();
        this.blockContactLeft.clear();
        this.blockContactRight.clear();
        // 코요테 타임 감소 (매 프레임 1씩 감소)
        this.groundedFrames.forEach((frames, label) => {
            if (frames > 0) {
                this.groundedFrames.set(label, frames - 1);
            }
        });
    }

    // 블록 체인 이동 시도 (weakest link 방식 + 겹침 체크 + 체인 힘 공유)
    private tryMoveBlockChain(startLabel: string, direction: 'left' | 'right', _: number, processedBlocks: Set<string>): void {
        // 1. 연결된 모든 블록 수집 (양방향 탐색 - 밀기 방향과 무관하게 접촉한 모든 블록)
        const chainBlocks: MovableBlock[] = [];
        const chainLabels = new Set<string>();
        const queue = [startLabel];
        const visited = new Set<string>();

        console.log(`[Chain] Starting from ${startLabel}, direction: ${direction}`);
        console.log(`[Chain] blockContactLeft:`, [...this.blockContactLeft.entries()]);
        console.log(`[Chain] blockContactRight:`, [...this.blockContactRight.entries()]);

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            processedBlocks.add(current);
            chainLabels.add(current);

            const block = this.movableBlocks.find(b => b.getBody().label === current);
            if (block) {
                chainBlocks.push(block);

                // 양방향으로 연결된 블록 모두 탐색
                const leftNeighbor = this.blockContactLeft.get(current);
                const rightNeighbor = this.blockContactRight.get(current);

                console.log(`[Chain] ${current} -> left: ${leftNeighbor}, right: ${rightNeighbor}`);

                if (leftNeighbor && !visited.has(leftNeighbor)) {
                    queue.push(leftNeighbor);
                }
                if (rightNeighbor && !visited.has(rightNeighbor)) {
                    queue.push(rightNeighbor);
                }
            }
        }

        console.log(`[Chain] Total blocks in chain: ${chainBlocks.length}`, chainLabels);

        // 2. 체인 전체의 밀기 인원 합산 (방향별 상쇄)
        let totalLeftPushers = 0;
        let totalRightPushers = 0;
        chainBlocks.forEach(block => {
            const label = block.getBody().label;
            totalLeftPushers += this.pushMapLeft.get(label)?.size || 0;
            totalRightPushers += this.pushMapRight.get(label)?.size || 0;
        });

        // 방향에 따른 유효 밀기 인원 계산 (힘겨루기 상쇄)
        const effectivePushers = direction === 'right'
            ? totalLeftPushers - totalRightPushers
            : totalRightPushers - totalLeftPushers;

        // 3. 체인 내 모든 블록에 공유된 밀기 인원 표시
        chainBlocks.forEach(block => {
            if (direction === 'right') {
                block.update(Math.max(0, effectivePushers), 0);
            } else {
                block.update(0, Math.max(0, effectivePushers));
            }
        });

        // 4. 유효 인원이 0 이하면 이동 불가 (상쇄됨)
        if (effectivePushers <= 0) return;

        // 5. 체인 내 모든 블록이 조건 충족하는지 확인
        const canMove = chainBlocks.every(block => effectivePushers >= block.getRequiredPlayers());

        // 6. 이동 후 다른 블록과 겹치는지 AABB 체크
        const moveAmount = direction === 'right' ? 2 : -2;
        const canMoveWithoutOverlap = chainBlocks.every(block => {
            const nextX = block.getPosition().x + moveAmount;
            return !this.wouldOverlapOtherBlock(block, nextX, chainLabels);
        });

        // 7. 모두 충족하면 전체 이동 (블록 + 미는 플레이어들 동시 이동으로 진동 방지)
        if (canMove && canMoveWithoutOverlap && chainBlocks.length > 0) {
            chainBlocks.forEach(block => {
                const label = block.getBody().label;

                // 블록 이동
                if (direction === 'right') {
                    block.moveRight();
                } else {
                    block.moveLeft();
                }

                // 해당 블록을 미는 플레이어들도 같은 양만큼 함께 이동 (물리 충돌 튕김 방지)
                const pushers = direction === 'right'
                    ? this.pushMapLeft.get(label)
                    : this.pushMapRight.get(label);

                if (pushers) {
                    pushers.forEach(playerId => {
                        const player = this.players.get(playerId);
                        if (player) {
                            const pos = player.getPosition();
                            // 플레이어 위치를 블록 가속과 완전히 동기화
                            player.setPosition(pos.x + moveAmount, pos.y);
                        }
                    });
                }
            });
        }
    }

    // AABB 겹침 체크 (체인 외부 블록과의 충돌 확인)
    private wouldOverlapOtherBlock(movingBlock: MovableBlock, nextX: number, excludeLabels: Set<string>): boolean {
        const movingBounds = movingBlock.getBounds();
        const nextBounds = {
            left: nextX - movingBlock.getWidth() / 2,
            right: nextX + movingBlock.getWidth() / 2,
            top: movingBounds.top,
            bottom: movingBounds.bottom
        };

        for (const otherBlock of this.movableBlocks) {
            const otherLabel = otherBlock.getBody().label;
            if (excludeLabels.has(otherLabel)) continue; // 같은 체인은 제외
            if (otherBlock === movingBlock) continue;

            const otherBounds = otherBlock.getBounds();

            // AABB 겹침 체크
            const overlapsX = nextBounds.left < otherBounds.right && nextBounds.right > otherBounds.left;
            const overlapsY = nextBounds.top < otherBounds.bottom && nextBounds.bottom > otherBounds.top;

            if (overlapsX && overlapsY) {
                return true; // 겹침 발생
            }
        }
        return false; // 겹침 없음
    }

    // 블록-블록 접촉 수동 감지 (Static 바디끼리는 물리 충돌 안 함)
    private detectBlockContacts(): void {
        // 모든 블록 쌍에 대해 접촉 여부 확인
        for (let i = 0; i < this.movableBlocks.length; i++) {
            for (let j = i + 1; j < this.movableBlocks.length; j++) {
                const blockA = this.movableBlocks[i];
                const blockB = this.movableBlocks[j];

                const boundsA = blockA.getBounds();
                const boundsB = blockB.getBounds();

                // 세로 방향 겹침 확인
                const overlapsY = boundsA.top < boundsB.bottom && boundsA.bottom > boundsB.top;
                if (!overlapsY) continue;

                // 가로 방향 접촉 확인 (5px 이내)
                const tolerance = 5;
                const gapX = Math.max(boundsA.left, boundsB.left) - Math.min(boundsA.right, boundsB.right);

                if (gapX <= tolerance) {
                    const labelA = blockA.getBody().label;
                    const labelB = blockB.getBody().label;
                    const posA = blockA.getPosition();
                    const posB = blockB.getPosition();

                    // A가 B의 왼쪽에 있음
                    if (posA.x < posB.x) {
                        this.blockContactRight.set(labelA, labelB);
                        this.blockContactLeft.set(labelB, labelA);
                    } else {
                        this.blockContactLeft.set(labelA, labelB);
                        this.blockContactRight.set(labelB, labelA);
                    }
                }
            }
        }
    }


    // 재귀적으로 위에 있는 모든 플레이어 수 계산 (Support Chain)
    private calculateTotalWeight(bottomLabel: string): number {
        const visited = new Set<string>();
        const playersFound = new Set<string>();
        const queue = [bottomLabel];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const supported = this.supportMap.get(current);
            if (supported) {
                supported.forEach(topLabel => {
                    if (this.players.has(topLabel)) {
                        playersFound.add(topLabel);
                    }
                    queue.push(topLabel); // 다음 층 플레이어도 체크
                });
            }
        }

        return playersFound.size;
    }

    // 블록 밀기 처리 (측면 충돌 + 키 입력 체크)
    private handleBlockPush(pair: any): void {
        const normal = pair.collision.normal;
        const labelA = pair.bodyA.label || '';
        const labelB = pair.bodyB.label || '';

        // 블록-플레이어 충돌인지 확인
        const isBlockA = labelA.startsWith('block-');
        const isBlockB = labelB.startsWith('block-');
        const isPlayerA = this.players.has(labelA);
        const isPlayerB = this.players.has(labelB);

        if (!(isBlockA && isPlayerB) && !(isBlockB && isPlayerA)) {
            return;
        }

        // 측면 충돌 체크
        if (Math.abs(normal.x) < 0.3) {
            return;
        }

        // 블록과 플레이어 식별
        const blockBody = isBlockA ? pair.bodyA : pair.bodyB;
        const blockLabel = isBlockA ? labelA : labelB;
        const playerLabel = isBlockA ? labelB : labelA;

        const player = this.players.get(playerLabel);
        if (!player) return;

        const playerPos = player.getPosition();
        const blockPos = blockBody.position;

        // 키 입력 확인 (velocity는 블록에 막혀서 0이 되므로 키 입력 체크)
        const isPressingRight = this.cursors?.right?.isDown ?? false;
        const isPressingLeft = this.cursors?.left?.isDown ?? false;

        // 플레이어가 블록의 왼쪽에 있고 오른쪽 키를 누르는 중
        if (playerPos.x < blockPos.x && isPressingRight) {
            if (!this.pushMapLeft.has(blockLabel)) {
                this.pushMapLeft.set(blockLabel, new Set());
            }
            this.pushMapLeft.get(blockLabel)!.add(playerLabel);
        }
        // 플레이어가 블록의 오른쪽에 있고 왼쪽 키를 누르는 중
        else if (playerPos.x > blockPos.x && isPressingLeft) {
            if (!this.pushMapRight.has(blockLabel)) {
                this.pushMapRight.set(blockLabel, new Set());
            }
            this.pushMapRight.get(blockLabel)!.add(playerLabel);
        }
    }

    private handleLocalPlayerInput(): void {
        if (this.isDead) return;

        const myPlayer = this.players.get(this.myPlayerId);
        if (!myPlayer || !this.cursors || myPlayer.isStunned) return;

        // 반전 저주 상태 확인
        const isReversed = myPlayer.isControlReversed;
        const leftKey = isReversed ? this.cursors.right : this.cursors.left;
        const rightKey = isReversed ? this.cursors.left : this.cursors.right;
        const jumpKey = isReversed ? this.cursors.down : this.cursors.up;

        // === 1. 상태 전송 (멀티플레이용, 50ms 간격) ===
        if (this.sendStateCallback && !this.isSoloMode) {
            const now = this.time.now;
            if (now - this.lastStateSendTime > this.STATE_SEND_INTERVAL) {
                const { x, y } = myPlayer.getPosition(); // Fixed: getBodyPosition -> getPosition
                const velocity = myPlayer.getVelocity();

                // 현재 애니메이션 상태 계산 (속도 기반)
                // vy > 1: 공중(점프/낙하), vx 이동 중: 걷기, 그 외: 대기
                let currentAnim = 'idle';
                if (Math.abs(velocity.y) > 1) {
                    currentAnim = 'jump';
                } else if (Math.abs(velocity.x) > 0.5) {
                    currentAnim = 'walk';
                }

                this.sendStateCallback(x, y, velocity.x, velocity.y, currentAnim);
                this.lastStateSendTime = now;
            }
        }

        // === 2. 로컬 물리 연산 (Client Authoritative) ===
        // 항상 로컬 입력에 따라 물리 연산 수행
        const velocity = myPlayer.getVelocity();
        let moveSpeed = PHYSICS.MOVE_SPEED * myPlayer.getSpeedMultiplier();

        // [추가] 로컬 플레이어가 현재 블록을 밀고 있는지 확인
        // 밀고 있다면 속도를 블록의 이동 속도(1px)로 낮춤
        let isPushing = false;
        this.pushMapLeft.forEach((pushers) => {
            if (pushers.has(this.myPlayerId)) isPushing = true;
        });
        this.pushMapRight.forEach((pushers) => {
            if (pushers.has(this.myPlayerId)) isPushing = true;
        });

        if (isPushing) {
            moveSpeed = 2; // 블록 이동 속도(2px)와 동기화
        }

        // 좌우 이동
        if (!myPlayer.isHidden) {
            if (leftKey.isDown) {
                myPlayer.setVelocity(-moveSpeed, velocity.y);
            } else if (rightKey.isDown) {
                myPlayer.setVelocity(moveSpeed, velocity.y);
            } else {
                myPlayer.setVelocity(0, velocity.y);
            }
        }

        // 점프/Goal
        if (Phaser.Input.Keyboard.JustDown(jumpKey)) {
            const playerLabel = myPlayer.getBodyLabel();

            if (myPlayer.isHidden) {
                // Goal 탈출
                for (const goal of this.goals) {
                    if (goal.isPlayerEntered(playerLabel)) {
                        goal.exitGoal(playerLabel);
                        myPlayer.show();
                        break;
                    }
                }
            } else {
                // Goal 입장 또는 점프
                let enteredGoal = false;
                for (const goal of this.goals) {
                    if (goal.isPlayerNear(playerLabel)) {
                        // 저주 상태 체크: 저주가 있으면 입장 불가
                        if (myPlayer.hasCurse()) {
                            this.showFloatingText(myPlayer.getPosition().x, myPlayer.getPosition().y - 40, "저주를 먼저 해제하세요!", 0xff4444);
                            console.log(`[Goal] Entry denied for ${this.myPlayerId} due to curse.`);
                            enteredGoal = true; // 실제 입장은 아니나 중복 점프 방지용
                            break;
                        }

                        if (goal.enterGoal(playerLabel)) {
                            myPlayer.hide();
                            enteredGoal = true;

                            if (goal.isComplete()) {
                                console.log(`[${this.getSceneKey()}] 🎉 Stage Complete!`);
                                this.onStageComplete();
                            }
                            break;
                        }
                    }
                }

                const currentFrames = this.groundedFrames.get(playerLabel) || 0;
                if (!enteredGoal && currentFrames > 0) {
                    myPlayer.setVelocity(velocity.x, PHYSICS.JUMP_POWER);
                    this.groundedFrames.set(playerLabel, 0);  // 더블 점프 방지
                }
            }
        }

        // 숫자 1 키: 저주 해제 (임시 - 추후 긍정적 행동으로 대체)
        if (this.input.keyboard && Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('ONE'))) {
            if (myPlayer && myPlayer.hasCurse()) {
                myPlayer.removeCurse();
                BaseGameScene.persistentCurses.delete(this.myPlayerId);
            }
        }

        // 숫자 2 키: 랜덤 저주 적용 (테스트용 - 추후 부정적 언어 감지로 대체)
        if (this.input.keyboard && Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('TWO'))) {
            if (myPlayer && !myPlayer.hasCurse()) {
                const randomCurse = getRandomCurseId();
                console.log(`[Curse] Applying random curse: ${randomCurse}`);
                myPlayer.applyCurse(randomCurse);

                // Persistence (except drain)
                if (randomCurse !== 'drain') {
                    BaseGameScene.persistentCurses.set(this.myPlayerId, randomCurse);
                }
            }
        }
    }


    // 스테이지 클리어 시 호출 - 서브클래스에서 오버라이드 가능
    protected onStageComplete(): void {
        // 기본 구현: 콘솔 로그만
    }

    /**
     * 특정 플레이어에게 저주 적용 (외부에서 호출용)
     * @param playerId 플레이어 ID (없으면 랜덤)
     * @param curseId 저주 ID
     */
    public applyCurseToPlayer(playerId: string | null, curseId: string): void {
        let targetPlayer;

        if (playerId) {
            targetPlayer = this.players.get(playerId);
        } else {
            // 랜덤 플레이어 선택
            const playerArray = Array.from(this.players.values());
            if (playerArray.length === 0) return;
            targetPlayer = playerArray[Math.floor(Math.random() * playerArray.length)];
        }

        if (targetPlayer) {
            targetPlayer.applyCurse(curseId);
            // Persistence (except drain)
            if (curseId !== 'drain') {
                BaseGameScene.persistentCurses.set(targetPlayer.id, curseId);
            }
        }
    }

    /**
     * 로컬 플레이어에게 저주 적용 (테스트용)
     */
    public applyCurseToLocalPlayer(curseId: string): void {
        const myPlayer = this.players.get(this.myPlayerId);
        if (myPlayer) {
            myPlayer.applyCurse(curseId);
            // Persistence (except drain)
            if (curseId !== 'drain') {
                BaseGameScene.persistentCurses.set(this.myPlayerId, curseId);
            }
        }
    }


    private updateCamera(): void {
        const positions = Array.from(this.players.values())
            .filter(p => !p.isHidden)
            .map(p => p.getPosition());

        // [SAFETY] 유효하지 않은 좌표(NaN 또는 Infinity)가 있으면 카메라 업데이트 중단
        // console.warn 남발 방지: 1초에 한 번만 로그
        const isInvalidPos = positions.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y));
        if (isInvalidPos) {
            const now = Date.now();
            if (now - this.lastErrorLogTime > 1000) {
                console.warn('[Camera] Invalid player position (NaN/Infinity) detected! skipping update.');
                this.lastErrorLogTime = now;
            }
            return;
        }

        if (positions.length === 0) return;

        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));
        const centerX = (minX + maxX) / 2;

        // [SAFETY] centerX가 유효한지 확인
        if (!Number.isFinite(centerX)) {
            return;
        }

        const newScrollX = Phaser.Math.Linear(
            this.cameras.main.scrollX,
            centerX - this.cameras.main.width / 2,
            0.1
        );

        // [SAFETY] 최종 카메라 위치가 유효한지 확인 (NaN/Infinity 체크)
        if (!Number.isFinite(newScrollX)) {
            const now = Date.now();
            if (now - this.lastErrorLogTime > 1000) {
                console.warn(`[Camera] ScrollX calculation failed! linear result: ${newScrollX}, current: ${this.cameras.main.scrollX}, target: ${centerX}`);
                this.lastErrorLogTime = now;
            }
            // 안전한 값으로 강제 리셋 (플레이어 위치 혹은 0)
            if (Number.isFinite(centerX)) {
                this.cameras.main.scrollX = centerX - this.cameras.main.width / 2;
            } else {
                this.cameras.main.scrollX = 0;
            }
        } else {
            this.cameras.main.scrollX = newScrollX;
        }

        // 월드 바운드 클램핑
        const maxScrollX = Math.max(0, this.getWorldWidth() - this.cameras.main.width);
        this.cameras.main.scrollX = Phaser.Math.Clamp(
            this.cameras.main.scrollX,
            0,
            maxScrollX
        );
    }

    /**
     * 화면에 떠오르는 텍스트 피드백을 표시합니다.
     * 핵심 로직은 utils/UIHelper.ts로 분리되었습니다.
     */
    protected showFloatingText(x: number, y: number, message: string, color: number = 0xffffff): void {
        showFloatingText(this, x, y, message, color);
    }

    private constrainPlayersToCamera(): void {
        const camLeft = this.cameras.main.scrollX;
        const camRight = camLeft + this.cameras.main.width;

        this.players.forEach(player => {
            if (player.isHidden) return;
            const pos = player.getPosition();
            if (pos.x < camLeft + 16) {
                player.setPosition(camLeft + 16, pos.y);
            }
            if (pos.x > camRight - 16) {
                player.setPosition(camRight - 16, pos.y);
            }
        });
    }

    shutdown() {
        console.log(`[${this.getSceneKey()}] Shutdown triggered, cleaning up...`);

        try {
            // 스토어 구독 해제
            if (this.storeUnsubscribe) {
                this.storeUnsubscribe();
                this.storeUnsubscribe = undefined;
            }

            // 플레이어 객체 파괴 (물리 바디 및 그래픽 포함)
            this.players.forEach(player => player.destroy());
            this.players.clear();

            // 기믹 객체 파괴
            this.keys.forEach(key => key.destroy());
            this.locks.forEach(lock => lock.destroy());
            this.spikes.forEach(spike => spike.destroy());
            this.goals.forEach(goal => goal.destroy());
            this.springs.forEach(spring => spring.destroy());
            this.elevators.forEach(elevator => elevator.destroy());
            this.movableBlocks.forEach(block => block.destroy());
            this.bumpers.forEach(b => b.destroy());
            this.movingBumpers.forEach(b => b.destroy());

            this.keys = [];
            this.locks = [];
            this.spikes = [];
            this.goals = [];
            this.springs = [];
            this.elevators = [];
            this.movableBlocks = [];
            this.bumpers = [];
            this.movingBumpers = [];

            this.supportMap.clear();
            this.pushMapLeft.clear();
            this.pushMapRight.clear();
            this.blockContactLeft.clear();
            this.blockContactRight.clear();
            this.groundedFrames.clear();

            // 물리 이벤트 리스너 제거 (본인이 등록한 것만 특정하여 제거)
            if (this.matter && this.matter.world) {
                this.matter.world.off('collisionstart', this.onCollisionStart, this);
                this.matter.world.off('collisionactive', this.onCollisionActive, this);
                this.matter.world.off('collisionend', this.onCollisionEnd, this);
            }

            // 등록된 이벤트 제거 (본인)
            this.events.off('shutdown', this.shutdown, this);
            this.events.off('destroy', this.shutdown, this);

        } catch (error) {
            console.error(`[${this.getSceneKey()}] Error during shutdown:`, error);
        }
    }
}
