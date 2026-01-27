/**
 * useSttProcessor - STT 텍스트 처리 훅
 * 
 * - 게임 시작 시 음성 인식 재시작 지원
 * - 최종 결과(transcript) 처리
 * - 중간 결과(interimTranscript) 처리 (부스터 모드 긍정어 감지)
 */

import { useEffect, useRef } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSttStore } from '../store/useSttStore';
import { useGameStore } from '../store/useGameStore';

// 로깅
const log = (msg: string, ...args: any[]) => console.log(`✅[STT] ${msg}`, ...args);

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
    restartListening: () => void;  // 수동 재시작 함수 노출
}

export function useSttProcessor(): UseSttProcessorReturn {
    const {
        transcript,
        interimTranscript,
        isListening,
        startListening,
        // stopListening - 필요 시 사용
    } = useSpeechRecognition();

    const {
        setBoosterMode,
        boosterActive,
        curseState,
        processTranscript,
    } = useSttStore();

    const { isGameStarted, currentStage } = useGameStore();

    const lastProcessedRef = useRef('');
    const prevGameStartedRef = useRef(false);
    const prevStageRef = useRef<string | null>(null);

    // 게임 시작/스테이지 변경 시 음성 인식 재시작
    useEffect(() => {
        const gameJustStarted = isGameStarted && !prevGameStartedRef.current;
        const stageChanged = currentStage !== prevStageRef.current && currentStage !== null;

        if (gameJustStarted || stageChanged) {
            log(`🎮 게임 상태 변경 감지 - 음성 인식 재시작`);
            log(`  └ isGameStarted: ${prevGameStartedRef.current} → ${isGameStarted}`);
            log(`  └ currentStage: ${prevStageRef.current} → ${currentStage}`);

            // 약간의 딜레이 후 재시작 (상태 안정화 대기)
            setTimeout(() => {
                startListening();
            }, 500);
        }

        prevGameStartedRef.current = isGameStarted;
        prevStageRef.current = currentStage;
    }, [isGameStarted, currentStage, startListening]);

    // 최종 결과 처리
    useEffect(() => {
        if (transcript && transcript !== lastProcessedRef.current) {
            lastProcessedRef.current = transcript;
            processTranscript(transcript, true);
        }
    }, [transcript, processTranscript]);

    // 중간 결과 처리 (부스터 모드에서 긍정어 감지용)
    useEffect(() => {
        if (interimTranscript) {
            processTranscript(interimTranscript, false);
        }
    }, [interimTranscript, processTranscript]);

    // 수동 재시작 함수
    const restartListening = () => {
        log('🔄 수동 재시작 요청');
        startListening();
    };

    return {
        isListening,
        transcript,
        interimTranscript,
        boosterActive,
        curseState,
        setBoosterMode,
        restartListening,
    };
}

export default useSttProcessor;
