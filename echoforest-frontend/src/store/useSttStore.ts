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

// === 로깅 헬퍼 ===
const LOG_PREFIX = '✅[STT]';
const log = {
    info: (msg: string, ...args: unknown[]) => console.log(`${LOG_PREFIX} ${msg}`, ...args),
    success: (msg: string, ...args: unknown[]) => console.log(`${LOG_PREFIX} ✅ ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`${LOG_PREFIX} ❌ ${msg}`, ...args),
    serverSend: (type: string, data: unknown) => {
        console.log(`${LOG_PREFIX} 🌐 [→ 게임서버] ${type}`, data);
    },
    serverReceive: (type: string, data: unknown) => {
        console.log(`${LOG_PREFIX} 🌐 [← 게임서버] ${type}`, data);
    },
    curse: (action: string, data: unknown) => {
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

    // === Actions ===
    setBoosterMode: (active: boolean) => void;
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

    // === 기본 액션 ===
    setBoosterMode: (active: boolean) => {
        log.info(`부스터 모드: ${active ? 'ON 🟢' : 'OFF 🔴'}`);
        set({ isBoosterMode: active });
    },

    setTranscript: (text: string) => {
        set({ transcript: text });
    },

    // === Worker 결과 핸들러 ===
    onPositiveDetected: (word: string, isCursed: boolean) => {
        log.positive(word, isCursed);

        if (isCursed) {
            set({
                lastDetectedWord: word,
                wordType: 'positive',
                boosterActive: true,
                warningModal: {
                    isVisible: true,
                    level: 0,
                    emoji: '✨',
                    title: '저주 해제!',
                    message: `"${word}"로 저주가 해제됩니다!`,
                    keyword: word,
                },
            });

            // 서버로 저주 해제 요청
            const { roomId } = useGameStoreCompat();
            if (roomId && gameWebSocket.isConnected()) {
                sendCurseRelease(roomId, word);
            }
        } else {
            set({
                lastDetectedWord: word,
                wordType: 'positive',
                boosterActive: true,
                warningModal: {
                    isVisible: true,
                    level: 0,
                    emoji: '💖',
                    title: '긍정어 발동!',
                    message: `"${word}" 감지!\n(저주 상태가 아닙니다)`,
                    keyword: word,
                },
            });
        }

        // 3초 후 모달 숨김
        setTimeout(() => {
            set({
                boosterActive: false,
                warningModal: { ...get().warningModal, isVisible: false }
            });
        }, 3000);
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
        log.info(`📤 [배치 전송] ${texts.length}개 문장`, texts);

        const { roomId } = useGameStoreCompat();
        if (roomId && gameWebSocket.isConnected()) {
            sendSpeechBatch(roomId, texts);
        } else {
            log.warn('[배치] WebSocket 미연결 - 전송 실패', { roomId, connected: gameWebSocket.isConnected() });
        }
    },

    // === 서버 이벤트 핸들러 ===
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

    hideWarningModal: () => {
        set({ warningModal: { ...get().warningModal, isVisible: false } });
    },

    reset: () => {
        log.info('STT 상태 초기화');
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
    log.serverSend('SPEECH_BATCH', { roomId, texts, 문장수: texts.length });
    log.info('→ 게임서버가 AI서버(/api/v1/analyze/batch)에 분석 요청 예정');

    gameWebSocket.send({
        type: 'SPEECH_BATCH' as never,
        roomId,
        texts,
    });
}

function sendCurseRelease(roomId: string, word: string) {
    log.serverSend('CURSE_RELEASE', { roomId, word });
    gameWebSocket.send({
        type: 'CURSE_RELEASE' as never,
        roomId,
        word,
    });
}

export default useSttStore;
