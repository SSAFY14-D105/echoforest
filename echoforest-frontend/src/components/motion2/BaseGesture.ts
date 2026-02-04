/**
 * 기본 제스처 클래스 (인터페이스)
 * 모든 제스처 감지 모듈은 이 클래스를 상속받아야 합니다.
 */

import { Landmark } from '../../utils/gesture-helpers';

export interface GestureMetadata {
    palmSize: number;
    aspectRatio?: number;
    allHands?: any[]; // MediaPipe 결과 원본
    faceLandmarks?: any; // 얼굴 인식 결과 (선택적)
    faceSize?: number;
}

export interface GestureResult {
    detected: boolean;
    score: number;
    label?: string; // 제스처 이름
    emoji?: string; // 이모지
    extra?: any;    // 추가 데이터 (각도, 거리 등)
    left?: GestureResult;  // 왼쪽 볼 (CheekHeart, BothCheekPoke용)
    right?: GestureResult; // 오른쪽 볼 (CheekHeart, BothCheekPoke용)
}

export default class BaseGesture {
    config: any;
    label?: string;
    emoji?: string;

    constructor(config: any = {}) {
        this.config = config;
    }

    /**
     * 제스처 감지 메서드
     * @param landmarks MediaPipe 손 랜드마크 (0~20)
     * @param metadata 추가 정보 (손바닥 크기 등)
     */
    check(_landmarks: Landmark[], _metadata: GestureMetadata): GestureResult {
        throw new Error("check() method must be implemented");
    }

    /**
     * 두 점 사이의 거리 계산 (3D)
     */
    distance(p1: Landmark, p2: Landmark): number {
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) +
            Math.pow(p1.y - p2.y, 2) +
            Math.pow((p1.z || 0) - (p2.z || 0), 2)
        );
    }

    /**
     * 손가락 펴짐 여부 확인
     */
    isFingerExtended(landmarks: Landmark[], tipIdx: number, pipIdx: number, threshold: number = 1.0): boolean {
        const wrist = landmarks[0];
        return this.distance(landmarks[tipIdx], wrist) > this.distance(landmarks[pipIdx], wrist) * threshold;
    }

    /**
     * 손가락 접힘 여부 확인
     */
    isFingerClosed(landmarks: Landmark[], tipIdx: number, mcpIdx: number, threshold: number = 1.0): boolean {
        const wrist = landmarks[0];
        return this.distance(landmarks[tipIdx], wrist) < this.distance(landmarks[mcpIdx], wrist) * threshold;
    }
}
