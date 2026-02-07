/**
 * Web Speech API 래퍼 커스텀 훅 (싱글톤 패턴 + 빠른 재시작)
 * 
 * - SpeechRecognition 인스턴스를 모듈 레벨에서 관리 (재마운트 시에도 재사용)
 * - aborted 에러 시 즉시 재시작 (지연 없음)
 * - 로그 최소화
 */

import { useState, useEffect, useCallback } from 'react';

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
    onaudiostart: (() => void) | null;
    onsoundstart: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
    onsoundend: (() => void) | null;
    onaudioend: (() => void) | null;
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

// ========================================
// [싱글톤] 모듈 레벨 SpeechRecognition 인스턴스
// ========================================
let globalRecognition: SpeechRecognition | null = null;
let globalIsListening = false;
let globalIsStoppedManually = false;
let globalRestartTimeout: ReturnType<typeof setTimeout> | null = null;
let lastAbortedTime = 0;

// 이벤트 콜백들
let onTranscriptCallback: ((final: string, interim: string) => void) | null = null;
let onStateChangeCallback: ((listening: boolean, error: string | null) => void) | null = null;

// 지원 여부 확인
const isSTTSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

// 글로벌 인스턴스 초기화
function initGlobalRecognition() {
    if (globalRecognition || !isSTTSupported) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    globalRecognition = new SpeechRecognitionClass();

    // console.log('[STT] 글로벌 SpeechRecognition 인스턴스 생성');

    globalRecognition.continuous = true;
    globalRecognition.interimResults = true;
    globalRecognition.lang = 'ko-KR';
    globalRecognition.maxAlternatives = 1;

    globalRecognition.onstart = () => {
        globalIsListening = true;
        // console.log('[STT] ✅ 음성 인식 시작됨 - 마이크 사용 중');
        onStateChangeCallback?.(true, null);
    };

    // 오디오 스트림 이벤트 로깅 (디버깅용)
    globalRecognition.onaudiostart = () => {
        // console.log('[STT] 🎤 오디오 스트림 시작 - 마이크 입력 감지');
    };
    globalRecognition.onaudioend = () => {
        // console.log('[STT] 🎤 오디오 스트림 종료');
    };
    globalRecognition.onspeechstart = () => {
        // console.log('[STT] 🗣️ 음성 감지 시작');
    };
    globalRecognition.onspeechend = () => {
        // console.log('[STT] 🗣️ 음성 감지 종료');
    };

    globalRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0].transcript;

            if (result.isFinal) {
                finalTranscript += text.trim();
                // console.log('[STT] 인식:', text.trim());
            } else {
                interimText += text;
            }
        }

        onTranscriptCallback?.(finalTranscript, interimText);
    };

    globalRecognition.onerror = (event) => {
        const errorMsg = event.error;
        console.error(`[STT] ❌ 에러 발생:`, errorMsg);

        switch (errorMsg) {
            case 'no-speech':
                // console.warn('[STT] ⚠️ 음성이 감지되지 않았습니다 (말을 하지 않음)');
                break;
            case 'aborted':
                console.error('[STT] 🚫 ABORTED - 인식이 즉시 중단됨 (마이크 접근 실패 가능성)');
                console.error('[STT] 다른 앱/탭이 마이크를 사용 중이거나 권한 문제일 수 있습니다');
                // [DEBUG] 자동 재시작 중단 - 무한 루프 방지
                globalIsStoppedManually = true;
                onStateChangeCallback?.(false, '마이크 접근 실패 - 다른 앱이 마이크를 사용 중이거나 권한이 없습니다');
                return;
            case 'audio-capture':
                console.error('[STT] 🚫 마이크 접근 불가 - 마이크가 연결되어 있는지 확인하세요');
                onStateChangeCallback?.(false, '마이크에 접근할 수 없습니다.');
                break;
            case 'not-allowed':
                console.error('[STT] 🚫 마이크 권한 거부됨 - 브라우저 설정에서 마이크 권한을 허용해주세요');
                globalIsStoppedManually = true;
                onStateChangeCallback?.(false, '마이크 권한이 거부되었습니다.');
                return;
            case 'service-not-allowed':
                console.error('[STT] 🚫 음성 인식 서비스 불가 - HTTPS 연결이 필요합니다');
                globalIsStoppedManually = true;
                onStateChangeCallback?.(false, '음성 인식 서비스를 사용할 수 없습니다.');
                return;
            case 'network':
                console.error('[STT] 🌐 네트워크 오류 - 인터넷 연결을 확인하세요');
                break;
            default:
            // console.warn(`[STT] ⚠️ 알 수 없는 오류: ${errorMsg}`);
        }
    };

    globalRecognition.onend = () => {
        globalIsListening = false;

        if (!globalIsStoppedManually) {
            // 즉시 재시작 (지연 최소화)
            immediateRestart();
        } else {
            onStateChangeCallback?.(false, null);
        }
    };
}

