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
    setTranscript: (text: string) => {
        set({ transcript: text });
    },

    // === Worker 결과 핸들러 ===
    onPositiveDetected: (word: string, isCursed: boolean) => {
        // 저주 상태일 때만 처리
        if (isCursed) {
            set({
                lastDetectedWord: word,
                wordType: 'positive',
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
        if (roomId && gameWebSocket.isConnected()) {
            sendSpeechBatch(roomId, texts);
        } else {
            console.warn('[배치] WebSocket 미연결 - 전송 실패', { roomId, connected: gameWebSocket.isConnected() });
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

        // Phaser 씬에 저주 적용 이벤트 전달
        window.dispatchEvent(new CustomEvent('curse-triggered', {
            detail: { playerId: cursedPlayerId, mapId }
        }));

        setTimeout(() => {
            set({ warningModal: { ...get().warningModal, isVisible: false } });
        }, 5000);
    },

    onCurseReleased: (releasedPlayerId: string, word: string) => {

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

        // Phaser 씬에 저주 해제 이벤트 전달
        window.dispatchEvent(new CustomEvent('curse-released', {
            detail: { playerId: releasedPlayerId, word }
        }));

        setTimeout(() => {
            set({ warningModal: { ...get().warningModal, isVisible: false } });
        }, 3000);
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
