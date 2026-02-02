import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class RightPokeGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;
    cheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '오른볼콕! 👉';
        this.emoji = '👉';
        this.thresholds = {
            pokeDistance: 0.4, // [FIX] 판정 범위 더 완화 (0.3 -> 0.4)
            ...config
        };

        // [FIX] 왼쪽/오른쪽 반대로 인식되는 문제 수정 (다시 50번대로 변경)
        this.cheekPoints = [50, 205, 61, 187];
    }

    check(_landmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        const faceSize = metadata.faceSize || 0.1;
        let bestScore = 0;
        let detected = false;

        for (const hand of allHands) {
            if (!isFingerExtended(hand as Landmark[], 8, 6)) continue;

            const indexTip = hand[8] as Landmark;
            let minDist = Infinity;
            for (const idx of this.cheekPoints) {
                const cheekPoint = faceLandmarks[idx] as Landmark;
                const d = distance(indexTip, cheekPoint);
                const normDist = d / faceSize;
                if (normDist < minDist) minDist = normDist;
            }

            if (minDist < this.thresholds.pokeDistance) {
                const score = Math.max(0.1, 1 - (minDist / this.thresholds.pokeDistance));
                if (score > bestScore) {
                    bestScore = score;
                    detected = true;
                }
            }
        }

        if (detected) {
            return {
                detected: true,
                score: bestScore,
                label: this.label
            };
        }

        return { detected: false, score: 0 };
    }
}
