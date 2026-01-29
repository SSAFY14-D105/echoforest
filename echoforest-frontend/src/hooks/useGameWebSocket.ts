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

// === 로깅 헬퍼 ===
const LOG_PREFIX = '✅[STT]';
const log = {
    info: (msg: string, ...args: any[]) => console.log(`${LOG_PREFIX} ${msg}`, ...args),
    serverReceive: (type: string, data: any) => {
        console.log(`${LOG_PREFIX} 🌐 [← 게임서버] ${type}`, data);
    },
    aiResult: (data: any) => {
        console.log(`${LOG_PREFIX} 🤖 [AI 분석 결과]`, data);
    }
};

// 게임 관련 로그 (STT와 분리)
const gameLog = {
    info: (msg: string, ...args: any[]) => console.log(`🎮 [Game] ${msg}`, ...args),
    player: (action: string, name: string) => console.log(`🎮 [Game] 👤 ${name} ${action}`)
};

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

        gameLog.info(`WebSocket 핸들러 등록 (room: ${roomId})`);

        gameWebSocket.onMessage((msg: GameMessage) => {
            switch (msg.type) {
                case 'UPDATE':
                    if (msg.content) {
                        try {
                            const serverPlayers: ServerPlayerState[] = JSON.parse(msg.content);
                            // [DEBUG]
                            if (Math.random() < 0.05) {
                                console.log(`[UDPATE] Received ${serverPlayers.length} players. Names: ${serverPlayers.map(p => p.id).join(', ')}`);
                            }
                            syncPlayersFromServer(serverPlayers);
                        } catch (e) {
                            // 파싱 에러만 로그
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
                        gameLog.player('입장', msg.username);
                    }
                    break;

                case 'MOVE':
                    if (msg.anim && msg.anim.includes('|s:')) {
                        const parts = msg.anim.split('|s:');
                        if (parts.length > 1) {
                            const hostStage = parseInt(parts[1], 10);
                            const { currentStage: myStage, isHost: amIHost } = useGameStore.getState();

                            if (!amIHost && hostStage > 0 && parseStageNum(myStage) !== hostStage) {
                                gameLog.info(`P2P Sync → 스테이지 ${hostStage}`);
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
                        gameLog.player('퇴장 (연결종료)', msg.username);
                    }
                    break;

                case 'READY_STATUS':
                    if (msg.username) {
                        const isReady = msg.content === 'true';
                        setPlayerReady(msg.username, isReady);
                        gameLog.info(`${msg.username} Ready: ${isReady}`);
                    }
                    break;

                case 'GAME_START':
                    {
                        const stage = msg.content ? parseInt(msg.content, 10) : 1;
                        startGameFromServer(stage);
                        gameLog.info(`🚀 게임 시작! 스테이지: ${stage}`);
                    }
                    break;

                case 'STAGE_CHANGE':
                    {
                        const stage = msg.content ? parseInt(msg.content, 10) : 1;
                        selectStage(getMultiStageId(stage));
                        gameLog.info(`스테이지 변경: ${stage}`);
                    }
                    break;

                case 'STAGE_TRANSITION':
                    if (msg.content) {
                        // Server sends "MULTI_X" format
                        selectStage(msg.content);
                        gameLog.info(`⏩ 스테이지 전환: ${msg.content}`);
                    }
                    break;

                case 'STAGE_SELECT':
                    if (!isHost && msg.stage !== undefined) {
                        selectStage(getMultiStageId(msg.stage));
                        gameLog.info(`스테이지 ${msg.stage} 선택됨`);
                    }
                    break;

                case 'STAGE_CLEAR':
                    if (!isHost && msg.stage !== undefined) {
                        clearStage(getMultiStageId(msg.stage));
                        gameLog.info(`🏆 스테이지 ${msg.stage} 클리어됨`);
                    }
                    break;

                case 'ROOM_CLOSED':
                    gameLog.info('🚨 방장이 방을 나갔습니다');
                    leaveGame();
                    alert('방장이 방을 나가 게임이 종료되었습니다.');
                    break;

                case 'KICKED':
                    gameLog.info('🚨 강제 퇴장됨');
                    leaveGame();
                    alert('방장에 의해 강제 퇴장되었습니다.');
                    break;

                case 'GAME_PAUSED':
                    gameLog.info(`⏸️ 게임 일시정지 by ${msg.content}`);
                    setGamePaused(msg.content || 'Unknown Player');
                    break;

                case 'GAME_RESUMED':
                    gameLog.info('▶️ 게임 재개');
                    setGamePaused(null);
                    break;

                case 'ERROR':
                    console.error(`🎮 [Game] ❌ 에러: ${msg.content}`);
                    break;

                // === STT 저주 시스템 (✅[STT] 로그) ===
                case 'STACK_UPDATED':
                    if (msg.stack !== undefined) {
                        log.serverReceive('STACK_UPDATED', {
                            현재스택: msg.stack,
                            변화량: msg.delta! > 0 ? `+${msg.delta}` : msg.delta,
                            사유: msg.reason || 'AI 분석 결과'
                        });
                        log.aiResult({
                            설명: '게임서버가 AI서버 분석 결과를 적용함',
                            스택증가: msg.delta,
                            부정어감지: msg.delta! > 0 ? '있음' : '없음'
                        });
                        onStackUpdated(msg.stack, msg.delta ?? 0, msg.reason);
                    }
                    break;

                case 'CURSE_TRIGGERED':
                    if (msg.cursedPlayerId) {
                        log.serverReceive('CURSE_TRIGGERED', {
                            저주대상: msg.cursedPlayerId,
                            맵ID: msg.mapId,
                            설명: '스택 10 도달 → 랜덤 플레이어에게 저주 발동'
                        });
                        onCurseTriggered(msg.cursedPlayerId, msg.mapId ?? 1);
                    }
                    break;

                case 'CURSE_RELEASED':
                    if (msg.releasedPlayerId) {
                        log.serverReceive('CURSE_RELEASED', {
                            해제대상: msg.releasedPlayerId,
                            긍정어: msg.word,
                            설명: '긍정어로 저주 해제됨'
                        });
                        onCurseReleased(msg.releasedPlayerId, msg.word ?? '');
                    }
                    break;
            }
        });

        gameWebSocket.onError((error) => {
            console.error(`🎮 [Game] ❌ WebSocket 에러:`, error);
        });

        if (!gameWebSocket.isConnected()) {
            gameLog.info('WebSocket 재연결 시도...');
            gameWebSocket.setUser(nickname);
            gameWebSocket.connect().catch(err => {
                console.error('WebSocket 재연결 실패:', err);
            });
        }

    }, [roomId, nickname, isSoloMode, isHost]);
}

export default useGameWebSocket;
