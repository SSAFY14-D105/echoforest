/**
 * useSttProcessor - STT 처리 훅 (Worker 연동)
 * 
 * 역할:
 * - useSpeechRecognition → SttWorkerService → useSttStore 연결
 * - useGameWebSocket이 GameWebSocket ↔ useGameStore 연결하는 패턴과 동일
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSttStore } from '../store/useSttStore';
import { useGameStore } from '../store/useGameStore';
import { sttWorkerService, type WorkerOutMessage } from '../socket/SttWorkerService';

// 로깅
const log = (msg: string, ...args: unknown[]) => console.log(`✅[STT] ${msg}`, ...args);

export interface UseSttProcessorReturn {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    boosterActive: boolean;
    curseState: {
        stack: number;
        cursedPlayer: string | null;
        isCollecting: boolean;
        queueCount: number;
        countdown: number;
    };
    setBoosterMode: (active: boolean) => void;
    restartListening: () => void;
}

export function useSttProcessor(): UseSttProcessorReturn {
    const {
        transcript,
        interimTranscript,
        isListening,
        startListening,
    } = useSpeechRecognition();

    const {
        isBoosterMode,
        boosterActive,
        curseState,
        setBoosterMode,
        setTranscript,
        onPositiveDetected,
        onQueueUpdate,
        onCountdownUpdate,
        onBatchReady,
        reset,
    } = useSttStore();

    const { isGameStarted, currentStage } = useGameStore();

    const lastProcessedRef = useRef('');
    const prevGameStartedRef = useRef(false);
    const prevStageRef = useRef<string | null>(null);
    const workerInitializedRef = useRef(false);

    // Worker 결과 핸들러
    const handleWorkerResult = useCallback((message: WorkerOutMessage) => {
        switch (message.type) {
            case 'POSITIVE_DETECTED':
                onPositiveDetected(message.word, message.isCursed);
                break;

            case 'QUEUE_UPDATE':
                onQueueUpdate(message.count, message.texts);
                break;

            case 'COUNTDOWN_UPDATE':
                onCountdownUpdate(message.countdown);
                break;

            case 'BATCH_READY':
                onBatchReady(message.texts);
                break;

            case 'TRANSCRIPT_UPDATE':
                setTranscript(message.text);
                break;
        }
    }, [onPositiveDetected, onQueueUpdate, onCountdownUpdate, onBatchReady, setTranscript]);

    // Worker 초기화 및 결과 핸들러 등록
    useEffect(() => {
        if (workerInitializedRef.current) return;

        log('🚀 Worker 초기화');
        sttWorkerService.initialize();
        const cleanup = sttWorkerService.onResult(handleWorkerResult);
        workerInitializedRef.current = true;

        return () => {
            cleanup();
            sttWorkerService.reset();
        };
    }, [handleWorkerResult]);

    // 부스터 모드 변경 시 Worker에 알림
    useEffect(() => {
        sttWorkerService.setBoosterMode(isBoosterMode);
    }, [isBoosterMode]);

    // 게임 시작/스테이지 변경 시 음성 인식 재시작 및 Worker 리셋
    useEffect(() => {
        const gameJustStarted = isGameStarted && !prevGameStartedRef.current;
        const stageChanged = currentStage !== prevStageRef.current && currentStage !== null;

        if (gameJustStarted || stageChanged) {
            log(`🎮 게임 상태 변경 감지 - 음성 인식 재시작`);
            log(`  └ isGameStarted: ${prevGameStartedRef.current} → ${isGameStarted}`);
            log(`  └ currentStage: ${prevStageRef.current} → ${currentStage}`);

            // Worker 상태 초기화
            sttWorkerService.reset();
            reset();

            // 약간의 딜레이 후 재시작 (상태 안정화 대기)
            setTimeout(() => {
                startListening();
            }, 500);
        }

        prevGameStartedRef.current = isGameStarted;
        prevStageRef.current = currentStage;
    }, [isGameStarted, currentStage, startListening, reset]);

    // 최종 결과 처리 → Worker로 전송
    useEffect(() => {
        if (transcript && transcript !== lastProcessedRef.current) {
            lastProcessedRef.current = transcript;

            sttWorkerService.processTranscript(
                transcript,
                true, // isFinal
                isBoosterMode,
                curseState.cursedPlayer !== null
            );
        }
    }, [transcript, isBoosterMode, curseState.cursedPlayer]);

    // 중간 결과 처리 → Worker로 전송 (부스터 모드에서 긍정어 감지용)
    useEffect(() => {
        if (interimTranscript) {
            sttWorkerService.processTranscript(
                interimTranscript,
                false, // isFinal
                isBoosterMode,
                curseState.cursedPlayer !== null
            );
        }
    }, [interimTranscript, isBoosterMode, curseState.cursedPlayer]);

    // 수동 재시작 함수
    const restartListening = useCallback(() => {
        log('🔄 수동 재시작 요청');
        startListening();
    }, [startListening]);

    // setBoosterMode를 Worker와 Store 모두에 적용
    const handleSetBoosterMode = useCallback((active: boolean) => {
        setBoosterMode(active);
        sttWorkerService.setBoosterMode(active);
    }, [setBoosterMode]);

    return {
        isListening,
        transcript,
        interimTranscript,
        boosterActive,
        curseState,
        setBoosterMode: handleSetBoosterMode,
        restartListening,
    };
}

export default useSttProcessor;
