import BaseGesture, { type GestureMetadata, type GestureResult } from './BaseGesture';
import { distance, isFingerExtended, calculateAngle, type Landmark } from '../../utils/gesture-helpers';

export default class BothCheekPokeGesture extends BaseGesture {
    private thresholds: any;
    private leftTargetPoints: number[];
    private rightTargetPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '양볼콕! 💕';
        this.emoji = '💕';
        this.thresholds = {
            pokeDistance: 0.25,
            ...config
        };

        // 왼쪽/오른쪽 볼 포인트 + 턱/하관 포인트 + 볼 중앙 포인트
        this.leftTargetPoints = [280, 425, 291, 411, 365, 379, 330, 347, 323];
        this.rightTargetPoints = [50, 205, 61, 187, 136, 150, 101, 118, 93];
    }

    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        const result: any = {
            detected: false,
            score: 0,
            label: this.label,
            emoji: this.emoji,
            left: { detected: false, score: 0 },
            right: { detected: false, score: 0 }
        };

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return result;
        }

        try {
            const faceSize = metadata.faceSize || 0.1;

            for (const hand of allHands) {
                // 검지 펴짐 체크
                if (!isFingerExtended(hand, 8, 6)) continue;

                // 검지 각도 체크 (140도 미만 스킵)
                const indexAngle = calculateAngle(hand[5], hand[6], hand[8]);
                if (indexAngle < 140) continue;

                // [개선] 사용자가 "검지로만" 할 때 (주먹 쥔 상태) 지원
                const wrist = hand[0];
                const isMiddleFolded = distance(hand[12], wrist) < distance(hand[9], wrist);
                const isRingFolded = distance(hand[16], wrist) < distance(hand[13], wrist);
                const isFistPoke = isMiddleFolded && isRingFolded;

                if (!isFistPoke) {
                    // 엄지 위치 체크 (볼하트 오인식 방지)
                    const thumbTip = hand[4];
                    const jawPoints = [365, 379, 400, 352, 136, 150, 176, 123];
                    let minThumbDist = Infinity;

                    for (const jIdx of jawPoints) {
                        const jp = faceLandmarks[jIdx];
                        if (jp) {
                            const d = distance(thumbTip, jp);
                            if (d < minThumbDist) minThumbDist = d;
                        }
                    }
                    const normThumb = minThumbDist / faceSize;

                    if (normThumb < 0.35) {
                        continue;
                    }
                }

                const indexTip = hand[8];

                // 1. 왼쪽 볼과의 거리 체크
                let minL = Infinity;
                for (const pid of this.leftTargetPoints) {
                    const d = distance(indexTip, faceLandmarks[pid]);
                    if (d < minL) minL = d;
                }
                const normLeft = minL / faceSize;

                if (normLeft < this.thresholds.pokeDistance) {
                    const lRatio = normLeft / this.thresholds.pokeDistance;
                    const score = 0.6 + (1 - lRatio) * 0.4;
                    if (score > result.left.score) {
                        result.left = { detected: true, score: score };
                    }
                }

                // 2. 오른쪽 볼과의 거리 체크
                let minR = Infinity;
                for (const pid of this.rightTargetPoints) {
                    const d = distance(indexTip, faceLandmarks[pid]);
                    if (d < minR) minR = d;
                }
                const normRight = minR / faceSize;

                if (normRight < this.thresholds.pokeDistance) {
                    const rRatio = normRight / this.thresholds.pokeDistance;
                    const score = 0.6 + (1 - rRatio) * 0.4;
                    if (score > result.right.score) {
                        result.right = { detected: true, score: score };
                    }
                }
            }

            // 양쪽 감지 시 최종 성공
            if (result.left.detected && result.right.detected) {
                result.detected = true;
                const avgScore = (result.left.score + result.right.score) / 2;
                result.score = Math.min(0.99, avgScore + 0.4);
            } else {
                result.score = 0;
            }

        } catch (e) {
            console.error("BothCheekPoke Logic Error:", e);
        }

        return result;
    }
}
