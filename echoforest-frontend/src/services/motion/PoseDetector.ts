/**
 * 포즈 감지 로직
 * 손 랜드마크를 분석하여 제스처를 판정합니다.
 * 
 * 📌 손가락 인덱스 맵:
 *    엄지: TIP=4, PIP=3, MCP=2
 *    검지: TIP=8, PIP=7, MCP=5
 *    중지: TIP=12, PIP=11, MCP=9
 *    약지: TIP=16, PIP=15, MCP=13
 *    새끼: TIP=20, PIP=19, MCP=17
 *    손목: 0
 */

import type { HandLandmark, PoseDetectionResult } from './types';

// MediaPipe Hand Landmark 인덱스
const LANDMARKS = {
    WRIST: 0,
    // 엄지
    THUMB_TIP: 4,
    THUMB_IP: 3,
    THUMB_MCP: 2,
    // 검지
    INDEX_TIP: 8,
    INDEX_PIP: 7,
    INDEX_MCP: 5,
    // 중지
    MIDDLE_TIP: 12,
    MIDDLE_PIP: 11,
    MIDDLE_MCP: 9,
    // 약지
    RING_TIP: 16,
    RING_PIP: 15,
    RING_MCP: 13,
    // 새끼
    PINKY_TIP: 20,
    PINKY_PIP: 19,
    PINKY_MCP: 17,
} as const;

/**
 * 두 점 사이의 거리 계산
 */
function distance(p1: HandLandmark, p2: HandLandmark): number {
    return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
    );
}

/**
 * 손가락이 접혀 있는지 확인
 * 원리: 손가락 끝이 뿌리(MCP)보다 손목에 가까우면 접힘
 */
function isFingerClosed(
    landmarks: HandLandmark[],
    tipIdx: number,
    mcpIdx: number
): boolean {
    const wrist = landmarks[LANDMARKS.WRIST];
    const tip = landmarks[tipIdx];
    const mcp = landmarks[mcpIdx];

    // 끝이 뿌리보다 손목에 가까우면 접힘
    return distance(tip, wrist) < distance(mcp, wrist) * 1.1;
}

/**
 * 손가락이 펴져 있는지 확인
 * 원리: 손가락 끝이 중간마디(PIP)보다 손목에서 멀면 펴짐
 */
function isFingerExtended(
    landmarks: HandLandmark[],
    tipIdx: number,
    pipIdx: number
): boolean {
    const wrist = landmarks[LANDMARKS.WRIST];
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];

    return distance(tip, wrist) > distance(pip, wrist);
}

/**
 * ✊ 주먹 감지
 * 조건: 5개 손가락이 모두 접혀 있음
 */
export function detectFist(landmarks: HandLandmark[]): number {
    if (landmarks.length < 21) return 0;

    const fingersClosed = [
        isFingerClosed(landmarks, LANDMARKS.THUMB_TIP, LANDMARKS.THUMB_MCP),
        isFingerClosed(landmarks, LANDMARKS.INDEX_TIP, LANDMARKS.INDEX_MCP),
        isFingerClosed(landmarks, LANDMARKS.MIDDLE_TIP, LANDMARKS.MIDDLE_MCP),
        isFingerClosed(landmarks, LANDMARKS.RING_TIP, LANDMARKS.RING_MCP),
        isFingerClosed(landmarks, LANDMARKS.PINKY_TIP, LANDMARKS.PINKY_MCP),
    ];

    const closedCount = fingersClosed.filter(Boolean).length;

    // 4개 이상 접히면 주먹
    if (closedCount >= 5) return 0.95;
    if (closedCount >= 4) return 0.8;
    if (closedCount >= 3) return 0.5;

    return 0;
}

/**
 * 👌 OK/동그라미 감지
 * 조건: 엄지 끝과 검지 끝이 가까이 붙어 있음
 */
export function detectOkSign(landmarks: HandLandmark[]): number {
    if (landmarks.length < 21) return 0;

    const thumbTip = landmarks[LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[LANDMARKS.INDEX_TIP];
    const wrist = landmarks[LANDMARKS.WRIST];
    const middleMcp = landmarks[LANDMARKS.MIDDLE_MCP];

    // 손바닥 크기 (정규화용)
    const palmSize = distance(wrist, middleMcp);

    // 엄지-검지 끝 거리
    const tipDistance = distance(thumbTip, indexTip);
    const normalizedDist = tipDistance / palmSize;

    // 거리가 가까우면 OK
    if (normalizedDist < 0.15) return 0.95;
    if (normalizedDist < 0.25) return 0.8;
    if (normalizedDist < 0.35) return 0.6;

    return 0;
}

/**
 * 💖 손하트 감지 (개선 버전)
 * 조건: 엄지+검지 끝이 붙고, 나머지 손가락은 펴짐
 */
export function detectHandHeart(landmarks: HandLandmark[]): number {
    if (landmarks.length < 21) return 0;

    // 1. OK 사인 점수 (엄지-검지 붙음)
    const okScore = detectOkSign(landmarks);
    if (okScore < 0.6) return 0;

    // 2. 나머지 손가락이 펴져 있는지 확인
    const middleExtended = isFingerExtended(
        landmarks,
        LANDMARKS.MIDDLE_TIP,
        LANDMARKS.MIDDLE_PIP
    );
    const ringExtended = isFingerExtended(
        landmarks,
        LANDMARKS.RING_TIP,
        LANDMARKS.RING_PIP
    );
    const pinkyExtended = isFingerExtended(
        landmarks,
        LANDMARKS.PINKY_TIP,
        LANDMARKS.PINKY_PIP
    );

    const extendedCount = [middleExtended, ringExtended, pinkyExtended].filter(
        Boolean
    ).length;

    // OK + 3개 펴짐 = 손하트
    if (okScore >= 0.8 && extendedCount >= 3) return 0.95;
    if (okScore >= 0.6 && extendedCount >= 2) return 0.7;

    return 0;
}

/**
 * 포즈 판정 메인 함수
 * 우선순위: 주먹 > OK > 손하트
 */
export function detectPose(landmarks: HandLandmark[]): PoseDetectionResult {
    // 1. 주먹 체크
    const fistScore = detectFist(landmarks);
    if (fistScore >= 0.7) {
        return {
            type: 'fist',
            confidence: fistScore,
            timestamp: Date.now(),
        };
    }

    // 2. OK 사인 체크
    const okScore = detectOkSign(landmarks);
    if (okScore >= 0.7) {
        return {
            type: 'ok_sign',
            confidence: okScore,
            timestamp: Date.now(),
        };
    }

    // 3. 손하트 체크 (OK + 다른 손가락 펴짐)
    const heartScore = detectHandHeart(landmarks);
    if (heartScore >= 0.7) {
        return {
            type: 'hand_heart',
            confidence: heartScore,
            timestamp: Date.now(),
        };
    }

    return {
        type: 'none',
        confidence: 0,
        timestamp: Date.now(),
    };
}
