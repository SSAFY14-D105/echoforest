// 상태 관리 + 비즈니스 로직
import { create } from 'zustand';
import { gameWebSocket } from '../socket/GameWebSocket';
import { useGameStore } from './useGameStore';

// 긍정어 목록 (프론트엔드 로컬 매칭)
const POSITIVE_WORDS = ['뽀뽀', '사랑해', '좋아해'];

// 배치 전송 간격 (5초)
const BATCH_INTERVAL_MS = 5000;

export interface WarningModal {
    isVisible: boolean;
    level: number;      // 1=critical, 2=severe, 3=mild, 0=booster
    emoji: string;
    title: string;
    message: string;
    keyword?: string;
}

export interface CurseState {
    stack: number;             // 0~10 저주 스택
    cursedPlayer: string | null;  // 저주 걸린 플레이어
    isCollecting: boolean;     // 배치 수집 중
    queueCount: number;        // 큐에 쌓인 발화 수
    countdown: number;         // 다음 전송까지 남은 초
}

export interface SttState {
    // STT 상태
    isListening: boolean;
    transcript: string;
    lastDetectedWord: string | null;
    wordType: 'positive' | 'negative' | null;

    // 부스터 모드
    isBoosterMode: boolean;
    boosterActive: boolean;

    // 저주 상태
    curseState: CurseState;

    // 배치 처리
    speechQueue: string[];

    // 경고 모달
    warningModal: WarningModal;

    // 분석 결과
    analysisResult: string | null;
    penaltyLevel: number | null;

    // 액션
    setBoosterMode: (active: boolean) => void;
    processTranscript: (text: string, isFinal: boolean) => void;
    hideWarningModal: () => void;

    // WebSocket 콜백
    onStackUpdated: (stack: number, delta: number, reason?: string) => void;
    onCurseTriggered: (cursedPlayerId: string, mapId: number) => void;
    onCurseReleased: (releasedPlayerId: string, word: string) => void;

    // 초기화
    reset: () => void;
}

// 배치 타이머
let batchTimer: ReturnType<typeof setTimeout> | null = null;

