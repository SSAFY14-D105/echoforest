import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, Landmark } from '../../utils/gesture-helpers';

export default class BothCheekPokeGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;
    leftCheekPoints: number[];
    rightCheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '양볼콕! 💕';
        this.emoji = '💕';
        this.thresholds = {
            pokeDistance: 0.2, // 인식 거리 임계값 (조금 관대하게)
            ...config
        };

        // 볼 인식 좌표
        this.leftCheekPoints = [411, 376, 352, 280, 425, 361, 288, 397];
        this.rightCheekPoints = [187, 147, 123, 50, 205, 132, 58, 172];
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): any {
        const faceLandmarks = metadata.faceLandmarks; // [FIX] Extract from metadata

        let result: any = {
            detected: false,
            score: 0,
            label: this.label,
            emoji: this.emoji,
            left: { detected: false, score: 0 },
            right: { detected: false, score: 0 }
        };

        if (!faceLandmarks || !faceLandmarks.length || !multiHandLandmarks || !multiHandLandmarks.length) {
            return result;
        }

        try {
            let faceSize = metadata.faceSize || 0.1;
            if (!metadata.faceSize) {
                faceSize = distance(faceLandmarks[10], faceLandmarks[152]);
            }

            for (const hand of multiHandLandmarks) {
                // 볼콕 조건:
                // 1. 얼굴(볼)에 닿은 손가락 끝 개수가 정확히 1개여야 함. (검지, 중지, 약지, 소지 중 하나)
                // 2. 그 중에서도 '검지'가 닿았다면 가산점

                const fingers = [8, 12, 16, 20]; // 검지, 중지, 약지, 소지

                // 각 손가락이 왼쪽/오른쪽 볼에 닿았는지 체크
                let lTouchCount = 0;
                let rTouchCount = 0;
                let maxLScore = 0;
                let maxRScore = 0;

                for (const tipIdx of fingers) {
                    const tip = hand[tipIdx];

                    // 왼쪽 볼 체크
                    const lCalc = this._checkDistance(tip, faceLandmarks, this.leftCheekPoints, faceSize);
                    if (lCalc.score > 0) {
                        lTouchCount++;
                        if (lCalc.score > maxLScore) maxLScore = lCalc.score;
                    }

                    // 오른쪽 볼 체크
                    const rCalc = this._checkDistance(tip, faceLandmarks, this.rightCheekPoints, faceSize);
                    if (rCalc.score > 0) {
                        rTouchCount++;
                        if (rCalc.score > maxRScore) maxRScore = rCalc.score;
                    }
                }

                // 판정: 볼에 닿은 손가락이 1개 이하여야 함 (볼콕 특성)

                // 왼쪽 판정
                if (lTouchCount === 1) {
                    const isIndexTouchingLeft = this._checkDistance(hand[8], faceLandmarks, this.leftCheekPoints, faceSize).score > 0;

                    if (isIndexTouchingLeft || lTouchCount === 1) {
                        if (maxLScore > result.left.score) {
                            result.left = {
                                detected: true, score: maxLScore, label: '왼볼콕! 👈', emoji: '👈',
                                details: { minDist: 0.1 }
                            };
                        }
                    }
                }

                // 오른쪽 판정
                if (rTouchCount === 1) {
                    const isIndexTouchingRight = this._checkDistance(hand[8], faceLandmarks, this.rightCheekPoints, faceSize).score > 0;

                    if (isIndexTouchingRight || rTouchCount === 1) {
                        if (maxRScore > result.right.score) {
                            result.right = {
                                detected: true, score: maxRScore, label: '오른볼콕! 👉', emoji: '👉',
                                details: { minDist: 0.1 }
                            };
                        }
                    }
                }
            }

            if (result.left.detected && result.right.detected) {
                result.detected = true;
                result.score = (result.left.score + result.right.score) / 2;
            } else {
                result.score = Math.max(result.left.score, result.right.score);
            }
        } catch (e) {
            console.error("BothCheekPoke Logic Error:", e);
        }

        return result;
    }

    // 거리 계산 로직 (score 반환)
    _checkDistance(tip: Landmark, faceLandmarks: any[], points: number[], faceSize: number): { score: number, minDist: number } {
        try {
            let minDist = Infinity;
            for (const idx of points) {
                const pt = faceLandmarks[idx];
                if (!pt) continue;
                const d = Math.sqrt(Math.pow(tip.x - pt.x, 2) + Math.pow(tip.y - pt.y, 2));
                const norm = d / faceSize;
                if (norm < minDist) minDist = norm;
            }

            if (minDist < this.thresholds.pokeDistance) {
                return {
                    score: Math.max(0.1, 1 - (minDist / this.thresholds.pokeDistance)),
                    minDist: minDist
                };
            }
        } catch (e) { }

        return { score: 0, minDist: Infinity };
    }
}
