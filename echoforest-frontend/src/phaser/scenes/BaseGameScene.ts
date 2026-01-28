import Phaser from 'phaser';
import { useGameStore } from '../../store/useGameStore';
import { Player } from '../entities/Player';
import type { PlayerConfig } from '../entities/Player';
import type { Player as StorePlayer } from '../../store/useGameStore';
import { Key, Lock, Spike, Goal, Spring, Elevator, MovableBlock, Bumper, MovingBumper, PoisonMushroom, BlockButton, TogglePlatform, TriggerButton, Signboard, GhostPlatform, Respawn } from '../gimmicks';
import { getRandomCurseId } from '../config/curseConfig';
import { createPlayerAnimations, preloadPlayerAssets, parseTiledMap, showFloatingText, setupTiledBackground as setupTiledBg } from '../utils';
import { gameWebSocket } from '../../socket/GameWebSocket';
import type { GameMessage } from '../../socket/GameWebSocket';
// CollisionSystem은 향후 통합 시 사용 예정
// import { CollisionSystem } from '../systems';


// 물리 파라미터
export const PHYSICS = {
    MOVE_SPEED: 6,
    JUMP_POWER: -11,
    PLAYER_SIZE: 60
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
    public keys: Key[] = [];
    public locks: Lock[] = [];
    public spikes: Spike[] = [];
    public goals: Goal[] = [];
    public springs: Spring[] = [];
    public elevators: Elevator[] = [];
    public movableBlocks: MovableBlock[] = [];
    public bumpers: Bumper[] = [];
    public movingBumpers: MovingBumper[] = [];
    public poisonMushrooms: PoisonMushroom[] = [];
    public blockButtons: BlockButton[] = [];
    public togglePlatforms: TogglePlatform[] = [];
    public triggerButtons: TriggerButton[] = [];
    public signboards: Signboard[] = [];
    public ghostPlatforms: GhostPlatform[] = [];
    private activeSignboard: Signboard | null = null;
    private popupContainer: Phaser.GameObjects.Container | null = null;

    // React로부터 전달받는 콜백 함수들
    public onFailCallback?: () => void;
    public onSuccessCallback?: () => void;
    // [FIX] 상태 전송 콜백 시그니처 변경 (isDead, curses 추가)
    public sendStateCallback?: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden?: boolean) => void;
    public updateReadyStatusCallback?: (isReady: boolean) => void;

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

    // 스폰 위치 및 맵 오프셋 (Tiled 등에서 설정 가능)
    protected spawnPoint: { x: number; y: number } | null = null;
    public spawnPoints: Respawn[] = [];
    protected offsetY: number = 0;

    // 플레이어 상태
    protected isDead: boolean = false;

    // 저주 지속성 관리 (playerId -> curseId)
    // drain 저주는 제외하고 매 세션(씬 재시작)마다 유지됩니다.
    private static persistentCurses: Map<string, string> = new Map();

    // ===== Authoritative Server 모델용 =====


    // 상태 전송 쓰로틀링 (50ms마다 전송 = 20 TPS)
    private lastStateSendTime: number = 0;
    // 에러 로그 쓰로틀링 (1초마다)
    private lastErrorLogTime: number = 0;
    private readonly STATE_SEND_INTERVAL: number = 33;
    private lastGimmickUpdateTime: number = 0;
    private lastBlockUpdateTime: number = 0;
    private readonly SYNC_INTERVAL: number = 50; // 20 TPS

    // 초기 배치 여부 (씬 시작/재시작 시 스폰 지점 강제 적용용)
    private isInitialPlacement: boolean = true;
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
        return { texture: 'tiles_tileset', frame: 121, width: 48, height: 64 }; // 기본값 (깃발)
    }

    /**
     * 자물쇠가 열릴 때 해당 위치에 Goal을 자동으로 생성할지 여부
     * Solo1, Solo2 등 기존 씬의 하위 호환성을 위해 사용
     */
    protected shouldSpawnGoalOnUnlock(): boolean {
        return false;
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

            // 소켓 리스너 등록
            this.setupSocketListeners();

            // 배경색 설정 (HEAD)
            // 맵이 안 보일 때 대비
            this.cameras.main.setBackgroundColor('#2d2d2d');

            // 탭 전환/최소화 시 안전장치 (HEAD)
            // 중복 리스너 방지를 위해 기존 것 제거 후 추가
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
            document.addEventListener('visibilitychange', this.handleVisibilityChange);

            // 씬 중지/삭제 시 클린업 등록
            // shutdown()에서 리스너 제거 및 자원 해제를 담당함
            this.events.off('shutdown', this.shutdown, this); // 중복 등록 방지
            this.events.off('destroy', this.shutdown, this);

            this.events.on('shutdown', this.shutdown, this);
            this.events.on('destroy', this.shutdown, this);

            // [LIFECYCLE] Scene Created Log
            console.log(`[LIFECYCLE] ${this.getSceneKey()} Created`);
        } catch (e) {
            console.error(`[CRITICAL] Error in ${this.getSceneKey()} create():`, e);
        }
    }



    // [CRITICAL FIX] Visibility Change 핸들러 분리 w/ Null Check
    // [CRITICAL FIX] Visibility Change 핸들러 분리 w/ Null Check
    private handleVisibilityChange = () => {
        if (document.hidden) {
            console.log(`[VISIBILITY] State: hidden, Scene: ${this.getSceneKey()}`);
            // 물리 엔진 일시정지 (탭 전환 시 추락 방지)
            this.matter.world.pause();

            // [SNAP] 화면이 숨겨졌을 때: 공중 부양 방지를 위해 바닥으로 강제 착지
            if (this.myPlayerId && this.sendStateCallback) {
                const player = this.players.get(this.myPlayerId);
                if (player) {
                    const currentPos = player.getPosition();

                    // 강제 착지 (y값 보정) - 잘못된 위치로 이동할 수 있으므로 제거
                    // player.setPosition(currentPos.x, groundY);
                    player.setVelocity(0, 0); // 속도 정지

                    // 즉시 상태 전송 (위치 변경 없이 속도만 0으로)
                    // [FIX] 저주 및 사망 상태 포함
                    const curses = player.currentCurses;
                    this.sendStateCallback(currentPos.x, currentPos.y, 0, 0, 'idle_down', player.isDead, curses, player.isHidden);
                }
            }
        } else {
            console.log(`[VISIBILITY] State: visible, Scene: ${this.getSceneKey()}`);

            // [CHECKPOINT] 화면 복귀 시
            if (!this.scene || !this.cameras || !this.cameras.main) {
                return;
            }

            // 물리 엔진 재개
            this.matter.world.resume();

            if (this.game?.loop) {
                this.game.loop.wake();
            }

            const cam = this.cameras.main;

            // 1. 카메라 좌표 안전장치
            // 1. 카메라 좌표 복구
            this.updateCamera();
            cam.dirty = true;

            // 2. 모든 플레이어 스프라이트 완전 재생성 (Hard Reset)
            this.players.forEach((player) => {
                // 물리 엔진 재개 후 튀는 현상 방지를 위해 속도 리셋
                player.setVelocity(0, 0);

                player.hardResetVisuals();

                // 재생성된 스프라이트 위치 동기화
                const pos = player.getPosition();
                const sprite = player.getSprite();
                if (sprite) {
                    sprite.setPosition(pos.x, pos.y);
                }

                if (player.isLocalPlayer) {
                    console.log(`[VISIBILITY] Restored Local Player: ${player.nickname}`);
                }
            });

            // 3. 디버그 그래픽 재생성 (디버그 모드일 경우)
            if (this.matter.world.drawDebug) {
                console.log('[VISIBILITY] Re-creating debug graphic...');
                this.matter.world.createDebugGraphic();
            }

            // 4. 강제 렌더링 리프레시
            this.scale?.refresh();
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
        this.poisonMushrooms.forEach(mushroom => mushroom.destroy());
        this.blockButtons.forEach(btn => btn.destroy());
        this.togglePlatforms.forEach(tp => tp.destroy());
        this.triggerButtons.forEach(tb => tb.destroy());
        this.signboards.forEach(sb => sb.destroy());
        this.ghostPlatforms.forEach(gp => gp.destroy());
        this.hideMessagePopup();

        this.keys = [];
        this.locks = [];
        this.spikes = [];
        this.goals = [];
        this.springs = [];
        this.elevators = [];
        this.movableBlocks = [];
        this.poisonMushrooms = [];
        this.blockButtons = [];
        this.togglePlatforms = [];
        this.triggerButtons = [];
        this.signboards = [];
        this.ghostPlatforms = [];
        this.activeSignboard = null;
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
        this.isInitialPlacement = true; // 재시작 시 초기 배치 모드 활성화
        this.spawnPoints = [];
        this.spawnPoint = null;

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

        // [CRITICAL FIX] 자동 업데이트 비활성화 (탭 전환 시 대형 Delta로 인한 물리 폭주 방지)
        // update() 메서드에서 수동으로 step(clampedDelta)를 호출하여 제어함
        this.matter.world.autoUpdate = false;

        // 새 월드 경계 설정 (이 씬의 맵 크기에 맞게)
        this.matter.world.setBounds(0, 0, this.getWorldWidth(), this.gameHeight, 1, true, true, false, true);
        // 파라미터: x, y, width, height, thickness, left, right, top, bottom
        // bottom을 false로 설정하여 별도 바닥 플랫폼 사용

        // [DEBUG] 물리 바디 시각화 (디버깅용) - 배포 시 false로 변경
        this.matter.world.createDebugGraphic();
        this.matter.world.drawDebug = false;

        // 바닥 플랫폼 (별도 생성)
        if (this.shouldCreateDefaultFloor()) {
            const platformHeight = 40;
            this.matter.add.rectangle(
                this.getWorldWidth() / 2,
                this.gameHeight - platformHeight / 2,
                this.getWorldWidth(),
                platformHeight,
                { isStatic: true, label: 'ground', friction: 0, frictionStatic: 0 }
            );
        }

        // [추가] 화면 하단 낙사 센서 (death-zone)
        // 맵의 전체 너비를 커버하며, 바닥 경계선에 배치하여 닿는 즉시 발동
        this.matter.add.rectangle(
            this.getWorldWidth() / 2,
            this.gameHeight + 50, // 센서 높이 100의 절반
            this.getWorldWidth() * 4, // 넉넉하게 설정
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
    /**
     * 배경 이미지를 맵 전체 너비에 걸쳐 타일링합니다.
     * 핵심 로직은 utils/SceneHelper.ts로 분리되었습니다.
     * @param textureKey 배경 이미지 키
     * @param scrollFactor 시차 효과 (0: 고정, 1: 맵과 동일 속도)
     */
    public setupTiledBackground(textureKey: string, scrollFactor: number = 0.5): void {
        setupTiledBg(this, textureKey, this.getWorldWidth(), this.getWorldHeight(), scrollFactor);
    }

    private setupInput(): void {
        this.cursors = this.input.keyboard?.createCursorKeys();
    }

    protected setupCamera(): void {
        const worldWidth = this.getWorldWidth();
        const worldHeight = this.getWorldHeight();
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
        // 시작 시 하단으로 스크롤 고정
        this.cameras.main.scrollY = Math.max(0, worldHeight - this.cameras.main.height);
        console.log(`[BaseGameScene] Camera setup: Bounds(0, 0, ${worldWidth}, ${worldHeight}), ScrollY: ${this.cameras.main.scrollY}`);
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
                //console.log(`[${this.getSceneKey()}] Store state changed, syncing players...`);
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

            // 지지 관계 체크 (엘리베이터 위 또는 플레이어 위, 또는 일반 블록 위)
            // [FIX] 플레이어가 포함된 모든 충돌에 대해 지지 관계 가능성 체크
            if (this.players.has(labelA) || this.players.has(labelB)) {
                this.handleSupportStart(pair);
            }

            // Bumper collision handling
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

            // 플레이어 바닥 접촉 감지 (코요테 타임 리셋)
            // [FIX] 상대방이 센서인 경우 바닥으로 간주하지 않음
            if (this.players.has(labelA) && normal.y < -0.5 && !isSensorB) {
                this.groundedFrames.set(labelA, this.COYOTE_FRAMES);
            }
            if (this.players.has(labelB) && normal.y > 0.5 && !isSensorA) {
                this.groundedFrames.set(labelB, this.COYOTE_FRAMES);
            }

            // 블록-플레이어 측면 밀기 체크
            if ((labelA.startsWith('block-') && this.players.has(labelB)) ||
                (labelB.startsWith('block-') && this.players.has(labelA))) {
                this.handleBlockPush(pair);
            }

            // [FIX] Active 상태에서도 지지 관계 지속 업데이트 (원격 플레이어 감지 강화)
            if (this.players.has(labelA) || this.players.has(labelB)) {
                this.handleSupportStart(pair);
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

            if (labelA.startsWith('signboard-') || labelB.startsWith('signboard-')) {
                this.handleSignboardOverlap(labelA, labelB, false);
            }

            if (labelA.startsWith('ghost-platform-') || labelB.startsWith('ghost-platform-')) {
                this.handleGhostPlatformOverlap(labelA, labelB, false);
            }

            if (labelA.startsWith('goal-') || labelB.startsWith('goal-')) {
                this.handleGoalExit(labelA, labelB);
            }

            // 지지 관계 종료
            this.handleSupportEnd(labelA, labelB);
        });
    }

    // 지지 관계 시작 처리
    // 지지 관계 시작 처리
    private handleSupportStart(pair: any): void {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // 정규화된 상하 관계 파악 (Y 위치로 판단)
        let top = bodyA;
        let bottom = bodyB;

        if (bodyA.position.y > bodyB.position.y) {
            top = bodyB;
            bottom = bodyA;
        }

        // [Improvement] 법선(Normal) 체크 대신 위치 차이로 상하 관계 확실히 결정
        // Y 좌표 차이가 일정 이상 나야 위/아래로 인정 (너무 겹치거나 옆에 있는 경우 제외)
        // 충돌 박스 높이를 고려하면 좋지만, 우선 간단하게 중심점 기준으로 판단
        const dy = Math.abs(bodyA.position.y - bodyB.position.y);
        if (dy < 10) { // 너무 같은 높이면 측면 충돌일 가능성 높음
            return;
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

            // 연결된 모든 자물쇠 열기 (filter 사용)
            const targetLocks = this.locks.filter(l => l.id === key.linkedLockId);

            targetLocks.forEach(lock => {
                if (lock.getIsUnlocked()) return;

                lock.unlock();

                if (lock.targetGoalId !== undefined) {
                    // Tiled의 targetGoalId 속성값이 일치하는 모든 Goal 활성화
                    const targetGoals = this.goals.filter(g => g.targetGoalId === lock.targetGoalId);

                    if (targetGoals.length > 0) {
                        targetGoals.forEach(targetGoal => {
                            targetGoal.setVisible(true);
                            console.log(`[${this.getSceneKey()}] Goal activated (Prop targetGoalId: ${lock.targetGoalId}) via Lock: ${lock.id}`);
                        });
                    } else {
                        console.warn(`[${this.getSceneKey()}] No goals found with targetGoalId: ${lock.targetGoalId}`);
                    }
                } else if (this.shouldSpawnGoalOnUnlock()) {
                    // 하위 호환성: Lock이 있던 자리에 Goal 생성
                    const fallbackGoalId = `goal-lock-${lock.id}`;
                    const existingGoal = this.goals.find(g => g.id === fallbackGoalId);

                    if (!existingGoal) {
                        const pos = lock.getPosition();
                        const config = this.getGoalConfig();

                        const goal = new Goal(
                            this,
                            pos.x,
                            pos.y,
                            fallbackGoalId,
                            this.getRequiredPlayers(),
                            config.width || 48,
                            config.height || 64,
                            config.texture,
                            config.frame
                        );
                        goal.setVisible(true); // 명시적으로 보이게 설정
                        this.goals.push(goal);
                        console.log(`[${this.getSceneKey()}] Goal spawned at Lock position: ${lock.id}`);
                    }
                }
            });
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

        console.log(`[${this.getSceneKey()}] Death triggered by ${reason}.`);
        this.isDead = true; // [FIX] 즉시 isDead 설정

        // 로컬 플레이어 사망 애니메이션 재생
        const myPlayer = this.players.get(this.myPlayerId);
        if (myPlayer) {
            myPlayer.die(); // _isDead = true 설정 및 속도 0
        }

        console.log(`[BaseGameScene] Waiting 1000ms for death animation before Global Reset...`);
        this.time.delayedCall(1000, () => {
            const roomId = useGameStore.getState().roomId;
            if (roomId) {
                console.log(`[BaseGameScene] Sending GAME_RESET for room ${roomId}`);
                gameWebSocket.sendGameReset(roomId);
            } else {
                console.error('[BaseGameScene] Cannot send GAME_RESET: No roomId found');
            }
        });
    }

    /**
     * 전체 게임 리셋 (서버 요청 수신 시 실행)
     */
    private resetGame(): void {
        if (this.isDead) { // 이미 죽음 처리가 진행 중이었다면 해제
            this.isDead = false;
        }

        console.log(`[${this.getSceneKey()}] 🔄 Executing Global Game Reset...`);

        // 1. 모든 플레이어 리스폰
        // 1. 모든 플레이어 리스폰
        this.players.forEach(p => {
            // 각 플레이어의 색상/순서에 맞는 스폰 포인트 계산
            const index = p.colorIndex ?? 0;
            const spawn = this.getSpawnPoint(index);

            p.respawn(spawn.x, spawn.y);
            p.setVelocity(0, 0); // 속도 0
        });

        // 2. 모든 MovableBlock 리셋
        this.movableBlocks.forEach(block => {
            if (block.reset) {
                block.reset();
            }
        });

        // 3. 모든 Elevator 리셋
        this.elevators.forEach(elevator => {
            if (elevator.reset) {
                elevator.reset();
            }
        });

        // 4. 소모성/상태형 오브젝트 리셋 [NEW]
        this.keys.forEach(key => key.reset());
        this.locks.forEach(lock => lock.reset());
        this.poisonMushrooms.forEach(mushroom => mushroom.reset());

        // 5. 기타 기믹 리셋 필요 시 추가 (예: 버튼 상태, 도어 닫기 등)
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
    }

    private handleMovingBumperCollision(labelA: string, labelB: string): void {
        const playerLabel = this.players.has(labelA) ? labelA : (this.players.has(labelB) ? labelB : null);
        if (!playerLabel) return;

        const player = this.players.get(playerLabel)!;
        const playerPos = player.getPosition();

        let closestMBumper: MovingBumper | null = null;
        let minDist = Infinity;

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
            console.log(`[${this.getSceneKey()}] Player knockback applied via MovingBumper: angle=${angle.toFixed(2)}`);
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

    protected handleMushroomCollision(labelA: string, labelB: string): void {
        const mushroomLabel = labelA.startsWith('mushroom-') ? labelA : labelB;
        const mushroomId = mushroomLabel.replace('mushroom-', '');
        const mushroom = this.poisonMushrooms.find(m => m.id === mushroomId);

        if (mushroom && !mushroom.getIsTriggered()) {
            mushroom.trigger();

            // 참여 중인 모든 플레이어 중 랜덤 타겟 선정
            const playerNicknames = Array.from(this.players.keys());
            if (playerNicknames.length > 0) {
                const randomIdx = Math.floor(Math.random() * playerNicknames.length);
                const randomTarget = playerNicknames[randomIdx];
                const randomCurse = getRandomCurseId();

                console.log(`[PoisonMushroom] Applying random curse '${randomCurse}' to ${randomTarget} `);
                this.applyCurseToPlayer(randomTarget, randomCurse);

                // 피드백 텍스트
                const targetPlayer = this.players.get(randomTarget);
                if (targetPlayer) {
                    const pos = targetPlayer.getPosition();
                    this.showFloatingText(pos.x, pos.y - 40, `독버섯 저주: ${randomCurse} !`, 0x9B59B6);
                }
            }
        }
    }

    protected handleButtonCollision(labelA: string, labelB: string): void {
        const buttonLabel = labelA.startsWith('button-') ? labelA : labelB;
        const buttonId = buttonLabel.replace('button-', '');
        const button = this.blockButtons.find(b => b.id === buttonId);

        if (button && !button.getIsPressed()) {
            if (button.press()) {
                if (button.targetBlockId !== undefined) {
                    // Tiled의 targetBlockId 속성값이 일치하는 모든 블록 활성화
                    const targetBlocks = this.movableBlocks.filter(b => b.targetBlockId === button.targetBlockId);

                    if (targetBlocks.length > 0) {
                        targetBlocks.forEach(block => {
                            block.setVisible(true);
                        });
                        console.log(`[${this.getSceneKey()}]Block(s) activated(Prop targetBlockId: ${button.targetBlockId}) via Button: ${button.id} `);
                    } else {
                        console.warn(`[${this.getSceneKey()}] No blocks found with targetBlockId: ${button.targetBlockId} `);
                    }
                } else if (button.spawnConfig) {
                    // 기존 방식: 버튼 발동 시 블록 소환
                    this.spawnMovableBlock(button.spawnConfig);
                }

                // 효과음이나 파티클 대신 텍스트 피드백
                const feedback = button.targetBlockId !== undefined ? "블록 활성화!" : "블록 소환!";
                this.showFloatingText(button.getBody().position.x, button.getBody().position.y - 40, feedback, 0x2ECC71);
            }
        }
    }

    protected spawnMovableBlock(config: any): void {
        const block = new MovableBlock(this, config);
        this.movableBlocks.push(block);

        console.log(`[BaseGameScene] New block spawned: ${config.id} at(${config.x}, ${config.y})`);
    }

    protected handleTriggerButtonCollision(labelA: string, labelB: string): void {
        const buttonLabel = labelA.startsWith('ttrigger-') ? labelA : labelB;
        const buttonId = buttonLabel.replace('ttrigger-', '');
        const button = this.triggerButtons.find(b => b.id === buttonId);

        if (button && (!button.oneTime || !button.getIsPressed())) {
            if (button.press()) {
                const targetId = button.targetId;
                // 현재는 TogglePlatform만 지원하지만 추후 확장 가능
                const platform = this.togglePlatforms.find(p => p.id === targetId);

                if (platform) {
                    platform.toggle();

                    const feedback = platform.getIsVisible() ? "문 닫힘!" : "문 열림!";
                    this.showFloatingText(button.getBody().position.x, button.getBody().position.y - 40, feedback, 0xF1C40F);
                }
            }
        }
    }

    protected handleSignboardOverlap(labelA: string, labelB: string, isStart: boolean): void {
        const signboardLabel = labelA.startsWith('signboard-') ? labelA : labelB;
        const playerLabel = labelA.startsWith('signboard-') ? labelB : labelA;

        // 로컬 플레이어인 경우에만 상호작용
        if (playerLabel === this.myPlayerId) {
            const signboardId = signboardLabel.replace('signboard-', '');
            const signboard = this.signboards.find(sb => sb.id === signboardId);

            if (signboard) {
                signboard.setOverlap(isStart);
                this.activeSignboard = isStart ? signboard : null;

                if (!isStart) {
                    this.hideMessagePopup();
                }
            }
        }
    }
    protected showMessagePopup(text: string): void {
        if (this.popupContainer) return;

        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        this.popupContainer = this.add.container(centerX, centerY).setDepth(100).setScrollFactor(0);

        // 배경 박스 (반투명 검정)
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-150, -50, 300, 100, 10);
        bg.lineStyle(2, 0xffffff, 1);
        bg.strokeRoundedRect(-150, -50, 300, 100, 10);

        // 메시지 텍스트
        const msg = this.add.text(0, -10, text, {
            fontSize: '18px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 280 }
        }).setOrigin(0.5);

        // 닫기 안내
        const closeHint = this.add.text(0, 30, '(범위를 벗어나면 닫힙니다)', {
            fontSize: '12px',
            color: '#aaaaaa'
        }).setOrigin(0.5);

        this.popupContainer.add([bg, msg, closeHint]);
    }

    protected hideMessagePopup(): void {
        if (this.popupContainer) {
            this.popupContainer.destroy();
            this.popupContainer = null;
        }
    }

    protected handleGhostPlatformOverlap(labelA: string, labelB: string, isStart: boolean): void {
        const ghostLabel = labelA.startsWith('ghost-platform-') ? labelA : labelB;
        const playerLabel = labelA.startsWith('ghost-platform-') ? labelB : labelA;

        if (this.players.has(playerLabel)) {
            const ghostId = ghostLabel.replace('ghost-platform-', '');
            const ghost = this.ghostPlatforms.find(gp => gp.id === ghostId);
            if (ghost) {
                ghost.setOverlap(isStart);
            }
        }
    }

    public setSendStateCallback(callback: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden?: boolean) => void): void {
        this.sendStateCallback = callback;
    }

    public roomId: string | null = null;
    public setRoomId(roomId: string | null) {
        this.roomId = roomId;
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
                        const serverAnim = storePlayer.params?.anim; // Keep if needed, or remove if unused

                        if (isTeleport) {
                            player.setPosition(storePlayer.x, storePlayer.y);
                        }

                        // 원격 플레이어 동기화
                        if (!isLocal && existingPlayer) {
                            // [FIX] 저주 및 사망 상태 동기화 추가
                            const curses = (storePlayer as any).curses || [];
                            const isDead = (storePlayer as any).isDead || false;
                            const isHidden = (storePlayer as any).isHidden || false; // [NEW]

                            // storePlayer.anim이 없으면 params.anim 사용
                            const anim = (storePlayer as any).anim || serverAnim;

                            // [DEBUG] 원격 플레이어 데이터 확인
                            if (storePlayer.nickname !== this.myPlayerId) {
                                // 60프레임마다 한 번만 로그 출력 (너무 많음 방지)
                                /*
                                if (this.game.loop.frame % 60 === 0) {
                                    console.log(`[Sync] Remote ${storePlayer.nickname}: Pos(${storePlayer.x?.toFixed(1)}, ${storePlayer.y?.toFixed(1)}), Vel(${storePlayer.vx?.toFixed(2)}, ${storePlayer.vy?.toFixed(2)}), Dead:${isDead}, Curses:${curses}`);
                                }
                                */
                            }

                            existingPlayer.setRemoteState(
                                storePlayer.x,
                                storePlayer.y,
                                storePlayer.vx ?? 0,
                                storePlayer.vy ?? 0,
                                anim,
                                isDead,
                                curses,
                                isHidden
                            );

                            existingPlayer.applyRemoteDirection();
                            existingPlayer.applyRemoteAnimation();
                        }
                    }

                    // [FIX] 색상 인덱스 동기화 (접속 초기 colorIndex 지연 대응)
                    const newColorIndex = storePlayer.colorIndex ?? index;
                    if (player.colorIndex !== newColorIndex) {
                        console.log(`[BaseGameScene] Syncing colorIndex for ${player.nickname}: ${player.colorIndex} -> ${newColorIndex}`);
                        player.setColor(newColorIndex);
                    }
                } else if (!player) {
                    console.warn(`[Scene] Sync failed: Player ${storePlayer.nickname} not found in scene map`);
                }
            }
        });

        // 초기 배치가 끝났으므로 플래그 해제 (이후의 sync는 서버 좌표를 따름)
        if (this.isInitialPlacement && storePlayers.length > 0) {
            console.log(`[BaseGameScene] Initial placement complete for ${storePlayers.length} players.`);
            this.isInitialPlacement = false;
        }
    }

    private addPlayer(storePlayer: StorePlayer, index: number, currentNickname: string): void {
        const isLocalPlayer = storePlayer.nickname === currentNickname;
        // 서버에서 받은 x, y가 있으면 사용, 없으면 기본 위치
        // [MERGE] dev-frontend의 스폰 로직 사용 (colorIndex 기반)
        // 낙사 방지 로직은 update()에서 처리하므로 여기서는 위치 결정만 수행

        // colorIndex 결정: Store에서 계산된 값(접속 순서) 사용
        // 방장은 항상 0번(초록), 이후 접속자는 순서대로 할당됨
        const colorIndex = storePlayer.colorIndex ?? index;

        // 리스폰/스폰 위치 결정
        const spawn = this.getSpawnPoint(colorIndex);

        // [FIX] 씬이 막 생성되었거나 재시작된 경우(Initial Placement), 스토어의 이전 위치 정보를 무시하고 맵의 스폰 지점을 강제함
        // 그 외(진행 중 난입 등)에는 스토어 좌표가 있으면 그걸 우선함
        const useSpawn = this.isInitialPlacement || !storePlayer.x || !storePlayer.y || (storePlayer.x === 0 && storePlayer.y === 0);

        const xPos = useSpawn ? spawn.x : (storePlayer.x ?? spawn.x);
        const yPos = useSpawn ? spawn.y : (storePlayer.y ?? spawn.y);

        console.log(`[BaseGameScene] ${this.isInitialPlacement ? 'INITIAL' : 'LATE-JOIN'} spawn for ${storePlayer.nickname} (Idx: ${colorIndex}) at (${xPos.toFixed(0)}, ${yPos.toFixed(0)})`);

        const config: PlayerConfig = {
            id: storePlayer.nickname,  // nickname을 id로 사용 (서버와 일치)
            nickname: storePlayer.nickname,
            x: xPos,
            y: yPos,
            colorIndex: colorIndex,
            isLocalPlayer
        };

        console.log(`[${this.getSceneKey()}] Adding player: ${storePlayer.nickname}, isHost: ${storePlayer.isHost}, colorIndex: ${colorIndex}, isLocal: ${isLocalPlayer} `);

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
            console.log(`[${this.getSceneKey()}] Player added: ${storePlayer.nickname} at(${xPos.toFixed(0)}, ${yPos.toFixed(0)})`);
        } catch (error) {
            console.warn(`[${this.getSceneKey()}] Failed to add player: `, error);
        }
    }

    private removePlayer(nickname: string): void {
        const player = this.players.get(nickname);
        if (player) {
            player.destroy();
            this.players.delete(nickname);
            BaseGameScene.persistentCurses.delete(nickname);
            console.log(`[${this.getSceneKey()}] Player removed: ${nickname} `);
        }
    }

    update(time: number, delta: number) {
        // [CRITICAL SAFETY] 카메라 좌표 NaN/Infinity 강제 복구
        if (this.cameras.main) {
            if (!Number.isFinite(this.cameras.main.scrollX)) this.cameras.main.scrollX = 0;
            if (!Number.isFinite(this.cameras.main.scrollY)) this.cameras.main.scrollY = 0;
        }

        // [CRITICAL FIX] 탭이 숨겨져 있거나 델타가 너무 크면 물리 업데이트 생략
        if (document.hidden || delta > 200) {
            // 물리 연산 건너뜀 (멈춤)
        } else {
            // [PHYSICS] 수동 업데이트
            // Delta 시간을 최대 50ms로 더 타이트하게 제한
            const clampedDelta = Math.min(delta, 50);
            this.matter.world.step(clampedDelta);
        }

        // [SAFETY] 플레이어 추락 방지 가드 (맵 밖으로 나가면 복구)
        // update 루프 내에서 지속적으로 감시
        // 맵 바닥(Tiled Map)보다 훨씬 아래로 떨어졌는지 확인
        // Tiled Map 높이는 this.gameHeight가 아니라 실제 타일 맵 데이터에 의존하지만,
        // 여기서는 안전하게 화면 밖(100px)으로 나가면 복구
        const mapBottomY = this.gameHeight > 0 ? this.gameHeight : 720;

        this.players.forEach(player => {
            const pos = player.getPosition();

            // 바닥(화면 끝)에 닿는 즉시 낙사 처리 (여유 공간 0)
            if (pos.y > mapBottomY) {
                if (player.isLocalPlayer && !this.isDead) {
                    console.warn(`[Physics] Player ${player.nickname} fell out of bounds (${pos.y.toFixed(0)}), triggering death.`);
                    this.triggerDeath('fall');
                }
            }
        });

        // [DEBUG] 로컬 플레이어 상태 주기적 로깅 (1초마다)
        /*
        if (this.game.loop.frame % 60 === 0 && this.myPlayerId) {
            const p = this.players.get(this.myPlayerId);
            if (p) {
                const s = p.getSprite();
                console.log(`[DEBUG] ${this.getSceneKey()} Frame ${this.game.loop.frame}: Pos(${p.getPosition().x.toFixed(0)}, ${p.getPosition().y.toFixed(0)}), Vis:${s.visible}, Alpha:${s.alpha}, Depth:${s.depth}, CamX:${this.cameras.main.scrollX.toFixed(0)}`);
            }
        }
        */


        // 이동형 범퍼 업데이트
        this.movingBumpers.forEach(bumper => bumper.update(time));

        this.players.forEach((player, label) => {
            // 코요테 타임(groundedFrames)이 남아있으면 땅에 닿은 것으로 간주
            const isGrounded = (this.groundedFrames.get(label) || 0) > 0;
            player.update(isGrounded);
        });

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

        // === 3. Object Sync Broadcast (Hybrid Authority) ===
        if (!this.isSoloMode && this.myPlayerId) {
            const now = this.time.now;
            const roomId = useGameStore.getState().roomId;

            if (roomId) {
                // (A) Host controls automated gimmicks (Elevators)

                const amIHost = useGameStore.getState().isHost;

                if (amIHost && now - this.lastGimmickUpdateTime > this.SYNC_INTERVAL) {
                    if (this.elevators.length > 0) {
                        const data = this.elevators.map(e => ({
                            id: e.id,
                            x: e.getPosition().x,
                            y: e.getPosition().y
                        }));
                        gameWebSocket.sendGimmickUpdate(roomId, JSON.stringify(data));
                    }
                    this.lastGimmickUpdateTime = now;
                }

                // (B) Interactors control MovableBlocks (Everyone who pushes)
                if (now - this.lastBlockUpdateTime > this.SYNC_INTERVAL) {
                    const pushedBlocks: any[] = [];

                    this.movableBlocks.forEach(block => {
                        const label = block.getBody().label;

                        // 내가 밀고 있는 블록인지 확인
                        const pushLeft = this.pushMapLeft.get(label);
                        const pushRight = this.pushMapRight.get(label);

                        const isPushingLeft = pushLeft?.has(this.myPlayerId);
                        const isPushingRight = pushRight?.has(this.myPlayerId);

                        if (isPushingLeft || isPushingRight) {
                            pushedBlocks.push({
                                id: block.id,
                                x: block.getPosition().x,
                                y: block.getPosition().y
                            });
                        }
                    });

                    if (pushedBlocks.length > 0) {
                        gameWebSocket.sendBlockUpdate(roomId, JSON.stringify(pushedBlocks));
                    }
                    this.lastBlockUpdateTime = now;
                }
            }
        }

        this.updateCamera();
        this.handleLocalPlayerInput();
        // [REMOVED] 개별 카메라 모드에서는 플레이어가 카메라 밖으로 나갈 수 있어야 함
        // this.constrainPlayersToCamera();

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

        console.log(`[Chain] Starting from ${startLabel}, direction: ${direction} `);
        console.log(`[Chain] blockContactLeft: `, [...this.blockContactLeft.entries()]);
        console.log(`[Chain] blockContactRight: `, [...this.blockContactRight.entries()]);

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

                console.log(`[Chain] ${current} -> left: ${leftNeighbor}, right: ${rightNeighbor} `);

                if (leftNeighbor && !visited.has(leftNeighbor)) {
                    queue.push(leftNeighbor);
                }
                if (rightNeighbor && !visited.has(rightNeighbor)) {
                    queue.push(rightNeighbor);
                }
            }
        }

        console.log(`[Chain] Total blocks in chain: ${chainBlocks.length} `, chainLabels);

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
                            const velocity = player.getVelocity();
                            // [CRITICAL FIX] setPosition은 속도를 초기화하므로 Y 속도를 명시적으로 유지
                            player.setPosition(pos.x + moveAmount, pos.y);
                            player.setVelocity(0, velocity.y); // X는 블록에 막히므로 0, Y는 중력 가속도 유지
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



    // === Socket Listeners ===
    private setupSocketListeners(): void {
        gameWebSocket.on('GIMMICK_UPDATE', this.onGimmickUpdate);
        gameWebSocket.on('BLOCK_UPDATE', this.onBlockUpdate);
        gameWebSocket.on('GAME_RESET', this.onGameReset);
    }

    private cleanupSocketListeners(): void {
        // [FIX] removeListener -> off (GameWebSocket 구현에 맞춤)
        gameWebSocket.off('GIMMICK_UPDATE', this.onGimmickUpdate);
        gameWebSocket.off('BLOCK_UPDATE', this.onBlockUpdate);
        gameWebSocket.off('GAME_RESET', this.onGameReset);
    }

    private onGimmickUpdate = (msg: GameMessage) => {
        if (!msg.content) return;
        try {
            const updates = JSON.parse(msg.content);
            updates.forEach((data: any) => {
                const elevator = this.elevators.find(e => e.id === data.id);
                if (elevator) {
                    elevator.sync({ x: data.x, y: data.y });
                }
            });
        } catch (e) {
            console.error('Failed to parse GIMMICK_UPDATE:', e);
        }
    };

    private onBlockUpdate = (msg: GameMessage) => {
        if (!msg.content) return;
        try {
            const updates = JSON.parse(msg.content);
            updates.forEach((data: any) => {
                const block = this.movableBlocks.find(b => b.id === data.id);
                if (block) {
                    block.sync({ x: data.x, y: data.y });
                }
            });
        } catch (e) {
            console.error('Failed to parse BLOCK_UPDATE:', e);
        }
    };

    private onGameReset = () => {
        this.resetGame();
    };

    // 재귀적으로 위에 있는 모든 플레이어 수 계산 (AABB Overlap + Support Chain)
    private calculateTotalWeight(bottomLabel: string): number {
        const playersFound = new Set<string>();

        // 1. [Direct Check] 엘리베이터 ID인 경우, 직접 영역 겹침 검사 수행
        // 물리 엔진의 충돌 이벤트(collisionStart/Active)가 불안정할 수 있으므로
        // 매 프레임 위치 기반으로 확실하게 체크합니다.
        if (bottomLabel.startsWith('elevator-')) {
            const elevatorId = bottomLabel.replace('elevator-', '');
            const elevator = this.elevators.find(e => e.id === elevatorId);

            if (elevator) {
                const elevatorBounds = elevator.getBody().bounds;
                // 약간의 여유(Tolerance)를 두어 감지 범위 확장
                // 위쪽으로 조금 더 높게 확인하여(Top - 10px) 발이 살짝 닿아도 인정
                const checkBounds = {
                    minX: elevatorBounds.min.x,
                    maxX: elevatorBounds.max.x,
                    minY: elevatorBounds.min.y - 20, // 위쪽으로 20px 감지 영역 확장
                    maxY: elevatorBounds.max.y
                };

                this.players.forEach(player => {
                    const playerBounds = player.getBody().bounds;

                    // AABB Overlap Check
                    const overlaps = (
                        playerBounds.max.x > checkBounds.minX &&
                        playerBounds.min.x < checkBounds.maxX &&
                        playerBounds.max.y > checkBounds.minY && // 발바닥(MaxY)이 감지 영역 상단(MinY)보다 아래에 있음
                        playerBounds.min.y < checkBounds.maxY
                    );

                    if (overlaps) {
                        playersFound.add(player.nickname);
                    }
                });
            }
        }

        // 2. [Chain Check] SupportMap을 이용한 추가/연쇄 감지 (기존 로직 유지)
        // 플레이어 위에 플레이어가 있는 경우 처리
        const queue = Array.from(playersFound); // 이미 찾은 플레이어들부터 시작
        // 만약 엘리베이터 위 플레이어가 없다면 bottomLabel(엘리베이터) 자체에서 시작해야 함
        if (queue.length === 0) queue.push(bottomLabel);

        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            // 현재 객체 위에 있는 다른 객체들 확인
            const supported = this.supportMap.get(current);
            if (supported) {
                supported.forEach(topLabel => {
                    // 플레이어라면 카운트
                    if (this.players.has(topLabel)) {
                        playersFound.add(topLabel);
                    }
                    queue.push(topLabel); // 연쇄 감지
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

                // 현재 저주 상태 가져오기
                const curses = myPlayer.hasCurse() && myPlayer['currentCurseId'] ? [myPlayer['currentCurseId']] : [];

                // [FIX] P2P Stage Sync: Append stage number to anim string
                // e.g., "walk|s:2" so lagging clients can switch stage
                let syncAnim = currentAnim;
                const match = this.getSceneKey().match(/Stage(\d+)Scene/);
                if (match) {
                    syncAnim += `|s:${match[1]}`;
                }

                this.sendStateCallback(x, y, velocity.x, velocity.y, syncAnim, this.isDead || myPlayer['_isDead'], curses, myPlayer.isHidden);
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
        /* [DEBUG] 입력 상태 및 속도 로깅 */
        /*
        if (this.game.loop.frame % 60 === 0) {
            console.log(`[Input] Left:${leftKey.isDown}, Right:${rightKey.isDown}, Jump:${jumpKey.isDown}, Vel:(${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}), Stun:${myPlayer.isStunned}, Dead:${this.isDead}`);
        }
        */

        if (!myPlayer.isHidden) {
            if (leftKey.isDown) {
                myPlayer.setVelocity(-moveSpeed, velocity.y);
            } else if (rightKey.isDown) {
                myPlayer.setVelocity(moveSpeed, velocity.y);
            } else {
                myPlayer.setVelocity(0, velocity.y);
            }
        }

        if (this.cursors.down.isDown) {
            this.handleDownAction();
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

                        // [FIX] 골 탈출 시 서버에 알림 (완료 상태 취소)
                        const roomId = this.roomId || useGameStore.getState().roomId;
                        if (roomId && !this.isSoloMode) {
                            console.log(`[${this.getSceneKey()}] 🔙 Player exited goal! Sending exit signal...`);
                            gameWebSocket.sendStageExit(roomId);
                        }
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

                            // [FIX] 개별 클라이언트가 도착하면 즉시 서버로 신호 전송 (서버에서 전원 도착 여부 판별)
                            console.log(`[${this.getSceneKey()}] 🎉 Player entered goal! Sending signal...`);
                            this.onStageComplete();

                            /*
                            if (goal.isComplete()) {
                                console.log(`[${this.getSceneKey()}] 🎉 Stage Complete!`);
                                this.onStageComplete();
                            }
                            */
                            break;
                        }
                    }
                }

                const currentFrames = this.groundedFrames.get(playerLabel) || 0;
                if (!enteredGoal && currentFrames > 0) {
                    myPlayer.setVelocity(velocity.x, PHYSICS.JUMP_POWER * myPlayer.getJumpMultiplier());
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
                console.log(`[Curse] Applying random curse: ${randomCurse} `);
                myPlayer.applyCurse(randomCurse);

                // Persistence (except drain)
                if (randomCurse !== 'drain') {
                    BaseGameScene.persistentCurses.set(this.myPlayerId, randomCurse);
                }
            }
        }
    }


    private handleDownAction(): void {
        if (this.activeSignboard) {
            this.showMessagePopup(this.activeSignboard.message);
        }
    }


    /**
     * 특정 플레이어 인덱스에 맞는 스폰 위치를 반환합니다.
     */
    protected getSpawnPoint(playerIndex: number): { x: number; y: number } {
        // 1. 해당 인덱스에 명시적으로 할당된 스폰 포인트 검색
        const specificSpawn = this.spawnPoints.find(p => p.playerIndex === playerIndex);
        if (specificSpawn) {
            console.log(`[BaseGameScene] Found specific spawn point for Index ${playerIndex}: (${specificSpawn.x}, ${specificSpawn.y})`);
            return { x: specificSpawn.x, y: specificSpawn.y };
        }

        // 2. 기본(isDefault) 스폰 포인트 검색
        const defaultSpawn = this.spawnPoints.find(p => p.isDefault);
        if (defaultSpawn) {
            console.log(`[BaseGameScene] No specific spawn for Index ${playerIndex}, using default: (${defaultSpawn.x}, ${defaultSpawn.y})`);
            return { x: defaultSpawn.x, y: defaultSpawn.y };
        }

        // 3. 아무 스폰 포인트나 첫 번째 것 반환
        if (this.spawnPoints.length > 0) {
            const first = this.spawnPoints[0];
            console.log(`[BaseGameScene] No default spawn found, using first available point: (${first.x}, ${first.y})`);
            return { x: first.x, y: first.y };
        }

        // 4. 레거시 단일 spawnPoint 반환
        if (this.spawnPoint) return this.spawnPoint;

        // 5. 최후의 보루: 맵 하단 기반 기본 위치 계산
        const groundY = this.getWorldHeight() + this.offsetY;
        const defaultY = groundY - (this.shouldCreateDefaultFloor() ? 100 : 128);
        const fallbackX = 100 + (playerIndex * 100);
        console.warn(`[BaseGameScene] NO spawn points found! Using fallback: (${fallbackX}, ${defaultY})`);
        return {
            x: fallbackX,
            y: defaultY
        };
    }

    // 스테이지 클리어 시 호출 - 서브클래스에서 오버라이드 가능
    protected onStageComplete(): void {
        console.log(`[${this.getSceneKey()}] 🎉 Stage Complete! Sending clear signal...`);

        // [FIX] roomId가 설정되지 않았을 경우 Store에서 가져옴
        const roomId = this.roomId || useGameStore.getState().roomId;

        if (roomId && gameWebSocket.isConnected()) {
            gameWebSocket.sendStageClear(roomId);

            // UI 피드백: "다른 멤버를 기다리는 중..."
            this.showFloatingText(
                this.cameras.main.midPoint.x,
                this.cameras.main.midPoint.y - 100,
                "다른 팀원을 기다리는 중...",
                0x00ffff
            );
        } else {
            console.warn('[Stage] Cannot send clear: Room ID missing or WS disconnected');
        }
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
        if (!this.myPlayerId) return;

        const myPlayer = this.players.get(this.myPlayerId);
        if (!myPlayer) return;

        const pos = myPlayer.getPosition();

        // [SAFETY] 유효하지 않은 좌표(NaN 또는 Infinity) 확인
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
            const now = Date.now();
            if (now - this.lastErrorLogTime > 1000) {
                console.warn('[Camera] Invalid local player position (NaN/Infinity) detected! skipping update.');
                this.lastErrorLogTime = now;
            }
            return;
        }

        // [MERGE FIX] positions 변수가 정의되지 않아 에러 발생
        // 로컬 플레이어 외의 다른 플레이어들의 위치도 고려할지 여부
        // dev-frontend 로직은 모든 플레이어의 위치를 고려하는 것으로 보임
        // [FIX] 카메라 동기화 버그 수정: 오직 '나(Local Player)'만 바라보도록 수정
        // const positions = Array.from(this.players.values()).map(p => p.getPosition());
        // if (positions.length === 0) positions.push(pos); // 최소한 자기 자신은 포함

        const centerX = pos.x;

        // 카메라 부드러운 이동 (Lerp)
        const newScrollX = Phaser.Math.Linear(
            this.cameras.main.scrollX,
            centerX - this.cameras.main.width / 2,
            0.1
        );

        // const minY = Math.min(...positions.map(p => p.y));
        // const maxY = Math.max(...positions.map(p => p.y));
        // const centerY = (minY + maxY) / 2;
        const centerY = pos.y; // [FIX] 내 위치만 바라봄

        const newScrollY = Phaser.Math.Linear(
            this.cameras.main.scrollY,
            centerY - this.cameras.main.height / 2,
            0.1
        );

        // [SAFETY] 최종 카메라 위치가 유효한지 확인 (NaN/Infinity 체크)
        if (!Number.isFinite(newScrollX) || !Number.isFinite(newScrollY)) {
            const now = Date.now();
            if (now - this.lastErrorLogTime > 1000) {
                console.warn(`[Camera] Scroll calculation failed! result: X = ${newScrollX}, Y = ${newScrollY} `);
                this.lastErrorLogTime = now;
            }
            // 안전한 값으로 강제 리셋
            if (Number.isFinite(centerX)) this.cameras.main.scrollX = centerX - this.cameras.main.width / 2;
            if (Number.isFinite(centerY)) this.cameras.main.scrollY = centerY - this.cameras.main.height / 2;
        } else {
            this.cameras.main.scrollX = newScrollX;
            this.cameras.main.scrollY = newScrollY;
        }

        // 월드 바운드 클램핑
        const maxScrollX = Math.max(0, this.getWorldWidth() - this.cameras.main.width);
        this.cameras.main.scrollX = Phaser.Math.Clamp(
            this.cameras.main.scrollX,
            0,
            maxScrollX
        );
        this.cameras.main.scrollY = Phaser.Math.Clamp(
            this.cameras.main.scrollY,
            0,
            this.getWorldHeight() - this.cameras.main.height
        );
    }

    /**
     * 화면에 떠오르는 텍스트 피드백을 표시합니다.
     * 핵심 로직은 utils/UIHelper.ts로 분리되었습니다.
     */
    protected showFloatingText(x: number, y: number, message: string, color: number = 0xffffff): void {
        showFloatingText(this, x, y, message, color);
    }



    shutdown() {
        console.log(`[${this.getSceneKey()}] Shutdown triggered, cleaning up...`);

        // [CRITICAL FIX] 글로벌 이벤트 리스너 제거
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

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

            this.poisonMushrooms.forEach(mushroom => mushroom.destroy());
            this.blockButtons.forEach(btn => btn.destroy());
            this.togglePlatforms.forEach(tp => tp.destroy());
            this.triggerButtons.forEach(tb => tb.destroy());
            this.signboards.forEach(sb => sb.destroy());
            this.ghostPlatforms.forEach(gp => gp.destroy());

            this.keys = [];
            this.locks = [];
            this.spikes = [];
            this.goals = [];
            this.springs = [];
            this.elevators = [];
            this.movableBlocks = [];
            this.bumpers = [];
            this.movingBumpers = [];
            this.poisonMushrooms = [];
            this.blockButtons = [];
            this.togglePlatforms = [];
            this.triggerButtons = [];
            this.signboards = [];
            this.ghostPlatforms = [];

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

            // 소켓 리스너 제거
            this.cleanupSocketListeners();

        } catch (error) {
            console.error(`[${this.getSceneKey()}] Error during shutdown: `, error);
        }
    }
}
