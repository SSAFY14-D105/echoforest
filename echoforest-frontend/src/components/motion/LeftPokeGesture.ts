import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class LeftPokeGesture extends BaseGesture {
    thresholds: any;
    cheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '왼볼콕! 👈';
        this.emoji = '👈';
        this.thresholds = {
            pokeDistance: 0.25,
            ...config
        };

        // 왼쪽 볼 영역 (MediaPipe 기준 Right Side Index들)
        // 280번대가 화면 왼쪽(사용자의 왼쪽)에 해당
        this.cheekPoints = [280, 425, 291, 411];
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        const faceSize = metadata.faceSize || 0.1;
        let bestScore = 0;
        let detected = false;

        for (const hand of allHands) {
            if (!isFingerExtended(hand, 8, 6)) continue;

            const indexTip = hand[8];
            let minDist = Infinity;
            for (const idx of this.cheekPoints) {
                const cheekPoint = faceLandmarks[idx];
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
