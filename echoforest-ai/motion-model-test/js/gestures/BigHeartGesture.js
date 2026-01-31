import BaseGesture from './BaseGesture.js';
import { distanceAR } from '../utils/gesture-helpers.js';

export default class BigHeartGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '머리 위 하트! 🙆‍♂️';
        this.emoji = '🙆‍♂️';
    }

    check(landmarks, metadata) {
        const hands = metadata.allHands;
        const aspectRatio = metadata.aspectRatio || 1.0;
        const face = metadata.faceLandmarks;

        if (!hands || hands.length < 2 || !face || face.length === 0) {
            return { detected: false, score: 0 };
        }

        const hand1 = hands[0];
        const hand2 = hands[1];
        const forehead = face[10]; // 이마 최상단 포인트

        // **새로운 로직: 이마 중심 거리 비교**
        // 하트 자세: 양손 끝이 이마 위에서 만나고, 팔을 벌리므로 손목은 이마에서 멀어짐.
        // 조건 1: 손끝(Tip)은 이마와 가까워야 함.
        // 조건 2: 손목(Wrist)은 이마와 멀어야 함.
        // 조건 3: WristDist > TipDist (손목이 손끝보다 더 멀리 있음)

        const getDistToForehead = (pt) => distanceAR(pt, forehead, aspectRatio);

        // 1. 손끝(중지) 거리
        const tip1Dist = getDistToForehead(hand1[12]);
        const tip2Dist = getDistToForehead(hand2[12]);
        const avgTipDist = (tip1Dist + tip2Dist) / 2;

        // 2. 손목 거리
        const wrist1Dist = getDistToForehead(hand1[0]);
        const wrist2Dist = getDistToForehead(hand2[0]);
        const avgWristDist = (wrist1Dist + wrist2Dist) / 2;

        // 3. 높이 체크 (손이 이마보다 위에 있는지)
        // 이마 Y좌표보다 손목이나 팁의 Y좌표가 작아야 함. (화면상 높아야 함)
        // 약간의 오차 허용 (이마 라인에 걸쳐도 됨)
        const isAbove = (hand1[12].y < forehead.y * 1.2) && (hand2[12].y < forehead.y * 1.2);

        if (!isAbove) return { detected: false, score: 0 };

        // **판별 핵심**
        // 손목이 손끝보다 이마에서 훨씬 멀어야 함.
        // 그리고 손끝은 이마에 어느정도 가까워야 함 (너무 허공에 있으면 안됨)

        // 손끝이 이마 근처 (0.4 이내? 팔길이에 따라 다름)
        // 손목은 손끝보다 1.5배 이상 멀어야 함.
        if (avgWristDist > avgTipDist * 1.3 && avgTipDist < 0.45) {

            // 추가: 양손 끝끼리도 가까워야 함 (하트가 닫혀야 함)
            const tipsGap = distanceAR(hand1[12], hand2[12], aspectRatio);

            if (tipsGap < 0.16) { // 손끝이 확실히 모임 (고양이귀와의 경계 0.16)
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
