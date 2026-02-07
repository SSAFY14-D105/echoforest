import BaseGesture, { type GestureMetadata, type GestureResult } from './BaseGesture';
import { distance, isFingerExtended, type Landmark } from '../../utils/gesture-helpers';

export default class LeftPokeGesture extends BaseGesture {
    private thresholds: any;
    private cheekPoints: number[];

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
        // [개선] 입가 + 턱 + 볼 중앙까지 커버리지 확대
        this.cheekPoints = [280, 425, 291, 411, 365, 379, 330, 347, 323];
    }

    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        const faceSize = metadata.faceSize || 0.1;

        // [배타적 로직] 오른쪽 볼(반대쪽)도 찔리고 있다면 -> 양볼콕이므로 나는 빠진다.
        const oppositeCheekPoints = [50, 205, 61, 187, 136, 150];
        for (const hand of allHands) {
            if (!isFingerExtended(hand, 8, 6)) continue;
            const tip = hand[8];
            for (const oppIdx of oppositeCheekPoints) {
                if (faceLandmarks[oppIdx]) {
                    const dist = distance(tip, faceLandmarks[oppIdx]);
                    if (dist < faceSize * this.thresholds.pokeDistance) {
                        return { detected: false, score: 0 };
                    }
                }
            }
        }

        let bestScore = 0;
        let detected = false;

        for (const hand of allHands) {
            if (!isFingerExtended(hand, 8, 6)) continue;

            // [FIX] 엄지가 검지/중지 PIP(두번째 마디)와 가까워야 "콕" 모양
            // 볼하트처럼 손가락이 쫙 펴진 상태면 차단
            const thumbTip = hand[4];
            const indexPIP = hand[6];   // 검지 두번째 마디
            const middlePIP = hand[10]; // 중지 두번째 마디
            const palmSize = distance(hand[0], hand[9]);

            const thumbToIndexPIP = distance(thumbTip, indexPIP) / palmSize;
            const thumbToMiddlePIP = distance(thumbTip, middlePIP) / palmSize;

            // 엄지가 검지/중지 PIP 중 하나라도 가까워야 함 (0.8 이하)
            const isPokeShape = thumbToIndexPIP < 0.8 || thumbToMiddlePIP < 0.8;
            if (!isPokeShape) continue;

            const indexTip = hand[8];
            let minDist = Infinity;
            for (const idx of this.cheekPoints) {
                const cheekPoint = faceLandmarks[idx];
                const d = distance(indexTip, cheekPoint);
                const normDist = d / faceSize;
                if (normDist < minDist) minDist = normDist;
            }

            if (minDist < this.thresholds.pokeDistance) {
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
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
