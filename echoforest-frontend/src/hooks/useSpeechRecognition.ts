import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API 타입 선언
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

/**
 * Web Speech API 래퍼 커스텀 훅
 * 
 * - 연속 듣기 모드 (continuous: true)
 * - 중간 결과 표시 (interimResults: true)
 * - 한국어 설정 (lang: 'ko-KR')
 * - 자동 재시작 (onend에서 1초 후 재시작)
 */
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const isStoppedManuallyRef = useRef(false);

    // 브라우저 지원 여부
    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // 초기화
    useEffect(() => {
        if (!isSupported) {
            setError('이 브라우저는 음성 인식을 지원하지 않습니다.');
            return;
        }

        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionClass();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ko-KR';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('🎤 음성 인식 시작');
            setIsListening(true);
            setError(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interimText = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0].transcript;

                if (result.isFinal) {
                    finalTranscript += text.trim();
                } else {
                    interimText += text;
                }
            }

            if (finalTranscript) {
                setTranscript(finalTranscript);
                console.log('✅ 최종:', finalTranscript);
            }

            if (interimText) {
                setInterimTranscript(interimText);
            }
        };

        recognition.onerror = (event) => {
            const errorMsg = event.error;

            // 'no-speech'는 무시 (타임아웃)
            if (errorMsg === 'no-speech') {
                console.log('⏸️ 음성 없음 (재시작 예정)');
                return;
            }

            // 'aborted'는 수동 중지
            if (errorMsg === 'aborted') {
                console.log('⏹️ 음성 인식 중지됨');
                return;
            }

            console.error('❌ 음성 인식 오류:', errorMsg);
            setError(errorMsg);
            setIsListening(false);
        };

        recognition.onend = () => {
            console.log('🔚 음성 인식 종료');
            setIsListening(false);
            setInterimTranscript('');

            // 수동 중지가 아니면 자동 재시작
            if (!isStoppedManuallyRef.current && isSupported) {
                setTimeout(() => {
                    if (recognitionRef.current && !isStoppedManuallyRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            console.log('재시작 실패:', e);
                        }
                    }
                }, 1000);
            }
        };

        recognitionRef.current = recognition;

        // 자동 시작
        try {
            recognition.start();
        } catch (e) {
            console.log('초기 시작 실패:', e);
        }

        return () => {
            isStoppedManuallyRef.current = true;
            recognition.abort();
        };
    }, [isSupported]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current || !isSupported) return;

        isStoppedManuallyRef.current = false;
        try {
            recognitionRef.current.start();
        } catch (e) {
            console.log('시작 실패:', e);
        }
    }, [isSupported]);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return;

        isStoppedManuallyRef.current = true;
        recognitionRef.current.stop();
    }, []);

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
