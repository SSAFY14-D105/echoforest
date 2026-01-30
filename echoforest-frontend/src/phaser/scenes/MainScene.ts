import Phaser from 'phaser';
import { useGameStore } from '../../store/useGameStore';
import { Player } from '../entities/Player';
import type { PlayerConfig } from '../entities/Player';
import type { Player as StorePlayer } from '../../store/useGameStore';

// 물리 파라미터
const PHYSICS = {
    MOVE_SPEED: 5,
    ACCELERATION: 0.5,
    DECELERATION: 0.9,
    JUMP_POWER: -12
};

export default class MainScene extends Phaser.Scene {
    private players: Map<string, Player> = new Map();
    private myPlayerId: string = '';
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private worldWidth: number = 3000;
    private storeUnsubscribe?: () => void;

    // 네트워크 최적화용 변수
    private lastBroadcastTime: number = 0;
    private lastBroadcastPos: { x: number, y: number } = { x: 0, y: 0 };

    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // 나중에 에셋 로드
    }

    create() {
        // 캔버스의 실제 높이 사용
        const gameHeight = this.scale.height;

        // Matter.js 물리 world 설정 (캔버스 크기에 맞춤)
        this.matter.world.setBounds(0, 0, this.worldWidth, gameHeight);

        // 바닥 플랫폼 (캔버스 하단에 위치)
        const platformHeight = 40;
        this.matter.add.rectangle(
            this.worldWidth / 2,
            gameHeight - platformHeight / 2,  // 캔버스 하단에 배치
            this.worldWidth,
            platformHeight,
            {
                isStatic: true,
                label: 'ground'
            }
        );

        // 키보드 입력
        this.cursors = this.input.keyboard?.createCursorKeys();

        // 카메라 설정 (캔버스 높이에 맞춤)
        this.cameras.main.setBounds(0, 0, this.worldWidth, gameHeight);

        // Store에서 초기 플레이어 로드
        this.syncPlayersFromStore();

        // Store 변화 구독 (플레이어 추가/제거 감지)
        // Zustand 기본 subscribe는 전체 상태만 받음
        this.storeUnsubscribe = useGameStore.subscribe(() => {
            this.syncPlayersFromStore();
        });
    }

    // Store의 players 배열과 동기화
    private syncPlayersFromStore(): void {
        const state = useGameStore.getState();
        const storePlayers = state.players;
        const currentNickname = state.nickname;

        // Store에 있는데 게임에 없는 플레이어 추가
        storePlayers.forEach((storePlayer, index) => {
            if (!this.players.has(storePlayer.id)) {
                this.addPlayer(storePlayer, index, currentNickname);
            } else {
                // 이미 있는 원격 플레이어 - 좌표 업데이트 (tweens로 부드럽게)
                const player = this.players.get(storePlayer.id);
                if (player && !player.isLocalPlayer && storePlayer.x !== undefined && storePlayer.y !== undefined) {
                    const currentPos = player.getPosition();
                    // 위치가 변경된 경우만 tween 적용
                    if (Math.abs(currentPos.x - storePlayer.x) > 1 || Math.abs(currentPos.y - storePlayer.y) > 1) {
                        // Tweens로 부드럽게 이동 (백엔드 명세서 권장사항)
                        this.tweens.add({
                            targets: { x: currentPos.x, y: currentPos.y },
                            x: storePlayer.x,
                            y: storePlayer.y,
                            duration: 50, // 50ms 동안 부드럽게 이동
                            onUpdate: (tween) => {
                                const value = tween.targets[0] as { x: number; y: number };
                                player.setPosition(value.x, value.y);
                            }
                        });
                    }
                }
            }
        });

        // 게임에 있는데 Store에 없는 플레이어 제거
        const storePlayerIds = new Set(storePlayers.map(p => p.id));
        this.players.forEach((_, playerId) => {
            if (!storePlayerIds.has(playerId)) {
                this.removePlayer(playerId);
            }
        });
    }

    // 플레이어 추가
    private addPlayer(storePlayer: StorePlayer, index: number, currentNickname: string): void {
        const isLocalPlayer = storePlayer.nickname === currentNickname;
        const xPos = 100 + (index * 100);

        const config: PlayerConfig = {
            id: storePlayer.id,
            nickname: storePlayer.nickname,
            x: xPos,
            y: 300,
            colorIndex: index,
            isLocalPlayer
        };

        // TODO: 씬 준비 상태 개선 필요 - 임시로 try-catch 사용
        try {
            const player = new Player(this, config);
            this.players.set(storePlayer.id, player);

            // 로컬 플레이어 ID 저장
            if (isLocalPlayer) {
                this.myPlayerId = storePlayer.id;
            }

            // console.log(`[MainScene] Player added: ${storePlayer.nickname} (${isLocalPlayer ? 'local' : 'remote'})`);
        } catch (error) {
            console.warn(`[MainScene] Failed to add player (physics not ready): ${storePlayer.nickname}`);
        }
    }

    // 플레이어 제거
    private removePlayer(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            player.destroy();
            this.players.delete(playerId);
            // console.log(`[MainScene] Player removed: ${playerId}`);
        }
    }

    update() {
        // 모든 플레이어 업데이트
        this.players.forEach((player: any) => player.update());

        // 카메라 업데이트
        this.updateCamera();

        // 로컬 플레이어 조작
        this.handleLocalPlayerInput();

        // 플레이어 카메라 경계 제한
        this.constrainPlayersToCamera();
    }

    private handleLocalPlayerInput(): void {
        const myPlayer = this.players.get(this.myPlayerId);
        if (!myPlayer || !this.cursors) return;

        const velocity = myPlayer.getVelocity();
        let moved = false;

        // 좌우 이동
        if (this.cursors.left.isDown) {
            myPlayer.setVelocity(
                Math.max(velocity.x - PHYSICS.ACCELERATION, -PHYSICS.MOVE_SPEED),
                velocity.y
            );
            moved = true;
        } else if (this.cursors.right.isDown) {
            myPlayer.setVelocity(
                Math.min(velocity.x + PHYSICS.ACCELERATION, PHYSICS.MOVE_SPEED),
                velocity.y
            );
            moved = true;
        } else {
            // 감속
            myPlayer.setVelocity(velocity.x * PHYSICS.DECELERATION, velocity.y);
        }

        // 점프
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && Math.abs(velocity.y) < 0.5) {
            myPlayer.setVelocity(velocity.x, PHYSICS.JUMP_POWER);
            moved = true;
        }

        // 이동했으면 WebSocket으로 위치 브로드캐스트 (최적화 적용)
        // 1. 쓰로틀링: 50ms (초당 20회) 제한
        const now = this.time.now;
        if (now - this.lastBroadcastTime < 50) return;

        const pos = myPlayer.getPosition();
        const dist = Phaser.Math.Distance.Between(
            pos.x, pos.y,
            this.lastBroadcastPos.x, this.lastBroadcastPos.y
        );

        // 2. 델타 체크: 키 입력이 있거나(moved), 실제 움직임이 1픽셀 이상일 때만 전송
        // 속도가 0.1 이상인 경우에만 움직임으로 간주 (미세 떨림 방지)
        const isMoving = Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1;

        if (moved || (isMoving && dist > 1)) {
            // Store를 통해 WebSocket으로 전송
            useGameStore.getState().broadcastMove(pos.x, pos.y);

            this.lastBroadcastTime = now;
            this.lastBroadcastPos = { x: pos.x, y: pos.y };
        }
    }

    private updateCamera(): void {
        const positions = Array.from(this.players.values()).map(p => p.getPosition());
        if (positions.length === 0) return;

        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));
        const centerX = (minX + maxX) / 2;

        this.cameras.main.scrollX = Phaser.Math.Linear(
            this.cameras.main.scrollX,
            centerX - this.cameras.main.width / 2,
            0.1
        );

        this.cameras.main.scrollX = Phaser.Math.Clamp(
            this.cameras.main.scrollX,
            0,
            this.worldWidth - this.cameras.main.width
        );
    }

    private constrainPlayersToCamera(): void {
        const camLeft = this.cameras.main.scrollX;
        const camRight = camLeft + this.cameras.main.width;

        this.players.forEach(player => {
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
        // 씬 종료 시 구독 해제
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        // 모든 플레이어 정리
        this.players.forEach(player => player.destroy());
        this.players.clear();
    }
}