// 즉시 재시작 (aborted 후 빠른 복구)
function immediateRestart() {
    if (globalIsStoppedManually || !globalRecognition) {
        return;
    }

    // 너무 빠른 재시작 방지 (100ms 쿨다운)
    const now = Date.now();
    const timeSinceLastAbort = now - lastAbortedTime;
    lastAbortedTime = now;

    const delay = timeSinceLastAbort < 100 ? 100 : 50; // 50ms 또는 100ms 후 재시작

    if (globalRestartTimeout) {
        clearTimeout(globalRestartTimeout);
    }

    globalRestartTimeout = setTimeout(() => {
        if (globalIsStoppedManually || !globalRecognition) {
            return;
        }

        try {
            globalRecognition.start();
        } catch (e: any) {
            if (!e.message?.includes('already started')) {
                // 실패하면 조금 더 기다렸다가 재시도
                setTimeout(() => immediateRestart(), 200);
            }
        }
    }, delay);
}

// 글로벌 시작
function startGlobalListening() {
    if (!globalRecognition) {
        initGlobalRecognition();
    }
    if (!globalRecognition || !isSTTSupported) {
        console.error('[STT] startListening 실패: 지원 안됨');
        return;
    }

    if (globalRestartTimeout) {
        clearTimeout(globalRestartTimeout);
        globalRestartTimeout = null;
    }

    globalIsStoppedManually = false;

    try {
        globalRecognition.start();
        // console.log('[STT] 시작');
    } catch (e: any) {
        if (!e.message?.includes('already started')) {
            immediateRestart();
        } else {
            globalIsListening = true;
            onStateChangeCallback?.(true, null);
        }
    }
}

// 글로벌 정지
function stopGlobalListening() {
    if (!globalRecognition) return;

    // console.log('[STT] 수동 중지');
    if (globalRestartTimeout) {
        clearTimeout(globalRestartTimeout);
        globalRestartTimeout = null;
    }

    globalIsStoppedManually = true;
    globalRecognition.stop();
}

// ========================================
// React Hook
// ========================================
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isListening, setIsListening] = useState(globalIsListening);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // console.log('[STT] useSpeechRecognition 훅 마운트');

        if (!globalRecognition) {
            initGlobalRecognition();
        }

        onTranscriptCallback = (final, interim) => {
            if (final) setTranscript(final);
            if (interim) setInterimTranscript(interim);
            else setInterimTranscript('');
        };

        onStateChangeCallback = (listening, err) => {
            setIsListening(listening);
            if (err !== null) setError(err);
            if (!listening) setInterimTranscript('');
        };

        setIsListening(globalIsListening);

        return () => {
            onTranscriptCallback = null;
            onStateChangeCallback = null;
        };
    }, []);

    const startListening = useCallback(() => {
        startGlobalListening();
    }, []);

    const stopListening = useCallback(() => {
        stopGlobalListening();
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        transcript,
        interimTranscript,
        isListening,
        isSupported: isSTTSupported,
        error,
        startListening,
        stopListening,
        resetTranscript,
    };
}

export default useSpeechRecognition;
