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

export interface UseSttProcessorReturn {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    curseState: {
        stack: number;
        cursedPlayers: string[];
        isCollecting: boolean;
        queueCount: number;
        countdown: number;
    };
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
        curseState,
        setTranscript,
        onPositiveDetected,
        onQueueUpdate,
        onCountdownUpdate,
        onBatchReady,
        reset,
    } = useSttStore();

    const { isGameStarted, currentStage, players, nickname, isSoloMode } = useGameStore();

    // 로컬 플레이어의 저주 상태 확인 (버섯 저주 포함)
    const localPlayer = players.find(p => p.nickname === nickname);
    const hasIndividualCurse = (localPlayer?.curses?.length ?? 0) > 0;
    const isCursed = curseState.cursedPlayers.length > 0 || hasIndividualCurse;

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

    // Worker 초기화 (한 번만)
    useEffect(() => {
        if (workerInitializedRef.current) return;

        // console.log('[STT Processor] Worker 초기화');
        sttWorkerService.initialize();
        workerInitializedRef.current = true;

        return () => {
            sttWorkerService.reset();
        };
    }, []);

    // STT 시작 - LiveKit보다 먼저 실행하여 마이크 접근권 확보
    // Web Speech API가 먼저 마이크에 접근하면 LiveKit이 공유받을 수 있음
    // STT 시작 - LiveKit과 충돌 방지 및 솔로 모드 제외
    useEffect(() => {
        // [FIX] 대기실 및 솔로 모드에서는 STT 시작 안 함
        // 게임이 시작되었고, 멀티플레이 모드일 때만 STT 시작
        if (isGameStarted && !isSoloMode) {
            // console.log('[STT Processor] 게임 시작됨 (멀티플레이) - STT 시작');
            startListening();
        } else {
            // 게임이 아니거나 솔로 모드면 중지 (혹시 켜져 있을 경우)
            // console.log('[STT Processor] STT 대기 (대기실 or 솔로모드)');
            // stopListening(); // 필요 시 호출, but startListening을 안 부르면 됨
        }
    }, [isGameStarted, isSoloMode, startListening]);

    // 결과 핸들러 등록 (handleWorkerResult 변경 시 재등록)
    useEffect(() => {
        const cleanup = sttWorkerService.onResult(handleWorkerResult);
        return cleanup;
    }, [handleWorkerResult]);

    // 게임 시작/스테이지 변경 시 Worker 리셋만 수행 (STT는 이미 실행 중)
    useEffect(() => {
        const gameJustStarted = isGameStarted && !prevGameStartedRef.current;
        const stageChanged = currentStage !== prevStageRef.current && currentStage !== null;

        if (gameJustStarted || stageChanged) {
            // Worker 상태 초기화
            sttWorkerService.reset();
            reset();
            // [FIX] startListening 중복 호출 제거 - 이미 초기화 useEffect에서 실행됨
            // 불필요한 재시작이 aborted 에러의 원인이었음
        }

        prevGameStartedRef.current = isGameStarted;
        prevStageRef.current = currentStage;
    }, [isGameStarted, currentStage, reset]);

    // 최종 결과 처리 → Worker로 전송
    useEffect(() => {
        if (transcript && transcript !== lastProcessedRef.current) {
            lastProcessedRef.current = transcript;

            sttWorkerService.processTranscript(
                transcript,
                true, // isFinal
                isCursed
            );
        }
    }, [transcript, isCursed]);

    // 중간 결과 처리 → Worker로 전송 (저주 상태에서 긍정어 감지용)
    useEffect(() => {
        if (interimTranscript) {
            sttWorkerService.processTranscript(
                interimTranscript,
                false, // isFinal
                isCursed
            );
        }
    }, [interimTranscript, isCursed]);

    // 수동 재시작 함수
    const restartListening = useCallback(() => {
        startListening();
    }, [startListening]);

    return {
        isListening,
        transcript,
        interimTranscript,
        curseState,
        restartListening,
    };
}

export default useSttProcessor;
