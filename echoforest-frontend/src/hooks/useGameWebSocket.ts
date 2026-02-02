/**
 * useGameWebSocket - WebSocket 메시지 처리 훅
 * 
 * 통일된 ✅[STT] 로그 접두사 사용
 */

import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { Player } from '../store/useGameStore';
import { useSttStore } from '../store/useSttStore';
import { useToastStore } from '../store/useToastStore';
import { gameWebSocket } from '../socket/GameWebSocket';
import type { GameMessage } from '../socket/GameWebSocket';

export function useGameWebSocket() {
    const {
        nickname,
        roomId,
        isHost,
        isSoloMode,
        addPlayer,
        syncPlayersFromServer,
        removePlayerByNickname,
        setPlayerReady,
        startGameFromServer,
        selectStage,
        clearStage,
        leaveGame,
        setGamePaused,
    } = useGameStore();

    const {
        onStackUpdated,
        onCurseTriggered,
        onCurseReleased,
    } = useSttStore();

    const { showToast } = useToastStore();

    const parseStageNum = (stageId: string | null): number => {
        if (!stageId) return 1;
        const num = parseInt(stageId.replace(/^(MULTI_|SOLO_)/, ''), 10);
        return isNaN(num) ? 1 : num;
    };

    const getMultiStageId = (num: number): string => `MULTI_${num}`;

    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;

        // [FIX] 마지막 처리된 STAGE_TRANSITION을 추적하여 중복 방지
        let lastProcessedStage: string | null = null;
        let lastTransitionTime = 0;

        gameWebSocket.onMessage((msg: GameMessage) => {
            switch (msg.type) {
                case 'UPDATE':
                    if (msg.content) {
                        try {
                            // [PROTOCOL v2] Array Based Protocol
                            // [id, x, y, vx, vy, anim, isDead, isHidden, isDisconnected, colorIndex, curses, hp, isAfk]
                            const serverPlayers: any[] = JSON.parse(msg.content);
                            const currentPlayers = useGameStore.getState().players;

                            let shouldUpdate = false;

                            // 1. Check for length mismatch
                            if (serverPlayers.length !== currentPlayers.length) {
                                shouldUpdate = true;
                            } else {
                                // 2. Create a map for current players for efficient lookup
                                const currentPlayerMap = new Map<string, Player>();
                                currentPlayers.forEach(p => currentPlayerMap.set(p.id, p));

                                // 3. Check for changes in critical status
                                for (const serverPlayer of serverPlayers) {
                                    // serverPlayer[0]: id
                                    const currentPlayer = currentPlayerMap.get(serverPlayer[0]);

                                    if (!currentPlayer) {
                                        shouldUpdate = true;
                                        break;
                                    }

                                    // serverPlayer[6]: isDead, [8]: isDisconnected
                                    const sIsDead = serverPlayer[6] ?? false;
                                    const sIsDisconnected = serverPlayer[8] ?? false;

                                    if (currentPlayer.isDead !== sIsDead ||
                                        currentPlayer.isDisconnected !== sIsDisconnected) {
                                        shouldUpdate = true;
                                        break;
                                    }
                                }
                            }

                            if (shouldUpdate) {
                                // Convert Array back to Object for Store
                                const convertedPlayers = serverPlayers.map(p => ({
                                    id: p[0],
                                    x: p[1],
                                    y: p[2],
                                    vx: p[3],
                                    vy: p[4],
                                    anim: p[5],
                                    isDead: p[6],
                                    isHidden: p[7],
                                    isDisconnected: p[8],
                                    colorIndex: p[9],
                                    curses: p[10],
                                    hp: p[11],
                                    isAfk: p[12],
                                    nickname: p[0], // nickname fallback to id
                                    isHost: false // Host info usually separate or derived
                                }));
                                syncPlayersFromServer(convertedPlayers as any);
                            }
                        } catch (e) {
                            console.error("Error parsing UPDATE message content:", e);
                        }
                    }
                    break;

                case 'JOIN':
                    if (msg.username && msg.username !== nickname) {
                        const newPlayer: Player = {
                            id: msg.username,
                            nickname: msg.username,
                            isHost: false,
                            x: msg.x,
                            y: msg.y
                        };
                        addPlayer(newPlayer);
                    }
                    break;

                case 'MOVE':
                    if (msg.anim && msg.anim.includes('|s:')) {
                        const parts = msg.anim.split('|s:');
                        if (parts.length > 1) {
                            const hostStage = parseInt(parts[1], 10);
                            const { currentStage: myStage, isHost: amIHost } = useGameStore.getState();

                            if (!amIHost && hostStage > 0 && parseStageNum(myStage) !== hostStage) {
                                startGameFromServer(hostStage);
                            }
                        }
                    }
                    break;

                case 'LEAVE':
                case 'PLAYER_LEFT':
                case 'PLAYER_DISCONNECTED':
                    if (msg.username) {
                        removePlayerByNickname(msg.username);
                    }
                    break;

                case 'READY_STATUS':
                    if (msg.username) {
                        const isReady = msg.content === 'true';
                        setPlayerReady(msg.username, isReady);
                    }
                    break;

                case 'GAME_START':
                    {
                        const stage = msg.content ? parseInt(msg.content, 10) : 1;
                        startGameFromServer(stage);
                    }
                    break;

                case 'STAGE_CHANGE':
                    {
                        const stage = msg.content ? parseInt(msg.content, 10) : 1;
                        selectStage(getMultiStageId(stage));
                    }
                    break;

                case 'STAGE_TRANSITION':
                    if (msg.content) {
                        const now = Date.now();
                        const currentStage = useGameStore.getState().currentStage;

                        // [FIX] 중복 방지: 같은 스테이지이거나 1초 내 중복 메시지면 무시
                        if (msg.content === currentStage) {
                            break;
                        }
                        if (msg.content === lastProcessedStage && now - lastTransitionTime < 2000) {
                            break;
                        }

                        lastProcessedStage = msg.content;
                        lastTransitionTime = now;
                        selectStage(msg.content);
                    }
                    break;

                case 'STAGE_SELECT':
                    if (!isHost && msg.stage !== undefined) {
                        selectStage(getMultiStageId(msg.stage));
                    }
                    break;

                case 'STAGE_CLEAR':
                    if (!isHost && msg.stage !== undefined) {
                        clearStage(getMultiStageId(msg.stage));
                    }
                    break;

                case 'ROOM_CLOSED':
                    leaveGame();
                    alert('방장이 방을 나가 게임이 종료되었습니다.');
                    break;

                case 'KICKED':
                    leaveGame();
                    alert('방장에 의해 강제 퇴장되었습니다.');
                    break;

                case 'DUPLICATE_LOGIN':
                    alert(msg.content || '다른 기기에서 로그인하여 접속이 종료됩니다.');
                    leaveGame();
                    useGameStore.getState().logout();
                    break;

                case 'GAME_PAUSED':
                    setGamePaused(msg.content || msg.username || 'Unknown Player');
                    break;

                case 'GAME_RESUMED':
                    setGamePaused(null);
                    break;

                case 'ERROR':
                    console.error(`🎮 [Game] ❌ 에러: ${msg.content}`);
                    break;

                // === STT 저주 시스템 (✅[STT] 로그) ===
                case 'STACK_UPDATED':
                    if (msg.stack !== undefined) {
                        onStackUpdated(msg.stack, msg.delta ?? 0, msg.reason);
                    }
                    break;

                case 'CURSE_TRIGGERED':
                    if (msg.cursedPlayerId) {
                        onCurseTriggered(msg.cursedPlayerId, msg.mapId ?? 1);
                        showToast(`${msg.cursedPlayerId}님이 저주에 걸렸습니다!`, 'warning');
                    }
                    break;

                case 'CURSE_RELEASED':
                    if (msg.releasedPlayerId) {
                        onCurseReleased(msg.releasedPlayerId, msg.word ?? '');
                        showToast(`${msg.releasedPlayerId}님이 저주에서 해제되었습니다!`, 'success');
                    }
                    break;
            }
        });

        gameWebSocket.onError((error) => {
            console.error(`🎮 [Game] ❌ WebSocket 에러:`, error);
        });

        if (!gameWebSocket.isConnected()) {
            gameWebSocket.setUser(nickname);
            gameWebSocket.connect().catch(err => {
                console.error('WebSocket 재연결 실패:', err);
            });
        }

        // [FIX] Heartbeat (Ping) Loop - Prevent Soft Disconnect in idle screens
        const intervalId = setInterval(() => {
            if (gameWebSocket.isConnected()) {
                gameWebSocket.ping();
            }
        }, 30000); // 30초마다 핑 전송

        return () => {
            clearInterval(intervalId);
        };



    }, [roomId, nickname, isSoloMode, isHost]);
}

export default useGameWebSocket;
