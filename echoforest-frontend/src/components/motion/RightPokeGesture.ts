import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class RightPokeGesture extends BaseGesture {
    thresholds: any;
    cheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '오른볼콕! 👉';
        this.emoji = '👉';
        this.thresholds = {
            pokeDistance: 0.25,
            ...config
        };

        // 오른쪽 볼 영역 (MediaPipe 기준 Left Side Index들)
        // 거울모드 특성상 50번대가 화면 오른쪽(사용자의 오른쪽)에 해당할 수 있음
        // [개선] 입가 + 턱 + 볼 중앙까지 커버리지 확대
        this.cheekPoints = [50, 205, 61, 187, 136, 150, 101, 118, 93];
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        const faceSize = metadata.faceSize || 0.1;

        // [배타적 로직] 왼쪽 볼(반대쪽)도 찔리고 있다면 -> 양볼콕이므로 나는 빠진다.
        // 왼쪽 볼 포인트 (거울모드 기준 280번대)
        const oppositeCheekPoints = [280, 425, 291, 411, 365, 379];
        for (const hand of allHands) {
            // 어떤 손이라도 반대쪽 볼 근처에 있으면 탈락
            if (!isFingerExtended(hand, 8, 6)) continue;
            const tip = hand[8];
            for (const oppIdx of oppositeCheekPoints) {
                if (faceLandmarks[oppIdx]) {
                    const dist = distance(tip, faceLandmarks[oppIdx]);
                    if (dist < faceSize * this.thresholds.pokeDistance) {
                        // 반대쪽도 찔렸음 -> Both가 처리할 것임
                        return { detected: false, score: 0 };
                    }
                }
            }
        }

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
                // [점수 부스팅] 범위 안에만 들어오면 최소 0.6점 보장 + 거리에 따라 추가 점수
                const ratio = minDist / this.thresholds.pokeDistance;
                const score = 0.6 + (1 - ratio) * 0.4;
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
