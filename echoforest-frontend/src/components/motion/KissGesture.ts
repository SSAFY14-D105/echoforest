/**
 * KissGesture - 뽀뽀 제스처 감지 클래스
 * MediaPipe FaceLandmarker 기반 입술 오므림 감지
 */
import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';

// MediaPipe Face Landmark 인덱스 (입술 관련)
const FACE_LANDMARKS = {
    UPPER_LIP: 13,     // 상순 중앙
    LOWER_LIP: 14,     // 하순 중앙
    LEFT_LIP: 61,      // 왼쪽 입꼬리
    RIGHT_LIP: 291,    // 오른쪽 입꼬리
};

export default class KissGesture extends BaseGesture {
    thresholds: any;
    label: string;
    emoji: string;

    constructor() {
        super();
        this.label = '뽀뽀 💋';
        this.emoji = '💋';

        // 기본 임계값 설정
        this.thresholds = {
            ratioHigh: 0.6,        // 높은 확신도 비율 (Kiss는 입이 동그랗게 됨 -> 비율 높음)
            ratioMedium: 0.4,      // 중간 확신도 비율
            horizontalHigh: 0.12,  // 가로 폭 (작을수록 오므림)
            horizontalMedium: 0.15
        };
    }

    /**
     * 뽀뽀 제스처 감지
     * @param landmarks 사용 안함
     * @param metadata FaceLandmarks 포함
     */
    check(landmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks; // [FIX] Extract from metadata

        // 얼굴이 감지되지 않은 경우
        if (!faceLandmarks || faceLandmarks.length === 0) {
            return {
                detected: false,
                score: 0
            };
        }

        const face = faceLandmarks; // Already passed as faceLandmarks array usually? No, metadata.faceLandmarks is the array.

        // 입술 랜드마크 추출
        // faceLandmarks is array of points {x, y, z}
        const upperLip = face[FACE_LANDMARKS.UPPER_LIP];
        const lowerLip = face[FACE_LANDMARKS.LOWER_LIP];
        const leftLip = face[FACE_LANDMARKS.LEFT_LIP];
        const rightLip = face[FACE_LANDMARKS.RIGHT_LIP];

        // 랜드마크가 없는 경우
        if (!upperLip || !lowerLip || !leftLip || !rightLip) {
            return {
                detected: false,
                score: 0
            };
        }

        // 입술 거리 계산
        const verticalDist = this.distance(upperLip, lowerLip);
        const horizontalDist = this.distance(leftLip, rightLip);
        const ratio = verticalDist / horizontalDist;

        let score = 0;
        let detected = false;

        // 높은 확신도
        if (ratio > this.thresholds.ratioHigh &&
            horizontalDist < this.thresholds.horizontalHigh) {
            score = 0.95;
            detected = true;
        }
        // 중간 확신도
        else if (ratio > this.thresholds.ratioMedium &&
            horizontalDist < this.thresholds.horizontalMedium) {
            score = 0.75;
            detected = true;
        }

        return {
            detected,
            score,
            label: this.label
        };
    }
}
