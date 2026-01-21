/**
 * Kiss - 뽀뽀 제스처 감지 클래스
 * MediaPipe FaceLandmarker 기반 입술 오므림 감지
 */
import { BaseGesture } from './BaseGesture.js';

// MediaPipe Face Landmark 인덱스 (입술 관련)
const FACE_LANDMARKS = {
    UPPER_LIP: 13,     // 상순 중앙
    LOWER_LIP: 14,     // 하순 중앙
    LEFT_LIP: 61,      // 왼쪽 입꼬리
    RIGHT_LIP: 291,    // 오른쪽 입꼬리
};

export class Kiss extends BaseGesture {
    constructor() {
        super('kiss', '💋');

        // 기본 임계값 설정
        this.thresholds = {
            ratioHigh: 0.12,       // 높은 확신도 비율 임계값
            ratioMedium: 0.15,     // 중간 확신도 비율 임계값
            horizontalHigh: 0.15,  // 높은 확신도 가로 거리
            horizontalMedium: 0.18 // 중간 확신도 가로 거리
        };
    }

    /**
     * 뽀뽀 제스처 감지
     * @param {Array} faceLandmarks - FaceLandmarker 결과의 faceLandmarks
     * @returns {Object} - { detected: boolean, score: number, data: Object }
     */
    detect(faceLandmarks) {
        // 얼굴이 감지되지 않은 경우
        if (!faceLandmarks || faceLandmarks.length === 0) {
            return {
                detected: false,
                score: 0,
                data: { faceDetected: false }
            };
        }

        const face = faceLandmarks[0];

        // 랜드마크가 충분하지 않은 경우
        if (!face || face.length < 300) {
            return {
                detected: false,
                score: 0,
                data: { faceDetected: false, landmarkCount: face?.length || 0 }
            };
        }

        // 입술 랜드마크 추출
        const upperLip = face[FACE_LANDMARKS.UPPER_LIP];
        const lowerLip = face[FACE_LANDMARKS.LOWER_LIP];
        const leftLip = face[FACE_LANDMARKS.LEFT_LIP];
        const rightLip = face[FACE_LANDMARKS.RIGHT_LIP];

        // 랜드마크가 없는 경우
        if (!upperLip || !lowerLip || !leftLip || !rightLip) {
            return {
                detected: false,
                score: 0,
                data: { faceDetected: true, lipLandmarksFound: false }
            };
        }

        // 입술 거리 계산
        const verticalDist = this.distance(upperLip, lowerLip);
        const horizontalDist = this.distance(leftLip, rightLip);
        const ratio = verticalDist / horizontalDist;

        // 뽀뽀 판정
        let score = 0;
        let detected = false;

        // 높은 확신도
        if (ratio < this.thresholds.ratioHigh &&
            horizontalDist < this.thresholds.horizontalHigh) {
            score = 0.95;
            detected = true;
        }
        // 중간 확신도
        else if (ratio < this.thresholds.ratioMedium &&
            horizontalDist < this.thresholds.horizontalMedium) {
            score = 0.75;
            detected = true;
        }

        return {
            detected,
            score,
            data: {
                faceDetected: true,
                lipLandmarksFound: true,
                verticalDist,
                horizontalDist,
                ratio,
                landmarks: { upperLip, lowerLip, leftLip, rightLip }
            }
        };
    }

    /**
     * 동적 임계값으로 감지 (슬라이더 연동용)
     */
    detectWithThresholds(faceLandmarks, customThresholds) {
        const originalThresholds = { ...this.thresholds };

        if (customThresholds) {
            Object.assign(this.thresholds, customThresholds);
        }

        const result = this.detect(faceLandmarks);

        this.thresholds = originalThresholds;

        return result;
    }
}
