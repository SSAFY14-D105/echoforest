/**
 * STT Worker 서비스 (싱글톤)
 * 
 * GameWebSocket, LiveKitService와 동일한 패턴:
 * - 싱글톤 인스턴스
 * - 콜백 기반 메시지 수신
 * - send() 메서드로 메시지 전송
 */

import type { WorkerInMessage, WorkerOutMessage } from '../workers/sttWorker';

type ResultHandler = (message: WorkerOutMessage) => void;

class SttWorkerService {
    private static instance: SttWorkerService | null = null;
    private worker: Worker | null = null;
    private resultHandlers: ResultHandler[] = [];

    private constructor() {
        // private constructor for singleton
    }

    /**
     * 싱글톤 인스턴스 획득
     */
    static getInstance(): SttWorkerService {
        if (!SttWorkerService.instance) {
            SttWorkerService.instance = new SttWorkerService();
        }
        return SttWorkerService.instance;
    }

    /**
     * Worker 초기화
     */
    initialize(): void {
        if (this.worker) {
            console.log('[SttWorkerService] Worker already initialized');
            return;
        }

        try {
            // Vite의 Worker import 방식 사용
            this.worker = new Worker(
                new URL('../workers/sttWorker.ts', import.meta.url),
                { type: 'module' }
            );

            this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
                console.log(`[SttWorkerService] 📩 Worker 메시지:`, event.data.type, `(핸들러 ${this.resultHandlers.length}개)`);
                this.resultHandlers.forEach(handler => handler(event.data));
            };

            this.worker.onerror = (error) => {
                console.error('[SttWorkerService] Worker error:', error);
            };

            console.log('[SttWorkerService] ✅ Worker initialized');
        } catch (error) {
            console.error('[SttWorkerService] Failed to initialize worker:', error);
        }
    }

    /**
     * 결과 핸들러 등록 (GameWebSocket.on() 패턴과 유사)
     */
    onResult(handler: ResultHandler): () => void {
        this.resultHandlers.push(handler);

        // cleanup 함수 반환
        return () => {
            this.resultHandlers = this.resultHandlers.filter(h => h !== handler);
        };
    }

    /**
     * Worker로 메시지 전송
     */
    send(message: WorkerInMessage): void {
        if (!this.worker) {
            console.warn('[SttWorkerService] Worker not initialized, initializing now...');
            this.initialize();
        }

        this.worker?.postMessage(message);
    }

    /**
     * 트랜스크립트 처리 요청
     */
    processTranscript(text: string, isFinal: boolean, isBoosterMode: boolean, isCursed: boolean): void {
        this.send({
            type: 'PROCESS_TRANSCRIPT',
            text,
            isFinal,
            isBoosterMode,
            isCursed
        });
    }

    /**
     * 부스터 모드 설정
     */
    setBoosterMode(active: boolean): void {
        this.send({ type: 'SET_BOOSTER_MODE', active });
    }

    /**
     * 상태 초기화
     */
    reset(): void {
        this.send({ type: 'RESET' });
    }

    /**
     * Worker 종료
     */
    disconnect(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            console.log('[SttWorkerService] Worker terminated');
        }
    }

    /**
     * Worker 활성 상태 확인
     */
    isActive(): boolean {
        return this.worker !== null;
    }
}

// 싱글톤 인스턴스 export
export const sttWorkerService = SttWorkerService.getInstance();

// 타입 export
export { SttWorkerService };
export type { WorkerInMessage, WorkerOutMessage };
