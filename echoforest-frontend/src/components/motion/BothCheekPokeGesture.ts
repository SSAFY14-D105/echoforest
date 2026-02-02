import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, calculateAngle, Landmark } from '../../utils/gesture-helpers';

export default class BothCheekPokeGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;

    // 왼쪽/오른쪽 볼 포인트 (싱글 볼콕 제스처와 동일하게 맞춤)
    // 거울모드 기준:
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

    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        let result: any = {
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
            let faceSize = metadata.faceSize || 0.1;

            for (const hand of allHands) {
                const handLandmarks = hand as Landmark[];
                // 검지 펴짐 체크
                if (!isFingerExtended(handLandmarks, 8, 6)) continue;

                // 2. 검지 각도 체크 (140도 미만 스킵)
                const indexAngle = calculateAngle(handLandmarks[5], handLandmarks[6], handLandmarks[8]);
                if (indexAngle < 140) continue;

                // [중요] 엄지 위치 체크 (볼하트 오인식 방지)
                // 만약 엄지가 얼굴 턱선/볼 하단에 가까이 붙어있다면 -> 이건 하트 동작이지 볼콕이 아님!
                // 볼콕은 보통 주먹을 쥐거나 엄지가 떨어져 있음.
                const thumbTip = handLandmarks[4];
                const jawPoints = [365, 379, 400, 352, 136, 150, 176, 123]; // 좌우 통합 체크
                let minThumbDist = Infinity;

                for (const jIdx of jawPoints) {
                    const jp = faceLandmarks[jIdx] as Landmark;
                    if (jp) {
                        const d = distance(thumbTip, jp);
                        if (d < minThumbDist) minThumbDist = d;
                    }
                }
                const normThumb = minThumbDist / faceSize;

                // 엄지가 얼굴에 매우 가까우면(0.35 이내) 볼콕 후보에서 제외 또는 감점
                if (normThumb < 0.35) {
                    continue;
                }

                const indexTip = handLandmarks[8];

                // 1. 왼쪽 볼(Left Target)과의 거리 체크
                let minL = Infinity;
                for (const pid of this.leftTargetPoints) {
                    const d = distance(indexTip, faceLandmarks[pid] as Landmark);
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
                    const d = distance(indexTip, faceLandmarks[pid] as Landmark);
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
