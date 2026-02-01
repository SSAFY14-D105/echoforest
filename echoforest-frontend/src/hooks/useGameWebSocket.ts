/**
 * useGameWebSocket - WebSocket 메시지 처리 훅
 * 
 * 통일된 ✅[STT] 로그 접두사 사용
 */

import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { Player } from '../store/useGameStore';
import { useSttStore } from '../store/useSttStore';
import { gameWebSocket } from '../socket/GameWebSocket';
import type { GameMessage, ServerPlayerState } from '../socket/GameWebSocket';

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

    const parseStageNum = (stageId: string | null): number => {
        if (!stageId) return 1;
        const num = parseInt(stageId.replace(/^(MULTI_|SOLO_)/, ''), 10);
        return isNaN(num) ? 1 : num;
    };

    const getMultiStageId = (num: number): string => `MULTI_${num}`;

    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;

        gameWebSocket.onMessage((msg: GameMessage) => {
            switch (msg.type) {
                case 'UPDATE':
                    if (msg.content) {
                        try {
                            const serverPlayers: ServerPlayerState[] = JSON.parse(msg.content);
                            const currentPlayers = useGameStore.getState().players;

                            let shouldUpdate = false;

                            // 1. Check for length mismatch
                            if (serverPlayers.length !== currentPlayers.length) {
                                shouldUpdate = true;
                            } else {
                                // 2. Create a map for current players for efficient lookup
                                const currentPlayerMap = new Map<string, Player>();
                                currentPlayers.forEach(p => currentPlayerMap.set(p.id, p));

                                // 3. Check for changes in critical status (isDead, isDisconnected)
                                for (const serverPlayer of serverPlayers) {
                                    const currentPlayer = currentPlayerMap.get(serverPlayer.id);

                                    if (!currentPlayer) {
                                        // Player exists on server but not in local store
                                        shouldUpdate = true;
                                        break;
                                    }

                                    // Compare critical states
                                    if (currentPlayer.isDead !== serverPlayer.isDead ||
                                        currentPlayer.isDisconnected !== serverPlayer.isDisconnected) {
                                        shouldUpdate = true;
                                        break;
                                    }
                                }
                            }

                            if (shouldUpdate) {
                                syncPlayersFromServer(serverPlayers);
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
                        // Server sends "MULTI_X" format
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
                    setGamePaused(msg.content || 'Unknown Player');
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
                    }
                    break;

                case 'CURSE_RELEASED':
                    if (msg.releasedPlayerId) {
                        onCurseReleased(msg.releasedPlayerId, msg.word ?? '');
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
