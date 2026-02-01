import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, Landmark } from '../../utils/gesture-helpers';

export default class BothCheekPokeGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;

    // 검사할 포인트들 (볼 중앙, 입꼬리, 광대)
    // 왼쪽 영역: 50(볼), 205(광대), 61(입꼬리), 187(귀쪽 볼)
    leftCheekPoints: number[] = [50, 205, 61, 187];
    // 오른쪽 영역: 280(볼), 425(광대), 291(입꼬리), 411(귀쪽 볼)
    rightCheekPoints: number[] = [280, 425, 291, 411];

    constructor(config: any = {}) {
        super(config);
        this.label = '양볼콕! 💕';
        this.emoji = '💕';
        this.thresholds = {
            pokeDistance: 0.2, // 조금 더 여유있게 (0.15 -> 0.2)
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
            left: { detected: false, score: 0 },
            right: { detected: false, score: 0 }
        };

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return result;
        }

        try {
            let faceSize = metadata.faceSize;
            if (!faceSize) {
                faceSize = distance(faceLandmarks[10], faceLandmarks[152]);
            }
            if (!faceSize || faceSize === 0) faceSize = 0.1;

            // 각 손 검사
            for (const hand of allHands) {
                const indexTip = hand[8]; // 검지 끝

                // 1. 왼쪽 볼 영역 검사 (가장 가까운 포인트 찾기)
                let minL = Infinity;
                for (const pid of this.leftCheekPoints) {
                    const d = distance(indexTip, faceLandmarks[pid]);
                    if (d < minL) minL = d;
                }
                const normLeft = minL / faceSize;

                if (normLeft < this.thresholds.pokeDistance) {
                    const score = Math.max(0, 1 - (normLeft / this.thresholds.pokeDistance));
                    // 점수 갱신 (가장 높은 점수)
                    if (score > result.left.score) {
                        result.left = { detected: true, score: score, label: '왼볼콕' };
                    }
                }

                // 2. 오른쪽 볼 영역 검사
                let minR = Infinity;
                for (const pid of this.rightCheekPoints) {
                    const d = distance(indexTip, faceLandmarks[pid]);
                    if (d < minR) minR = d;
                }
                const normRight = minR / faceSize;

                if (normRight < this.thresholds.pokeDistance) {
                    const score = Math.max(0, 1 - (normRight / this.thresholds.pokeDistance));
                    if (score > result.right.score) {
                        result.right = { detected: true, score: score, label: '오른볼콕' };
                    }
                }
            }

            // 양쪽 감지 시 최종 성공
            if (result.left.detected && result.right.detected) {
                result.detected = true;
                result.score = (result.left.score + result.right.score) / 2;
                if (result.score > 0.5) result.score = 0.9 + (result.score * 0.1);
            } else {
                result.score = 0;
            }

        } catch (e) {
            console.error("BothCheekPoke Logic Error:", e);
        }

        return result;
    }
}
