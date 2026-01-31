import BaseGesture from './BaseGesture.js';
import { distance } from '../utils/gesture-helpers.js';

export default class CheekHeartGesture extends BaseGesture {
    constructor(config = {}) {
        super(config);
        this.label = '볼하트! 🫶';
        this.emoji = '🫶';
        this.thresholds = {
            touchThreshold: 0.3,
            thumbIndexDist: 0.5,
            ...config
        };

        // 볼/광대 근처 좌표
        this.leftCheekZone = [280, 425, 361, 288, 323, 376];
        this.rightCheekZone = [50, 205, 132, 58, 93, 147];

        // 턱 라인 좌표 (엄지용)
        this.leftJawZone = [365, 379, 378, 400];
        this.rightJawZone = [136, 150, 149, 176];
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
                // 볼하트 조건:
                // 1. 볼(광대)에 닿은 손가락 끝(검지~소지) 개수가 2개 이상이어야 함.
                // 2. 엄지가 턱 근처에 있어야 함 (엄지까지 포함하면 총 3개 이상 접촉)

                const fingers = [8, 12, 16, 20]; // 검지~소지

                let lCheekTouchCount = 0;
                let rCheekTouchCount = 0;
                let lAvgScore = 0;
                let rAvgScore = 0;

                // Fingers Touch Check
                for (const tipIdx of fingers) {
                    const tip = hand[tipIdx];

                    // Left Cheek Check
                    const lCalc = this._checkProximity(tip, faceLandmarks, this.leftCheekZone, faceSize);
                    if (lCalc > 0) {
                        lCheekTouchCount++;
                        lAvgScore += lCalc;
                    }

                    // Right Cheek Check
                    const rCalc = this._checkProximity(tip, faceLandmarks, this.rightCheekZone, faceSize);
                    if (rCalc > 0) {
                        rCheekTouchCount++;
                        rAvgScore += rCalc;
                    }
                }

                // Thumb Touch Check
                const lThumbScore = this._checkProximity(hand[4], faceLandmarks, this.leftJawZone, faceSize);
                const rThumbScore = this._checkProximity(hand[4], faceLandmarks, this.rightJawZone, faceSize);

                // 판정: 
                // 손가락 2개 이상이 볼에 닿고 + 엄지가 턱에 닿으면 볼하트 인정.
                // (엄지 조건이 너무 빡빡하면 '손가락 3개 이상 접촉' 만으로도 인정 가능)

                // --- 왼쪽 볼하트 ---
                if (lCheekTouchCount >= 2 && lThumbScore > 0) {
                    const finalScore = (lAvgScore / lCheekTouchCount + lThumbScore) / 2;
                    if (finalScore > result.left.score) {
                        result.left = { detected: true, score: finalScore, label: '왼쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                } else if (lCheekTouchCount >= 3) {
                    // 엄지가 안 닿아도 손가락 3개가 닿으면 볼하트로 인정 (관대하게)
                    const finalScore = lAvgScore / lCheekTouchCount;
                    if (finalScore > result.left.score) {
                        result.left = { detected: true, score: finalScore, label: '왼쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                }

                // --- 오른쪽 볼하트 ---
                if (rCheekTouchCount >= 2 && rThumbScore > 0) {
                    const finalScore = (rAvgScore / rCheekTouchCount + rThumbScore) / 2;
                    if (finalScore > result.right.score) {
                        result.right = { detected: true, score: finalScore, label: '오른쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                } else if (rCheekTouchCount >= 3) {
                    const finalScore = rAvgScore / rCheekTouchCount;
                    if (finalScore > result.right.score) {
                        result.right = { detected: true, score: finalScore, label: '오른쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                }
            }

            if (result.left.detected && result.right.detected) {
                result.detected = true;
                result.score = (result.left.score + result.right.score) / 2;
                result.label = '양쪽 볼하트! 🫶🫶';
            } else if (result.left.detected) {
                result = { ...result, ...result.left, detected: true };
            } else if (result.right.detected) {
                result = { ...result, ...result.right, detected: true };
            } else {
                // 감지 실패 시
                result.score = 0;
            }

        } catch (e) {
            console.error("CheekHeart Logic Error:", e);
        }

        return result;
    }

    _checkProximity(pt, faceLandmarks, zone, faceSize) {
        let minDist = Infinity;
        for (const idx of zone) {
            const fPt = faceLandmarks[idx];
            if (!fPt) continue;
            const d = Math.sqrt(Math.pow(pt.x - fPt.x, 2) + Math.pow(pt.y - fPt.y, 2));
            const norm = d / faceSize;
            if (norm < minDist) minDist = norm;
        }

        if (minDist < this.thresholds.touchThreshold) {
            return Math.max(0.1, 1 - (minDist / this.thresholds.touchThreshold));
        }
        return 0;
    }
}
