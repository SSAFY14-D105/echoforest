/**
 * useSttStore - STT 상태 관리 + 비즈니스 로직
 * 
 * 로그 플로우:
 * 1. [최종 인식] 문장 → 2. [배치 추가] → 3. [배치 전송] → 4. [서버 응답]
 */
import { create } from 'zustand';
import { gameWebSocket } from '../socket/GameWebSocket';
import { useGameStore } from './useGameStore';

// === 로깅 헬퍼 (통일된 접두사) ===
const LOG_PREFIX = '✅[STT]';
const log = {
    info: (msg: string, ...args: any[]) => console.log(`${LOG_PREFIX} ${msg}`, ...args),
    success: (msg: string, ...args: any[]) => console.log(`${LOG_PREFIX} ✅ ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`${LOG_PREFIX} ❌ ${msg}`, ...args),

    // 배치 관련
    batchAdd: (text: string, queueSize: number, queue: string[]) => {
        console.log(`${LOG_PREFIX} 📥 [배치 추가] "${text}" (큐: ${queueSize}개)`, queue);
    },
    batchSend: (count: number, texts: string[]) => {
        console.log(`${LOG_PREFIX} 📤 [배치 전송] ${count}개 문장 → 게임서버`, texts);
    },
    batchTimer: (action: 'start' | 'tick' | 'end', seconds?: number) => {
        if (action === 'start') {
            console.log(`${LOG_PREFIX} ⏱️ [타이머] ${seconds}초 후 전송 예정`);
        } else if (action === 'end') {
            console.log(`${LOG_PREFIX} ⏱️ [타이머] 완료 - 전송 시작`);
        }
    },

    // 서버 통신
    serverSend: (type: string, data: any) => {
        console.log(`${LOG_PREFIX} 🌐 [→ 게임서버] ${type}`, data);
    },
    serverReceive: (type: string, data: any) => {
        console.log(`${LOG_PREFIX} 🌐 [← 게임서버] ${type}`, data);
    },

    // 저주 관련
    curse: (action: string, data: any) => {
        console.log(`${LOG_PREFIX} 💀 [저주] ${action}`, data);
    },
    positive: (word: string, isCursed: boolean) => {
        if (isCursed) {
            console.log(`${LOG_PREFIX} 💖 [긍정어] "${word}" → 저주 해제 시도`);
        } else {
            console.log(`${LOG_PREFIX} 💖 [긍정어] "${word}" (저주 없음)`);
        }
    }
};

// 긍정어 목록
const POSITIVE_WORDS = ['뽀뽀', '사랑해', '좋아해'];
const BATCH_INTERVAL_MS = 5000;

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
    isBoosterMode: boolean;
    boosterActive: boolean;
    curseState: CurseState;
    speechQueue: string[];
    warningModal: WarningModal;
    analysisResult: string | null;
    penaltyLevel: number | null;
    setBoosterMode: (active: boolean) => void;
    processTranscript: (text: string, isFinal: boolean) => void;
    hideWarningModal: () => void;
    onStackUpdated: (stack: number, delta: number, reason?: string) => void;
    onCurseTriggered: (cursedPlayerId: string, mapId: number) => void;
    onCurseReleased: (releasedPlayerId: string, word: string) => void;
    reset: () => void;
}

let batchTimer: ReturnType<typeof setTimeout> | null = null;

export const useSttStore = create<SttState>((set, get) => ({
    isListening: false,
    transcript: '',
    lastDetectedWord: null,
    wordType: null,
    isBoosterMode: false,
    boosterActive: false,
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

    setBoosterMode: (active: boolean) => {
        log.info(`부스터 모드: ${active ? 'ON 🟢' : 'OFF 🔴'}`);
        set({ isBoosterMode: active });
    },

    processTranscript: (text: string, isFinal: boolean) => {
        const state = get();
        const cleanText = text.trim();

        if (!cleanText) return;

        set({ transcript: cleanText });

        // 긍정어 체크 (부스터 모드에서만)
        if (state.isBoosterMode) {
            const foundPositive = POSITIVE_WORDS.find(word => cleanText.includes(word));

            if (foundPositive) {
                const isCursed = state.curseState.cursedPlayer !== null;
                log.positive(foundPositive, isCursed);

                if (isCursed) {
                    set({
                        lastDetectedWord: foundPositive,
                        wordType: 'positive',
                        boosterActive: true,
                        warningModal: {
                            isVisible: true,
                            level: 0,
                            emoji: '✨',
                            title: '저주 해제!',
                            message: `"${foundPositive}"로 저주가 해제됩니다!`,
                            keyword: foundPositive,
                        },
                    });

                    const { roomId } = useGameStoreCompat();
                    if (roomId && gameWebSocket.isConnected()) {
                        sendCurseRelease(roomId, foundPositive);
                    }
                } else {
                    set({
                        lastDetectedWord: foundPositive,
                        wordType: 'positive',
                        boosterActive: true,
                        warningModal: {
                            isVisible: true,
                            level: 0,
                            emoji: '💖',
                            title: '긍정어 발동!',
                            message: `"${foundPositive}" 감지!\n(저주 상태가 아닙니다)`,
                            keyword: foundPositive,
                        },
                    });
                }

                setTimeout(() => {
                    set({
                        boosterActive: false,
                        warningModal: { ...get().warningModal, isVisible: false }
                    });
                }, 3000);

                return;
            }
        }

        // 최종 결과만 배치 큐에 추가
        if (isFinal) {
            const queue = [...state.speechQueue, cleanText];
            log.batchAdd(cleanText, queue.length, queue);

            set({
                speechQueue: queue,
                curseState: {
                    ...state.curseState,
                    isCollecting: true,
                    queueCount: queue.length,
                }
            });

            if (!batchTimer) {
                startBatchTimer();
            }
        }
    },

    hideWarningModal: () => {
        set({ warningModal: { ...get().warningModal, isVisible: false } });
    },

    onStackUpdated: (stack: number, delta: number, reason?: string) => {
        const prevStack = get().curseState.stack;
        log.serverReceive('STACK_UPDATED', {
            이전: prevStack,
            현재: stack,
            변화: delta > 0 ? `+${delta}` : delta,
            사유: reason || 'negative_word'
        });

        set({
            curseState: {
                ...get().curseState,
                stack,
            },
            analysisResult: delta !== 0 ? `스택 ${delta > 0 ? '+' : ''}${delta}` : null,
        });
    },

    onCurseTriggered: (cursedPlayerId: string, mapId: number) => {
        log.curse('발동! 💀💀💀', { 대상: cursedPlayerId, 맵ID: mapId });

        set({
            curseState: {
                ...get().curseState,
                stack: 0,
                cursedPlayer: cursedPlayerId,
            },
            warningModal: {
                isVisible: true,
                level: 1,
                emoji: '💀',
                title: '저주 발동!',
                message: `${cursedPlayerId}님에게 저주가 걸렸습니다!`,
            },
        });

        setTimeout(() => {
            set({ warningModal: { ...get().warningModal, isVisible: false } });
        }, 5000);
    },

    onCurseReleased: (releasedPlayerId: string, word: string) => {
        log.curse('해제됨 ✨', { 대상: releasedPlayerId, 긍정어: word });

        set({
            curseState: {
                ...get().curseState,
                cursedPlayer: null,
            },
            warningModal: {
                isVisible: true,
                level: 0,
                emoji: '✨',
                title: '저주 해제!',
                message: `${releasedPlayerId}님이 "${word}"로 저주를 해제했습니다!`,
            },
        });

        setTimeout(() => {
            set({ warningModal: { ...get().warningModal, isVisible: false } });
        }, 3000);
    },

    reset: () => {
        log.info('STT 상태 초기화');
        if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
        }

        set({
            isListening: false,
            transcript: '',
            lastDetectedWord: null,
            wordType: null,
            isBoosterMode: false,
            boosterActive: false,
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

// 배치 타이머
function startBatchTimer() {
    const countdown = BATCH_INTERVAL_MS / 1000;
    log.batchTimer('start', countdown);

    useSttStore.setState({
        curseState: {
            ...useSttStore.getState().curseState,
            countdown,
        }
    });

    let remaining = countdown;
    const countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            useSttStore.setState({
                curseState: {
                    ...useSttStore.getState().curseState,
                    countdown: remaining,
                }
            });
        }
    }, 1000);

    batchTimer = setTimeout(() => {
        clearInterval(countdownInterval);
        log.batchTimer('end');
        sendBatch();
        batchTimer = null;
    }, BATCH_INTERVAL_MS);
}

// 배치 전송
async function sendBatch() {
    const { speechQueue } = useSttStore.getState();

    if (speechQueue.length === 0) {
        log.info('[배치] 전송할 문장 없음 - 스킵');
        useSttStore.setState({
            curseState: {
                ...useSttStore.getState().curseState,
                isCollecting: false,
                queueCount: 0,
                countdown: 0,
            }
        });
        return;
    }

    log.batchSend(speechQueue.length, speechQueue);

    const { roomId } = useGameStoreCompat();

    if (roomId && gameWebSocket.isConnected()) {
        sendSpeechBatch(roomId, speechQueue);
    } else {
        log.warn('[배치] WebSocket 미연결 - 전송 실패', { roomId, connected: gameWebSocket.isConnected() });
    }

    useSttStore.setState({
        speechQueue: [],
        curseState: {
            ...useSttStore.getState().curseState,
            isCollecting: false,
            queueCount: 0,
            countdown: 0,
        }
    });
}

function useGameStoreCompat(): { roomId: string; isSoloMode: boolean; nickname: string } {
    const state = useGameStore.getState();
    return {
        roomId: state.roomId || '',
        isSoloMode: state.isSoloMode || false,
        nickname: state.nickname || '',
    };
}

function sendSpeechBatch(roomId: string, texts: string[]) {
    log.serverSend('SPEECH_BATCH', { roomId, texts, 문장수: texts.length });
    log.info('→ 게임서버가 AI서버(/api/v1/analyze/batch)에 분석 요청 예정');

    gameWebSocket.send({
        type: 'SPEECH_BATCH' as any,
        roomId,
        texts,
    });
}

function sendCurseRelease(roomId: string, word: string) {
    log.serverSend('CURSE_RELEASE', { roomId, word });
    gameWebSocket.send({
        type: 'CURSE_RELEASE' as any,
        roomId,
        word,
    });
}

export default useSttStore;
