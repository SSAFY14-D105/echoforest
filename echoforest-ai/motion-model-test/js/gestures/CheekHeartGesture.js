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
            // **양손 볼하트 오인식 방지 로직 추가**
            // 만약 손이 2개라면, 두 엄지 사이의 거리를 계산.
            // 손하트(엄지끼리 붙음)와 구분하기 위해, 엄지끼리 멀리 떨어져 있어야 함.
            if (multiHandLandmarks.length >= 2) {
                const hand1 = multiHandLandmarks[0];
                const hand2 = multiHandLandmarks[1];
                const palmRef = metadata.palmSize || distance(hand1[0], hand1[9]);

                // 엄지 끝 거리 계산
                const thumbDist = distance(hand1[4], hand2[4]);
                const normThumbDist = thumbDist / palmRef;

                // 엄지가 너무 가까우면(0.5 미만) 손하트일 확률이 높으므로 볼하트 패스
                // 단, 한손 볼하트는 통과해야 함.
                // 그러나 check()는 전체 루프이므로 여기서 리턴하면 안되고,
                // 양손 감지 결과가 나왔을 때 최종 판정에서 걸러야 함.
                // 일단 여기서는 저장을 해둠.
                this._tempThumbDist = normThumbDist;
            } else {
                this._tempThumbDist = 100; // 한손이면 거리 무한대 취급
            }

            let faceSize = metadata.faceSize || 0.1;
            if (!metadata.faceSize) {
                faceSize = distance(faceLandmarks[10], faceLandmarks[152]);
            }

            for (const hand of multiHandLandmarks) {
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

                // --- 왼쪽 볼하트 ---
                if (lCheekTouchCount >= 2 && lThumbScore > 0) {
                    const finalScore = (lAvgScore / lCheekTouchCount + lThumbScore) / 2;
                    if (finalScore > result.left.score) {
                        result.left = { detected: true, score: finalScore, label: '왼쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                } else if (lCheekTouchCount >= 3) {
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

            // 양쪽 감지 시 -> 엄지 거리 조건 체크!
            if (result.left.detected && result.right.detected) {
                // 두 손이 모두 감지되었는데, 엄지가 너무 가까우면(손하트 모양) 볼하트 취소.
                // 볼하트는 양쪽 볼에 대니까 엄지가 떨어져 있어야 정상이지만,
                // 손하트는 가슴/얼굴 앞에서 모으니까 가까움.
                if (this._tempThumbDist < 0.5) {
                    // 거리 너무 가까움 -> 볼하트 아님 (손하트 등일 가능성)
                    // 둘 중 점수 높은 하나만 살릴까? 아니면 둘 다 취소?
                    // 보통 손하트는 얼굴 중앙에 있으므로 둘 다 취소가 맞음.
                    result.detected = false;
                    result.score = 0;
                    result.left.detected = false;
                    result.right.detected = false;
                } else {
                    result.detected = true;
                    result.score = (result.left.score + result.right.score) / 2;
                    result.label = '양쪽 볼하트! 🫶🫶';
                }
            } else if (result.left.detected) {
                result = { ...result, ...result.left, detected: true };
            } else if (result.right.detected) {
                result = { ...result, ...result.right, detected: true };
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
