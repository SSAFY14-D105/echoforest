import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class FlowerPoseGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;
    chinPoint: number;
    jawPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '꽃받침! 🌸';
        this.emoji = '🌸';
        this.thresholds = {
            distance: 0.35, // 턱과의 거리
            ...config
        };

        // 턱 끝(152) 및 턱 라인
        this.chinPoint = 152;
        this.jawPoints = [152, 365, 136]; // 중앙, 좌, 우 턱 끝
    }

    check(_multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        const faceSize = metadata.faceSize || 0.1;
        let detectedHands = 0;
        let totalScore = 0;

        for (const hand of allHands) {
            // 1. 손목(0)이나 손바닥 중심이 턱 근처에 있는지 체크
            // 꽃받침은 보통 손목이나 손바닥 아랫부분을 턱에 댐
            const wrist = hand[0] as Landmark;
            const thumbBase = hand[1] as Landmark;
            const pinkyBase = hand[17] as Landmark;

            // 손의 "받침" 부분 (손목~손바닥 하단)
            const basePoints = [wrist, thumbBase, pinkyBase];

            let minToJaw = Infinity;

            // 얼굴의 턱 포인트들과 비교
            for (const jawIdx of this.jawPoints) {
                const jawPt = faceLandmarks[jawIdx] as Landmark;
                if (!jawPt) continue;

                for (const basePt of basePoints) {
                    const d = distance(basePt, jawPt);
                    const norm = d / faceSize;
                    if (norm < minToJaw) minToJaw = norm;
                }
            }

            // 2. 거리 체크
            if (minToJaw < this.thresholds.distance) {
                // 3. 모양 체크 (손이 펴져 있어야 함, 주먹이면 안됨)
                // 적어도 3개 이상의 손가락이 펴져 있어야 '꽃' 모양
                const extendedCount = [8, 12, 16, 20].filter(idx => isFingerExtended(hand as Landmark[], idx, idx - 2)).length;

                if (extendedCount >= 3) {
                    detectedHands++;
                    // 거리가 가까울수록 점수 높음
                    const score = Math.max(0.1, 1 - (minToJaw / this.thresholds.distance));
                    totalScore += score;
                }
            }
        }

        if (detectedHands > 0) {
            // 양손이면 점수 가산
            let finalScore = totalScore / detectedHands;
            if (detectedHands >= 2) {
                finalScore = Math.min(0.99, finalScore + 0.2);
            } else {
                // 한손 꽃받침도 인정하지만 점수는 약간 낮게
                finalScore = Math.min(0.9, finalScore);
            }

            return {
                detected: true,
                score: finalScore,
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
