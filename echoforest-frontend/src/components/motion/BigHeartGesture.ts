<<<<<<< HEAD
import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distanceAR, Landmark } from '../../utils/gesture-helpers';
=======
import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distanceAR, type Landmark } from '../../utils/gesture-helpers';
>>>>>>> de01de68483739874f9083b4953344580dda6da3

export default class BigHeartGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;

    constructor(config: any = {}) {
        super(config);
        this.label = '머리 위 하트! 🙆‍♂️';
        this.emoji = '🙆‍♂️';
        this.thresholds = {
            wristToTipRatio: 1.3, // 손목 거리가 손끝 거리보다 1.3배 이상이어야 함
            maxTipDist: 0.45,     // 손끝-이마 거리가 0.45 이하
            maxTipsGap: 0.16,     // 양 손끝 간격이 0.16 이하 (하트 닫힘)
            ...config
        };
    }

    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const hands = metadata.allHands;
        const aspectRatio = metadata.aspectRatio || 1.0;
        const face = metadata.faceLandmarks;

        if (!hands || hands.length < 2 || !face || face.length === 0) {
            return { detected: false, score: 0 };
        }

        const hand1 = hands[0];
        const hand2 = hands[1];
        const forehead = face[10]; // 이마 최상단 포인트

        const getDistToForehead = (pt: Landmark) => distanceAR(pt, forehead, aspectRatio);

        // 1. 손끝(중지) 거리
        const tip1Dist = getDistToForehead(hand1[12]);
        const tip2Dist = getDistToForehead(hand2[12]);
        const avgTipDist = (tip1Dist + tip2Dist) / 2;

        // 2. 손목 거리
        const wrist1Dist = getDistToForehead(hand1[0]);
        const wrist2Dist = getDistToForehead(hand2[0]);
        const avgWristDist = (wrist1Dist + wrist2Dist) / 2;

        // 3. 높이 체크 (손이 이마보다 위에 있는지)
        const isAbove = (hand1[12].y < forehead.y * 1.2) && (hand2[12].y < forehead.y * 1.2);

        if (!isAbove) return { detected: false, score: 0 };

        // **판별 핵심**
        // 손목이 손끝보다 이마에서 훨씬 멀어야 함.
        if (avgWristDist > avgTipDist * this.thresholds.wristToTipRatio &&
            avgTipDist < this.thresholds.maxTipDist) {

            // 양손 끝끼리도 가까워야 함 (하트가 닫혀야 함)
            const tipsGap = distanceAR(hand1[12], hand2[12], aspectRatio);

            if (tipsGap < this.thresholds.maxTipsGap) {
                return {
                    detected: true,
                    score: 0.99,
                    label: this.label
                };
            }
        }

        return { detected: false, score: 0 };
    }
}
