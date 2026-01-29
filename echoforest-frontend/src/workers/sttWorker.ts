/**
 * STT Worker - 메인 스레드에서 분리된 텍스트 처리
 * 
 * 역할:
 * 1. 긍정어 검색 (뽀뽀, 사랑해, 좋아해)
 * 2. 배치 큐 관리
 * 3. 5초 타이머 - 배치 전송 시점 알림
 */

// === 메시지 타입 정의 ===
export type WorkerInMessage =
    | { type: 'PROCESS_TRANSCRIPT'; text: string; isFinal: boolean; isBoosterMode: boolean; isCursed: boolean }
    | { type: 'RESET' }
    | { type: 'SET_BOOSTER_MODE'; active: boolean };

export type WorkerOutMessage =
    | { type: 'POSITIVE_DETECTED'; word: string; isCursed: boolean }
    | { type: 'BATCH_READY'; texts: string[] }
    | { type: 'COUNTDOWN_UPDATE'; countdown: number }
    | { type: 'QUEUE_UPDATE'; count: number; texts: string[] }
    | { type: 'TRANSCRIPT_UPDATE'; text: string };

// === 상수 ===
const POSITIVE_WORDS = ['뽀뽀', '사랑해', '좋아해'];
const BATCH_INTERVAL_MS = 5000;

// === 상태 ===
let speechQueue: string[] = [];
let batchTimerId: ReturnType<typeof setTimeout> | null = null;
let countdownIntervalId: ReturnType<typeof setInterval> | null = null;
let isBoosterMode = false;

// === 로깅 ===
const log = (msg: string, ...args: unknown[]) => {
    console.log(`🔧[STT Worker] ${msg}`, ...args);
};

// === 헬퍼 함수 ===
function findPositiveWord(text: string): string | null {
    return POSITIVE_WORDS.find(word => text.includes(word)) || null;
}

function clearBatchTimer() {
    if (batchTimerId) {
        clearTimeout(batchTimerId);
        batchTimerId = null;
    }
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
}

function startBatchTimer() {
    clearBatchTimer();

    const countdown = BATCH_INTERVAL_MS / 1000;
    log(`⏱️ 타이머 시작: ${countdown}초`);

    let remaining = countdown;

    // 카운트다운 알림
    countdownIntervalId = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            self.postMessage({ type: 'COUNTDOWN_UPDATE', countdown: remaining } as WorkerOutMessage);
        }
    }, 1000);

    // 배치 전송
    batchTimerId = setTimeout(() => {
        clearInterval(countdownIntervalId!);
        countdownIntervalId = null;
        batchTimerId = null;

        if (speechQueue.length > 0) {
            log(`📤 배치 전송: ${speechQueue.length}개`, speechQueue);
            self.postMessage({ type: 'BATCH_READY', texts: [...speechQueue] } as WorkerOutMessage);
            speechQueue = [];
            self.postMessage({ type: 'QUEUE_UPDATE', count: 0, texts: [] } as WorkerOutMessage);
        }

        self.postMessage({ type: 'COUNTDOWN_UPDATE', countdown: 0 } as WorkerOutMessage);
    }, BATCH_INTERVAL_MS);

    // 초기 카운트다운 전송
    self.postMessage({ type: 'COUNTDOWN_UPDATE', countdown } as WorkerOutMessage);
}

function resetState() {
    log('🔄 상태 초기화');
    clearBatchTimer();
    speechQueue = [];
    isBoosterMode = false;
    self.postMessage({ type: 'QUEUE_UPDATE', count: 0, texts: [] } as WorkerOutMessage);
    self.postMessage({ type: 'COUNTDOWN_UPDATE', countdown: 0 } as WorkerOutMessage);
}

function processTranscript(text: string, isFinal: boolean, isCursed: boolean) {
    const cleanText = text.trim();
    if (!cleanText) return;

    // 트랜스크립트 업데이트 알림
    self.postMessage({ type: 'TRANSCRIPT_UPDATE', text: cleanText } as WorkerOutMessage);

    // 저주 상태일 때만 긍정어 체크
    if (isCursed) {
        const foundPositive = findPositiveWord(cleanText);
        if (foundPositive) {
            log(`💖 긍정어 감지: "${foundPositive}"`, { isBoosterMode, isCursed });
            self.postMessage({
                type: 'POSITIVE_DETECTED',
                word: foundPositive,
                isCursed: true
            } as WorkerOutMessage);
            return; // 긍정어 발견 시 배치 큐에 추가하지 않음
        }
    }

    // 최종 결과만 배치 큐에 추가
    if (isFinal) {
        speechQueue.push(cleanText);
        log(`📥 큐 추가: "${cleanText}" (총 ${speechQueue.length}개)`);

        self.postMessage({
            type: 'QUEUE_UPDATE',
            count: speechQueue.length,
            texts: [...speechQueue]
        } as WorkerOutMessage);

        // 타이머가 없으면 시작
        if (!batchTimerId) {
            startBatchTimer();
        }
    }
}

// === 메시지 핸들러 ===
self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
    const message = event.data;

    switch (message.type) {
        case 'PROCESS_TRANSCRIPT':
            processTranscript(message.text, message.isFinal, message.isCursed);
            break;

        case 'SET_BOOSTER_MODE':
            isBoosterMode = message.active;
            log(`부스터 모드: ${isBoosterMode ? 'ON 🟢' : 'OFF 🔴'}`);
            break;

        case 'RESET':
            resetState();
            break;

        default:
            log('⚠️ 알 수 없는 메시지 타입:', message);
    }
};

log('✅ Worker 초기화 완료');
