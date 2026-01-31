import BaseGesture from './BaseGesture.js';
import { distance } from '../utils/gesture-helpers.js';

export default class CheekHeartGesture extends BaseGesture {
    constructor(config = {}) {
        super(config);
        this.label = '볼하트! 🫶';
        this.emoji = '🫶';
        this.thresholds = {
            touchThreshold: 0.3, // 얼굴 터치 임계값
            fingerCurlHigh: 0.8, // 손가락이 펴진 것으로 간주하는 상한 (너무 쫙 펴면 안됨)
            fingerCurlLow: 0.3,  // 손가락이 펴진 것으로 간주하는 하한 (너무 접으면 주먹)
            thumbIndexDist: 0.7, // 엄지-검지 거리 비율 (손바닥 대비)
            ...config
        };

        // 볼/광대 근처 좌표 (검지~새끼가 닿아야 할 곳)
        // 왼쪽 볼/광대: 280, 425, 361, 288, 323, 376
        // 오른쪽 볼/광대: 50, 205, 132, 58, 93, 147
        this.leftCheekZone = [280, 425, 361, 288, 323, 376];
        this.rightCheekZone = [50, 205, 132, 58, 93, 147];

        // 턱 근처 좌표 (엄지가 닿아야 할 곳)
        // 왼쪽 턱 라인: 365, 379, 378, 400
        // 오른쪽 턱 라인: 136, 150, 149, 176
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
            const palmRef = metadata.palmSize || 1; // 손바닥 크기 참조

            for (const hand of multiHandLandmarks) {
                // 1. 손가락 구부림 체크 (C모양/반하트 모양)
                if (!this._isSemiCurled(hand)) continue;

                // 2. 엄지-검지 거리 체크 (0.7 이상)
                const d4_8 = distance(hand[4], hand[8]);
                if (d4_8 / palmRef < this.thresholds.thumbIndexDist) continue;

                // 3. 위치 체크 (왼쪽 볼하트 vs 오른쪽 볼하트)

                // --- 왼쪽 얼굴 체크 (왼손일 확률 높음) ---
                // 엄지는 왼쪽 턱, 나머지는 왼쪽 볼
                const lThumbScore = this._checkProximity(hand[4], faceLandmarks, this.leftJawZone, faceSize);
                const lFingerScore = this._checkProximity(hand[8], faceLandmarks, this.leftCheekZone, faceSize);

                if (lThumbScore > 0 && lFingerScore > 0) {
                    const score = (lThumbScore + lFingerScore) / 2;
                    if (score > result.left.score) {
                        result.left = { detected: true, score: score, label: '왼쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                }

                // --- 오른쪽 얼굴 체크 (오른손일 확률 높음) ---
                // 엄지는 오른쪽 턱, 나머지는 오른쪽 볼
                const rThumbScore = this._checkProximity(hand[4], faceLandmarks, this.rightJawZone, faceSize);
                const rFingerScore = this._checkProximity(hand[8], faceLandmarks, this.rightCheekZone, faceSize);

                if (rThumbScore > 0 && rFingerScore > 0) {
                    const score = (rThumbScore + rFingerScore) / 2;
                    if (score > result.right.score) {
                        result.right = { detected: true, score: score, label: '오른쪽 볼하트! 🫶', emoji: '🫶' };
                    }
                }
            }

            // 양쪽 감지 시 평균 점수
            if (result.left.detected && result.right.detected) {
                result.detected = true;
                result.score = (result.left.score + result.right.score) / 2;
                result.label = '양쪽 볼하트! 🫶🫶';
            } else if (result.left.detected) {
                result = { ...result, ...result.left, detected: true };
            } else if (result.right.detected) {
                result = { ...result, ...result.right, detected: true };
            }

        } catch (e) {
            console.error("CheekHeart Error:", e);
        }

        return result;
    }

    // 손가락들이 '살짝' 구부러져 있는지 확인 (완전히 펴지지도, 완전히 주먹도 아님)
    _isSemiCurled(hand) {
        // 검지(8), 중지(12), 약지(16), 소지(20) 체크
        // 손목(0) 부터의 거리 비교: Tip < MCP * curlHigh AND Tip > MCP * curlLow 이면 살짝 구부린 것?
        // 더 정확하게는 PIP 각도가 굽혀져 있어야 함.
        // 여기서는 간단히: Tip과 Wrist 거리가 '적당히' 짧아져야 함 (완전 폄 대비)

        const wrist = hand[0];
        const fingers = [8, 12, 16, 20];

        let curledCount = 0;
        for (const tip of fingers) {
            const mcp = tip - 3; // 5, 9, 13, 17
            const dTip = distance(hand[tip], wrist);
            const dMcp = distance(hand[mcp], wrist);

            // 비율이 1.0 근처면 펴진 것, 0.5 미만이면 주먹
            // 살짝 구부림: 0.6 ~ 0.95 정도? (thresholds 사용)
            const ratio = dTip / dMcp; // 보통 펴면 > 1.5, 접으면 < 1.0 (손가락 길이에 따라 다름)

            // 보정된 로직: 손가락이 '살짝' 구부러짐 = 곡선 형태
            // 펴진 상태(Straight)가 아님을 확인
            // 간단하게: 주먹(Closed)은 아니어야 하고, 완전 폄(Extended)도 아니어야 함.

            // 여기서는 사용자의 "살짝 구부러지고" 요구사항에 맞춰
            // C자 형태를 가정.
            if (this.isFingerExtended(hand, tip, tip - 2, 0.7) && !this.isFingerExtended(hand, tip, tip - 2, 0.95)) {
                curledCount++;
            } else if (this.isFingerExtended(hand, tip, tip - 2, 0.6)) {
                // 좀 더 관대하게: 0.6 이상 펴져있으면 인정 (완전 주먹만 아니면 됨)
                curledCount++;
            }
        }

        // 4손가락 중 3개 이상이 조건 만족하면 OK
        return curledCount >= 3;
    }

    // 포인트들과의 최소 거리 체크
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
