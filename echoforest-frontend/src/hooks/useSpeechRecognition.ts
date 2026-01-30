/**
 * Web Speech API 래퍼 커스텀 훅
 * 
 * - 최종 결과만 로깅 (중간 결과 로그 제거)
 * - 통일된 ✅[STT] 접두사
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API 타입 정의
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: Event & { error: string }) => void) | null;
    onstart: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export interface UseSpeechRecognitionReturn {
    transcript: string;
    interimTranscript: string;
    isListening: boolean;
    isSupported: boolean;
    error: string | null;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
}

// 재시작 관련 상수
const RESTART_DELAY_BASE = 300;
const RESTART_DELAY_MAX = 5000;
const RESTART_BACKOFF_FACTOR = 1.5;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const isStoppedManuallyRef = useRef(false);
    const restartAttemptRef = useRef(0);
    const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // 재시작 함수
    const attemptRestart = useCallback(() => {
        if (isStoppedManuallyRef.current || !recognitionRef.current) {
            return;
        }

        const delay = Math.min(
            RESTART_DELAY_BASE * Math.pow(RESTART_BACKOFF_FACTOR, restartAttemptRef.current),
            RESTART_DELAY_MAX
        );

        restartTimeoutRef.current = setTimeout(() => {
            if (isStoppedManuallyRef.current || !recognitionRef.current) {
                return;
            }

            try {
                recognitionRef.current.start();
                restartAttemptRef.current = 0;
            } catch (e: any) {
                if (e.message?.includes('already started')) {
                    restartAttemptRef.current = 0;
                    return;
                }
                restartAttemptRef.current++;
                attemptRestart();
            }
        }, delay);
    }, []);

    const cleanup = useCallback(() => {
        if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = null;
        }
    }, []);

    // 초기화
    useEffect(() => {
        if (!isSupported) {
            console.error('브라우저가 음성 인식을 지원하지 않습니다');
            setError('이 브라우저는 음성 인식을 지원하지 않습니다.');
            return;
        }


        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionClass();

        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'ko-KR';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
            restartAttemptRef.current = 0;
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interimText = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0].transcript;

                if (result.isFinal) {
                    // 최종 결과만 로깅
                    finalTranscript += text.trim();
                } else {
                    // 중간 결과는 로그 없이 상태만 업데이트
                    interimText += text;
                }
            }

            if (finalTranscript) {
                setTranscript(finalTranscript);
            }

            if (interimText) {
                setInterimTranscript(interimText);
            }
        };

        recognition.onerror = (event) => {
            const errorMsg = event.error;

            switch (errorMsg) {
                case 'no-speech':
                    // 침묵은 정상 - 로그 안 찍음
                    break;
                case 'aborted':
                    break;
                case 'audio-capture':
                    setError('마이크에 접근할 수 없습니다.');
                    break;
                case 'network':
                    console.warn('네트워크 오류 - 재시작 시도');
                    break;
                case 'not-allowed':
                    console.error('마이크 권한 거부됨');
                    setError('마이크 권한이 거부되었습니다.');
                    isStoppedManuallyRef.current = true;
                    setIsListening(false);
                    return;
                case 'service-not-allowed':
                    console.error('음성 인식 서비스 불가');
                    setError('음성 인식 서비스를 사용할 수 없습니다.');
                    isStoppedManuallyRef.current = true;
                    setIsListening(false);
                    return;
                default:
                    console.error(`오류: ${errorMsg}`);
                    setError(errorMsg);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimTranscript('');

            if (!isStoppedManuallyRef.current) {
                attemptRestart();
            }
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch (e) {
            attemptRestart();
        }

        return () => {
            cleanup();
            isStoppedManuallyRef.current = true;
            recognition.abort();
        };
    }, []);

    const startListening = useCallback(() => {
        if (!recognitionRef.current || !isSupported) return;

        console.info('수동 시작');
        cleanup();
        isStoppedManuallyRef.current = false;
        restartAttemptRef.current = 0;

        try {
            recognitionRef.current.start();
        } catch (e: any) {
            if (!e.message?.includes('already started')) {
                attemptRestart();
            }
        }
    }, [isSupported, cleanup, attemptRestart]);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return;

        console.info('수동 중지');
        cleanup();
        isStoppedManuallyRef.current = true;
        recognitionRef.current.stop();
    }, [cleanup]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        transcript,
        interimTranscript,
        isListening,
        isSupported,
        error,
        startListening,
        stopListening,
        resetTranscript,
    };
}

export default useSpeechRecognition;
