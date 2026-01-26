// Web Speech API 래퍼
// 브라우저가 지원하는 Web Speech API를 사용한 음성 인식 훅
// Web Speech API를 React에서 안전하게 쓰기 위한 커스텀 훅
// (자동 재시작 + 중간 결과 + 타입 보강 + 수동/자동 중지 구분)
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
// https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API는 TypeScript에 기본 타입이 없어서 직접 정의
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
    isFinal: boolean; // ⭐ 최종 결과인지 여부
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

// 반환 타입
export interface UseSpeechRecognitionReturn {
    transcript: string;          // 최종 인식 결과
    interimTranscript: string;   // 중간 결과 (실시간)
    isListening: boolean;        // 듣는 중 여부
    isSupported: boolean;        // 브라우저 지원 여부
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

        // 1. 브라우저 호환성 (Chrome = SpeechRecognition, Safari = webkit 접두사)
        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionClass();
        // 2. 연속 듣기 모드 (true = 멈추지 않고 계속 듣기, false = 한 번 말하고 멈춤)
        recognition.continuous = true;
        // 3. 중간 결과 표시 (true = 실시간으로 중간 결과 표시, false = 최종 결과만 표시)
        recognition.interimResults = true;
        // 4. 한국어 설정
        recognition.lang = 'ko-KR';
        // 5. 최대 대안 개수 (1 = 가장 확률 높은 결과만 반환)
        recognition.maxAlternatives = 1;
        // 6. 음성 인식 시작 이벤트
        recognition.onstart = () => {
            console.log('🎤 음성 인식 시작');
            // isListening 상태 업데이트
            setIsListening(true);
            // 에러 상태 초기화
            setError(null);
        };

        // 7. 음성 인식 결과 이벤트
        recognition.onresult = (event: SpeechRecognitionEvent) => { // event: 음성 인식 결과 이벤트
            // 최종 결과 
            let finalTranscript = '';
            // 중간 결과
            let interimText = '';

            // 결과는 배열로 옴 (여러 문장 동시 인식 가능)
            for (let i = event.resultIndex; i < event.results.length; i++) { // resultIndex: 결과의 시작 인덱스, results.length: 결과의 개수
                // 결과
                const result = event.results[i];
                // 텍스트
                const text = result[0].transcript;
                // 최종 결과인지 확인 // isFinal: 최종 결과인지 여부 // transcript: 인식된 텍스트 // trim(): 공백 제거
                if (result.isFinal) {
                    // ⭐ 최종 결과: 사용자가 말 끝냄
                    finalTranscript += text.trim();
                } else {
                    // ⭐ 중간 결과: 사용자가 말하는 중 (실시간 업데이트)
                    interimText += text; // 중간 결과
                }
            }

            // 최종 결과 업데이트
            if (finalTranscript) {
                // ⭐ 최종 결과: 사용자가 말 끝냄
                setTranscript(finalTranscript);
                console.log('✅ 최종:', finalTranscript);
            }

            if (interimText) {
                // ⭐ 중간 결과: 사용자가 말하는 중 (실시간 업데이트)
                setInterimTranscript(interimText);
            }
        };

        // 8. 음성 인식 오류 이벤트
        recognition.onerror = (event) => {
            const errorMsg = event.error;

            // 'no-speech'는 무시 (타임아웃) // 사용자가 말을 하지 않았을 때
            if (errorMsg === 'no-speech') {
                console.log('⏸️ 음성 없음 (재시작 예정)');
                return;
            }

            // 'aborted'는 수동 중지 // 사용자가 음성 인식을 중지했을 때
            if (errorMsg === 'aborted') {
                console.log('⏹️ 음성 인식 중지됨');
                return;
            }

            // 그 외의 오류
            console.error('❌ 음성 인식 오류:', errorMsg);
            // 오류 상태 업데이트
            setError(errorMsg);
            // 듣는 중 상태 업데이트
            setIsListening(false);
        };

        // 9. 음성 인식 종료 이벤트
        // ⭐ 연속 듣기 모드: 음성 인식 종료 후 자동으로 재시작
        recognition.onend = () => {
            console.log('🔚 음성 인식 종료');
            setIsListening(false);
            setInterimTranscript('');

            // 수동 중지가 아니면 자동 재시작 (더 강력하게)
            // ⭐ isStoppedManuallyRef.current: 수동 중지 여부 // isSupported: 브라우저 지원 여부
            if (!isStoppedManuallyRef.current && isSupported) {
                console.log('🔄 음성 인식 자동 재시작 시도...');
                setTimeout(() => {
                    if (recognitionRef.current && !isStoppedManuallyRef.current) {
                        try {
                            recognitionRef.current.start();
                            console.log('🎤 음성 인식 재시작 성공');
                        } catch (e) {
                            console.log('재시작 실패, 500ms 후 재시도');
                            // 재시작 실패 시 한번 더 시도
                            setTimeout(() => {
                                if (recognitionRef.current && !isStoppedManuallyRef.current) {
                                    try {
                                        recognitionRef.current.start();
                                    } catch (e2) {
                                        console.error('재시작 최종 실패:', e2);
                                    }
                                }
                            }, 500);
                        }
                    }
                }, 300); // 더 빠르게 재시작 (1000ms → 300ms)
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
