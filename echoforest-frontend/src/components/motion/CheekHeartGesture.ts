import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, type Landmark } from '../../utils/gesture-helpers';

export default class CheekHeartGesture extends BaseGesture {
    label: string;
    emoji: string;
    private leftCheekZone: number[];
    private rightCheekZone: number[];
    private leftJawZone: number[];
    private rightJawZone: number[];
    private _tempThumbDist: number = 100;

    constructor(config: any = {}) {
        super(config);
        this.label = '볼하트! 🫶';
        this.emoji = '🫶';
        this.config = {
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

    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        let result: GestureResult = {
            detected: false,
            score: 0,
            label: this.label,
            emoji: this.emoji,
            left: { detected: false, score: 0 },
            right: { detected: false, score: 0 }
        };

        const hands = metadata.allHands; // renamed from multiHandLandmarks for consistency
        const faceLandmarks = metadata.faceLandmarks;

        if (!faceLandmarks || !faceLandmarks.length || !hands || !hands.length) {
            return result;
        }

        try {
            if (hands.length >= 2) {
                const hand1 = hands[0];
                const hand2 = hands[1];
                const palmRef = metadata.palmSize || distance(hand1[0], hand1[9]);

                // 엄지 끝 거리 계산
                const thumbDist = distance(hand1[4], hand2[4]);
                const normThumbDist = thumbDist / palmRef;
                this._tempThumbDist = normThumbDist;
            } else {
                this._tempThumbDist = 100;
            }

            let faceSize = metadata.faceSize || 0.1;
            if (!metadata.faceSize) {
                faceSize = distance(faceLandmarks[10], faceLandmarks[152]);
            }

            for (const hand of hands) {
                const fingers = [8, 12, 16, 20]; // 검지~소지

                let lCheekTouchCount = 0;
                let rCheekTouchCount = 0;
                let lAvgScore = 0;
                let rAvgScore = 0;

                for (const tipIdx of fingers) {
                    const tip = hand[tipIdx];
                    const lCalc = this._checkProximity(tip, faceLandmarks, this.leftCheekZone, faceSize);
                    if (lCalc > 0) { lCheekTouchCount++; lAvgScore += lCalc; }

                    const rCalc = this._checkProximity(tip, faceLandmarks, this.rightCheekZone, faceSize);
                    if (rCalc > 0) { rCheekTouchCount++; rAvgScore += rCalc; }
                }

                const lThumbScore = this._checkProximity(hand[4], faceLandmarks, this.leftJawZone, faceSize);
                const rThumbScore = this._checkProximity(hand[4], faceLandmarks, this.rightJawZone, faceSize);

                if (lCheekTouchCount >= 2 && lThumbScore > 0) {
                    const finalScore = (lAvgScore / lCheekTouchCount + lThumbScore) / 2;
                    if (finalScore > (result.left?.score || 0)) {
                        result.left = { detected: true, score: finalScore, label: '왼쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                } else if (lCheekTouchCount >= 3) {
                    const finalScore = lAvgScore / lCheekTouchCount;
                    if (finalScore > (result.left?.score || 0)) {
                        result.left = { detected: true, score: finalScore, label: '왼쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                }

                if (rCheekTouchCount >= 2 && rThumbScore > 0) {
                    const finalScore = (rAvgScore / rCheekTouchCount + rThumbScore) / 2;
                    if (finalScore > (result.right?.score || 0)) {
                        result.right = { detected: true, score: finalScore, label: '오른쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                } else if (rCheekTouchCount >= 3) {
                    const finalScore = rAvgScore / rCheekTouchCount;
                    if (finalScore > (result.right?.score || 0)) {
                        result.right = { detected: true, score: finalScore, label: '오른쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                }
            }

            if (result.left?.detected && result.right?.detected) {
                if (this._tempThumbDist < 0.5) {
                    result.detected = false;
                    result.score = 0;
                    if (result.left) result.left.detected = false;
                    if (result.right) result.right.detected = false;
                } else {
                    result.detected = true;
                    result.score = (result.left.score + result.right.score) / 2;
                    result.label = '양쪽 볼하트! 🫶🫶';
                }
            } else if (result.left?.detected) {
                result = { ...result, ...result.left, detected: true };
            } else if (result.right?.detected) {
                result = { ...result, ...result.right, detected: true };
            }

        } catch (e) {
            console.error("CheekHeart Logic Error:", e);
        }

        return result;
    }

    private _checkProximity(pt: Landmark, faceLandmarks: Landmark[], zone: number[], faceSize: number): number {
        let minDist = Infinity;
        for (const idx of zone) {
            const fPt = faceLandmarks[idx];
            if (!fPt) continue;
            const d = Math.sqrt(Math.pow(pt.x - fPt.x, 2) + Math.pow(pt.y - fPt.y, 2));
            const norm = d / faceSize;
            if (norm < minDist) minDist = norm;
        }

        if (minDist < this.config.touchThreshold) {
            return Math.max(0.1, 1 - (minDist / this.config.touchThreshold));
        }
        return 0;
    }
}
