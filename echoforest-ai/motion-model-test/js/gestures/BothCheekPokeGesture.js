import BaseGesture from './BaseGesture.js';
import { distance } from '../utils/gesture-helpers.js';

export default class BothCheekPokeGesture extends BaseGesture {
    constructor(config = {}) {
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

    check(multiHandLandmarks, metadata, faceLandmarks) {
        let result = {
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
                // 2. 그 중에서도 '검지'가 닿았다면 가산점, 다른것도 허용은 하되.. 
                //    여기서는 헷갈리지 않게 '검지가 닿았고 & 다른건 안닿았다'로 명확히 함.
                //    또는 '어떤 손가락이든 딱 1개만 닿았다'로 설정.

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
                // 1개가 아니라 2개 이상이면 볼하트나 다른 제스처일 확률 높음

                // 왼쪽 판정
                if (lTouchCount === 1) { // 정확히 1개만 닿았을 때 (검지일 확률 높음)
                    // 검지(8)가 닿았는지 확인하면 더 좋지만, 새끼손가락 볼콕도 허용한다면 카운트만 봄.
                    // 보통 볼콕은 검지로 하므로, 검지가 닿았을때 점수를 더 줘도 됨.
                    const isIndexTouchingLeft = this._checkDistance(hand[8], faceLandmarks, this.leftCheekPoints, faceSize).score > 0;

                    if (isIndexTouchingLeft || lTouchCount === 1) {
                        if (maxLScore > result.left.score) {
                            result.left = {
                                detected: true, score: maxLScore, label: '왼볼콕! 👈', emoji: '👈',
                                details: { minDist: 0.1 } // 더미 디테일 (에러방지)
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
    _checkDistance(tip, faceLandmarks, points, faceSize) {
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