export const useSttStore = create<SttState>((set, get) => ({
    // 초기 상태
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

    // 부스터 모드 설정
    setBoosterMode: (active: boolean) => {
        set({ isBoosterMode: active });
        console.log(`🎯 부스터 모드: ${active ? 'ON' : 'OFF'}`);
    },

    // 텍스트 처리
    processTranscript: (text: string, isFinal: boolean) => {
        const state = get();
        const cleanText = text.trim();

        if (!cleanText) return;

        set({ transcript: cleanText });

        // 1. 긍정어 체크 (부스터 모드에서만)
        if (state.isBoosterMode) {
            const foundPositive = POSITIVE_WORDS.find(word =>
                cleanText.includes(word)
            );

            if (foundPositive) {
                console.log(`💖 긍정어 감지: ${foundPositive}`);

                const isCursed = state.curseState.cursedPlayer !== null;

                if (isCursed) {
                    // 저주가 걸린 상태 → 저주 해제!
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

                    // WebSocket으로 저주 해제 요청 (저주 상태일 때만!)
                    const { roomId } = useGameStoreCompat();
                    if (roomId && gameWebSocket.isConnected()) {
                        sendCurseRelease(roomId, foundPositive);
                        console.log(`✨ 저주 해제 요청 전송: ${foundPositive}`);
                    }
                } else {
                    // 저주가 없는 상태 → 긍정어 발동 알림만
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
                    console.log(`💖 긍정어 발동 (저주 없음): ${foundPositive}`);
                }

                // 3초 후 모달 숨김
                setTimeout(() => {
                    set({
                        boosterActive: false,
                        warningModal: { ...get().warningModal, isVisible: false }
                    });
                }, 3000);

                return;
            }
        }

        // 2. 최종 결과만 배치 큐에 추가
        if (isFinal) {
            const queue = [...state.speechQueue, cleanText];
            set({
                speechQueue: queue,
                curseState: {
                    ...state.curseState,
                    isCollecting: true,
                    queueCount: queue.length,
                }
            });

            console.log(`📝 배치 큐 추가: "${cleanText}" (총 ${queue.length}개)`);

            // 배치 타이머 시작 (이미 있으면 스킵)
            if (!batchTimer) {
                startBatchTimer();
            }
        }
    },

    // 경고 모달 숨김
    hideWarningModal: () => {
        set({ warningModal: { ...get().warningModal, isVisible: false } });
    },

    // 스택 업데이트 콜백
    onStackUpdated: (stack: number, delta: number, reason?: string) => {
        console.log(`🔮 스택 업데이트: ${stack} (${delta > 0 ? '+' : ''}${delta}) - ${reason || ''}`);

        set({
            curseState: {
                ...get().curseState,
                stack,
            },
            analysisResult: delta !== 0 ? `스택 ${delta > 0 ? '+' : ''}${delta}` : null,
        });
    },

    // 저주 발동 콜백
    onCurseTriggered: (cursedPlayerId: string, mapId: number) => {
        console.log(`💀 저주 발동! 대상: ${cursedPlayerId}, 맵: ${mapId}`);

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

        // 5초 후 모달 숨김
        setTimeout(() => {
            set({ warningModal: { ...get().warningModal, isVisible: false } });
        }, 5000);
    },

    // 저주 해제 콜백
    onCurseReleased: (releasedPlayerId: string, word: string) => {
        console.log(`✨ 저주 해제! ${releasedPlayerId}님이 "${word}"로 해제`);

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

        // 3초 후 모달 숨김
        setTimeout(() => {
            set({ warningModal: { ...get().warningModal, isVisible: false } });
        }, 3000);
    },

    // 초기화
    reset: () => {
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

// 배치 타이머 시작
function startBatchTimer() {
    const countdown = BATCH_INTERVAL_MS / 1000;
    useSttStore.setState({
        curseState: {
            ...useSttStore.getState().curseState,
            countdown,
        }
    });

    // 카운트다운
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
        sendBatch();
        batchTimer = null;
    }, BATCH_INTERVAL_MS);
}


// 배치 전송
async function sendBatch() {
    const { speechQueue } = useSttStore.getState();

    if (speechQueue.length === 0) {
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

    console.log(`📤 배치 전송: ${speechQueue.length}개 발화`);

    // 모든 모드에서 WebSocket 사용 (게임 서버 → AI 서버 체인)
    const { roomId } = useGameStoreCompat();

    if (roomId && gameWebSocket.isConnected()) {
        sendSpeechBatch(roomId, speechQueue);
    } else {
        console.warn('⚠️ WebSocket 미연결 - 배치 전송 실패');
    }

    // 큐 초기화
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



// 헬퍼: GameStore에서 roomId 가져오기
function useGameStoreCompat(): { roomId: string; isSoloMode: boolean; nickname: string } {
    const state = useGameStore.getState();
    return {
        roomId: state.roomId || '',
        isSoloMode: state.isSoloMode || false,
        nickname: state.nickname || '',
    };
}


// WebSocket 헬퍼 함수
function sendSpeechBatch(roomId: string, texts: string[]) {
    gameWebSocket.send({
        type: 'SPEECH_BATCH' as any,
        roomId,
        texts,  // ⚠️ texts 직접 전송 (content가 아님!)
    });
    console.log(`📤 SPEECH_BATCH 전송: ${texts.length}개`);
}

function sendCurseRelease(roomId: string, word: string) {
    gameWebSocket.send({
        type: 'CURSE_RELEASE' as any,
        roomId,
        word,  // ⚠️ word 필드 사용 (content가 아님!)
    });
    console.log(`📤 CURSE_RELEASE 전송: "${word}"`);
}

export default useSttStore;
