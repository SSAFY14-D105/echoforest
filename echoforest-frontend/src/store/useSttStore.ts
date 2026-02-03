/**
 * useSttStore - STT 상태 관리 (Zustand)
 * 
 * Web Worker 도입으로 역할 분리:
 * - Store: 상태 저장 + UI 표시용 데이터만 관리
 * - Worker: 텍스트 분석, 배치 큐, 타이머 (SttWorkerService)
 * 
 * 로그 플로우:
 * 1. Worker에서 분석 → 2. Store 상태 업데이트 → 3. WebSocket 전송
 */
import { create } from 'zustand';
import { gameWebSocket } from '../socket/GameWebSocket';
import { useGameStore } from './useGameStore';

export interface WarningModal {
    isVisible: boolean;
    level: number;
    emoji: string;
    title: string;
    message: string;
    keyword?: string;
}

export interface CurseState {
    stack: number;
    cursedPlayer: string | null;
    isCollecting: boolean;
    queueCount: number;
    countdown: number;
}

export interface SttState {
    isListening: boolean;
    transcript: string;
    lastDetectedWord: string | null;
    wordType: 'positive' | 'negative' | null;
    curseState: CurseState;
    speechQueue: string[];
    warningModal: WarningModal;
    analysisResult: string | null;
    penaltyLevel: number | null;

    // === Actions ===
    setTranscript: (text: string) => void;

    // Worker 결과 핸들러
    onPositiveDetected: (word: string, isCursed: boolean) => void;
    onQueueUpdate: (count: number, texts: string[]) => void;
    onCountdownUpdate: (countdown: number) => void;
    onBatchReady: (texts: string[]) => void;

    // 서버 이벤트 핸들러
    onStackUpdated: (stack: number, delta: number, reason?: string) => void;
    onCurseTriggered: (cursedPlayerId: string, mapId: number) => void;
    onCurseReleased: (releasedPlayerId: string, word: string) => void;

    hideWarningModal: () => void;
    reset: () => void;
}

