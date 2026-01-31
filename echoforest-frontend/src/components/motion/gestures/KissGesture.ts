import BaseGesture, { GestureResult, GestureMetadata } from './BaseGesture';
import { distance, Landmark } from '../../../utils/gesture-helpers';

// MediaPipe Face Landmark 인덱스 (입술 관련)
const FACE_LANDMARKS = {
    UPPER_LIP: 13,     // 상순 중앙
    LOWER_LIP: 14,     // 하순 중앙
    LEFT_LIP: 61,      // 왼쪽 입꼬리
    RIGHT_LIP: 291,    // 오른쪽 입꼬리
};

export default class KissGesture extends BaseGesture {
    private thresholds: any;

    constructor() {
        super();
        this.label = 'kiss';
        this.emoji = '💋';

        this.thresholds = {
            ratioHigh: 0.6,
            ratioMedium: 0.4,
            horizontalHigh: 0.12,
            horizontalMedium: 0.15
        };
    }

    // BaseGesture check 메서드 오버라이드
    // 원래 detect(faceLandmarks)였지만, check(landmarks, metadata)로 통일
    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const face = metadata.faceLandmarks; // 단일 얼굴

        if (!face || face.length < 300) {
            return { detected: false, score: 0 };
        }

        const upperLip = face[FACE_LANDMARKS.UPPER_LIP];
        const lowerLip = face[FACE_LANDMARKS.LOWER_LIP];
        const leftLip = face[FACE_LANDMARKS.LEFT_LIP];
        const rightLip = face[FACE_LANDMARKS.RIGHT_LIP];

        if (!upperLip || !lowerLip || !leftLip || !rightLip) {
            return { detected: false, score: 0 };
        }

        const verticalDist = distance(upperLip, lowerLip);
        const horizontalDist = distance(leftLip, rightLip);

        // 0으로 나누기 방지
        if (horizontalDist === 0) return { detected: false, score: 0 };

        const ratio = verticalDist / horizontalDist;

        let score = 0;
        let detected = false;

        if (ratio > this.thresholds.ratioHigh &&
            horizontalDist < this.thresholds.horizontalHigh) {
            score = 0.95;
            detected = true;
        } else if (ratio > this.thresholds.ratioMedium &&
            horizontalDist < this.thresholds.horizontalMedium) {
            score = 0.75;
            detected = true;
        }

        if (detected) {
            return {
                detected: true,
                score: score,
                label: '뽀뽀 💋', // 한글 라벨로 통일? 원본은 'kiss'
                emoji: this.emoji,
                extra: { ratio, horizontalDist }
            };
        }

        return { detected: false, score: 0 };
    }
}
