import BaseGesture, { GestureResult, GestureMetadata } from './BaseGesture';
import { distanceAR, calculateAngle, Landmark } from '../../../utils/gesture-helpers';

export default class BigHeartGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '머리 위 하트! 🙆‍♂️';
        this.emoji = '🙆‍♂️';
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
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

        // **판별 핵심: 삼각형 구조**
        // 손목이 손끝보다 이마에서 훨씬 멀어야 함 (팔을 벌림)
        // 그리고 손끝은 이마에 가까워야 함 (허공 X)
        if (avgWristDist > avgTipDist * 1.3 && avgTipDist < 0.45) {

            // 추가: 양손 끝끼리도 가까워야 함 (하트가 닫혀야 함)
            const tipsGap = distanceAR(hand1[12], hand2[12], aspectRatio);

            // 0.16 미만이면 하트 (고양이 귀는 0.16 이상)
            if (tipsGap < 0.16) {
                return {
                    detected: true,
                    score: 0.99,
                    label: this.label,
                    emoji: this.emoji
                };
            }
        }

        return { detected: false, score: 0 };
    }
}
