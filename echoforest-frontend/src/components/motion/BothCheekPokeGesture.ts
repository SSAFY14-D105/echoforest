import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class BothCheekPokeGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;

    // 왼쪽/오른쪽 볼 포인트 (싱글 볼콕 제스처와 동일하게 맞춤)
    // 거울모드 기준:
    // 사용자의 왼쪽 볼(화면 왼쪽) -> 280, 291 등 (Right Indices)
    // 사용자의 오른쪽 볼(화면 오른쪽) -> 50, 61 등 (Left Indices)
    leftTargetPoints: number[] = [280, 425, 291, 411];
    rightTargetPoints: number[] = [50, 205, 61, 187];

    constructor(config: any = {}) {
        super(config);
        this.label = '양볼콕! 💕';
        this.emoji = '💕';
        this.thresholds = {
            pokeDistance: 0.25,
            ...config
        };
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): any {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        let result: any = {
            detected: false,
            score: 0,
            label: this.label,
            emoji: this.emoji,
            left: { detected: false, score: 0 }, // 진짜 왼쪽 볼 결과
            right: { detected: false, score: 0 } // 진짜 오른쪽 볼 결과
        };

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return result;
        }

        try {
            let faceSize = metadata.faceSize || 0.1;

            // 각 손에 대해 양쪽 볼 중 어디에 가까운지 체크
            for (const hand of allHands) {
                // 검지 펴짐 체크 (필수는 아니지만 권장)
                if (!isFingerExtended(hand, 8, 6)) continue;

                const indexTip = hand[8];

                // 1. 왼쪽 볼(Left Target)과의 거리 체크
                let minL = Infinity;
                for (const pid of this.leftTargetPoints) {
                    const d = distance(indexTip, faceLandmarks[pid]);
                    if (d < minL) minL = d;
                }
                const normLeft = minL / faceSize;

                if (normLeft < this.thresholds.pokeDistance) {
                    const score = Math.max(0.1, 1 - (normLeft / this.thresholds.pokeDistance));
                    if (score > result.left.score) {
                        result.left = { detected: true, score: score };
                    }
                }

                // 2. 오른쪽 볼(Right Target)과의 거리 체크
                let minR = Infinity;
                for (const pid of this.rightTargetPoints) {
                    const d = distance(indexTip, faceLandmarks[pid]);
                    if (d < minR) minR = d;
                }
                const normRight = minR / faceSize;

                if (normRight < this.thresholds.pokeDistance) {
                    const score = Math.max(0.1, 1 - (normRight / this.thresholds.pokeDistance));
                    if (score > result.right.score) {
                        result.right = { detected: true, score: score };
                    }
                }
            }

            // 양쪽 감지 시 최종 성공
            if (result.left.detected && result.right.detected) {
                result.detected = true;
                // 양쪽 다 감지되면 점수를 1.0에 가깝게 부스팅하여 싱글 볼콕을 이기게 함
                // 평균 점수 + 보너스
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
