import BaseGesture from './BaseGesture.js';
import { distance } from '../utils/gesture-helpers.js';

export default class BothCheekPokeGesture extends BaseGesture {
    constructor(config = {}) {
        super(config);
        this.label = '양볼콕! 💕';
        this.emoji = '💕';
        this.thresholds = {
            pokeDistance: 0.2, // 인식 거리 임계값
            ...config
        };

        // 볼 인식 좌표 (최신 업데이트 반영됨)
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
            // 얼굴 크기 기준 (정규화용)
            let faceSize = metadata.faceSize || 0.1;
            if (!metadata.faceSize) {
                faceSize = distance(faceLandmarks[10], faceLandmarks[152]);
            }

            // 모든 손을 순회하며 '볼콕 자세'인지 확인하고 위치 판별
            for (const hand of multiHandLandmarks) {
                // 1. 볼콕 자세 검사
                if (!this._isValidPokePose(hand)) continue;

                const indexTip = hand[8];
                if (!indexTip) continue;

                // 2. 왼쪽 볼 찌르기 검사
                const lCalc = this._checkDistance(indexTip, faceLandmarks, this.leftCheekPoints, faceSize);
                if (lCalc.score > 0 && lCalc.score > result.left.score) {
                    result.left = {
                        detected: true,
                        score: lCalc.score,
                        label: '왼볼콕! 👈',
                        emoji: '👈',
                        details: { minDist: lCalc.minDist.toFixed(4) } // details 데이터 포함 (UI 에러 방지)
                    };
                }

                // 3. 오른쪽 볼 찌르기 검사
                const rCalc = this._checkDistance(indexTip, faceLandmarks, this.rightCheekPoints, faceSize);
                if (rCalc.score > 0 && rCalc.score > result.right.score) {
                    result.right = {
                        detected: true,
                        score: rCalc.score,
                        label: '오른볼콕! 👉',
                        emoji: '👉',
                        details: { minDist: rCalc.minDist.toFixed(4) } // details 데이터 포함 (UI 에러 방지)
                    };
                }
            }

            // 판정: 양쪽 다 감지되면 양볼콕
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

    // 볼콕 손모양 확인 (검지 펴고, 나머지 접음)
    _isValidPokePose(hand) {
        try {
            const isIndexExtended = this.isFingerExtended(hand, 8, 6, 0.8);
            if (!isIndexExtended) return false;

            const isMiddleClosed = this.isFingerClosed(hand, 12, 10);
            const isRingClosed = this.isFingerClosed(hand, 16, 14);
            const isPinkyClosed = this.isFingerClosed(hand, 20, 18);

            return isMiddleClosed && isRingClosed && isPinkyClosed;
        } catch (e) {
            return false;
        }
    }

    // 거리 계산 및 점수/minDist 반환
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