export const useSttStore = create<SttState>((set, get) => ({
    isListening: false,
    transcript: '',
    lastDetectedWord: null,
    wordType: null,
    curseState: {
        stack: 0,
        cursedPlayers: [], // [복구] 초기값 빈 배열
        isCollecting: false,
        queueCount: 0,
        countdown: 0,
    },
    speechQueue: [],
    warningModal: {
        isVisible: false,
        level: 0,
        emoji: '',
        title: '',
        message: '',
    },
    analysisResult: null,
    penaltyLevel: null,

    // === 기본 액션 ===
    setTranscript: (text: string) => {
        set({ transcript: text });
    },

    // === Worker 결과 핸들러 ===
    onPositiveDetected: (word: string, isCursed: boolean) => {
        // 저주 상태일 때만 처리
        if (isCursed) {
            const { roomId, nickname } = useGameStoreCompat();
            const cursedPlayers = get().curseState.cursedPlayers;

            // [다중 저주] 본인이 저주에 걸렸는지 확인
            const isSelfCursed = cursedPlayers.includes(nickname);

            if (isSelfCursed) {
                // [FIX] 본인이 저주에 걸린 경우: 긍정어 완전 무시 (인식 안함)
                console.log(`[STT] ${nickname}님은 저주 상태 - 긍정어 "${word}" 무시`);
                return;
            }

            // 다른 플레이어가 저주에 걸린 경우: 저주 해제 가능 (FIFO - 첫 번째 플레이어)
            const cursedTeammates = cursedPlayers.filter((p: string) => p !== nickname);

            if (cursedTeammates.length === 0) return; // 해제할 대상 없음

            const firstCursedPlayer = cursedTeammates[0];  // FIFO: 첫 번째 저주 플레이어

            set({
                lastDetectedWord: word,
                wordType: 'positive',
                warningModal: {
                    isVisible: true,
                    level: 0,
                    emoji: '✨',
                    title: '저주 해제!',
                    message: `"${word}"로 ${firstCursedPlayer}님의 저주를 해제합니다!`,
                    keyword: word,
                },
            });

            // 서버로 저주 해제 요청
            const isConnected = gameWebSocket.isConnected();
            if (roomId && isConnected) {
                sendCurseRelease(roomId, word);
            }

            // 3초 후 모달 숨김
            setTimeout(() => {
                set({
                    warningModal: { ...get().warningModal, isVisible: false }
                });
            }, 3000);
        }
    },

    onQueueUpdate: (count: number, texts: string[]) => {
        set({
            speechQueue: texts,
            curseState: {
                ...get().curseState,
                isCollecting: count > 0,
                queueCount: count,
            }
        });
    },

    onCountdownUpdate: (countdown: number) => {
        set({
            curseState: {
                ...get().curseState,
                countdown,
            }
        });
    },

    onBatchReady: (texts: string[]) => {
        const { roomId } = useGameStoreCompat();
        // console.log('[STT 배치] 서버로 전송 준비:', { roomId, texts, connected: gameWebSocket.isConnected() });
        if (roomId && gameWebSocket.isConnected()) {
            sendSpeechBatch(roomId, texts);
            // console.log('[STT 배치] ✅ 서버로 전송 완료:', texts);
        } else {
            // console.warn('[배치] ❌ WebSocket 미연결 - 전송 실패', { roomId, connected: gameWebSocket.isConnected() });
        }
    },

    // === 서버 이벤트 핸들러 ===
    onStackUpdated: (stack: number, delta: number, _reason?: string) => {
        set({
            curseState: {
                ...get().curseState,
                stack,
            },
            analysisResult: delta !== 0 ? `스택 ${delta > 0 ? '+' : ''}${delta}` : null,
        });
    },

    onCurseTriggered: (cursedPlayerId: string, mapId: number) => {
        const currentCursedPlayers = get().curseState.cursedPlayers;

        // 중복 방지: 이미 저주 걸린 플레이어는 추가하지 않음
        // [FIX] 백엔드에서 이미 필터링하므로 이론상 발생하지 않지만, 발생 시 로그만 남김
        if (currentCursedPlayers.includes(cursedPlayerId)) {
            console.warn(`[STT] ${cursedPlayerId}님은 이미 저주 상태입니다 (백엔드 필터링 누락?)`);
            // 스택만 초기화하고 계속 진행
        }

        set({
            curseState: {
                ...get().curseState,
                stack: 0,
                cursedPlayers: [...currentCursedPlayers, cursedPlayerId], // 배열에 추가
            },
            warningModal: {
                isVisible: true,
                level: 1,
                emoji: '💀',
                title: '저주 발동!',
                message: `${cursedPlayerId}님에게 저주가 걸렸습니다!`,
            },
        });

        // Phaser 씬에 저주 적용 이벤트 전달
        window.dispatchEvent(new CustomEvent('curse-triggered', {
            detail: { playerId: cursedPlayerId, mapId }
        }));

        setTimeout(() => {
            set({ warningModal: { ...get().warningModal, isVisible: false } });
        }, 5000);
    },

    onCurseReleased: (releasedPlayerId: string, word: string) => {
        const { nickname } = useGameStoreCompat();
        const cursedPlayers = get().curseState.cursedPlayers;

        // [FIX] 저주 상태는 모든 클라이언트에서 동기화되어야 함
        // 배열에서 해제된 플레이어 제거
        if (cursedPlayers.includes(releasedPlayerId)) {
            const updatedCursedPlayers = cursedPlayers.filter((id: string) => id !== releasedPlayerId);

            set({
                curseState: {
                    ...get().curseState,
                    cursedPlayers: updatedCursedPlayers,
                }
            });

            // 본인 해제 시 알림
            if (releasedPlayerId === nickname) {
                set({
                    warningModal: {
                        isVisible: true,
                        level: 0,
                        emoji: '✨',
                        title: '해방!',
                        message: `팀원의 도움으로 저주가 풀렸습니다!`,
                        keyword: word,
                    },
                });

                setTimeout(() => {
                    set({ warningModal: { ...get().warningModal, isVisible: false } });
                }, 3000);
            }
        }

        // Phaser 씬에 저주 해제 이벤트 전달
        window.dispatchEvent(new CustomEvent('curse-released', {
            detail: { playerId: releasedPlayerId, word }
        }));
    },

    hideWarningModal: () => {
        set({ warningModal: { ...get().warningModal, isVisible: false } });
    },

    reset: () => {
        set({
            isListening: false,
            transcript: '',
            lastDetectedWord: null,
            wordType: null,
            curseState: {
                stack: 0,
                cursedPlayer: null,
                isCollecting: false,
                queueCount: 0,
                countdown: 0,
            },
            speechQueue: [],
            warningModal: {
                isVisible: false,
                level: 0,
                emoji: '',
                title: '',
                message: '',
            },
            analysisResult: null,
            penaltyLevel: null,
        });
    },
}));

// === 헬퍼 함수 ===
function useGameStoreCompat(): { roomId: string; isSoloMode: boolean; nickname: string } {
    const state = useGameStore.getState();
    return {
        roomId: state.roomId || '',
        isSoloMode: state.isSoloMode || false,
        nickname: state.nickname || '',
    };
}

function sendSpeechBatch(roomId: string, texts: string[]) {
    gameWebSocket.send({
        type: 'SPEECH_BATCH' as never,
        roomId,
        texts,
    });
}

function sendCurseRelease(roomId: string, word: string) {
    gameWebSocket.send({
        type: 'CURSE_RELEASE' as never,
        roomId,
        word,
    });
}

export default useSttStore;
