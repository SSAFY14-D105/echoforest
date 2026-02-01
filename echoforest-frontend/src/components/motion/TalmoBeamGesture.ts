import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class TalmoBeamGesture extends BaseGesture {
    label: string;
    emoji: string;

    constructor() {
        super();
        this.label = '탈모빔!';
        this.emoji = '⚡';
    }

    /**
     * 탈모빔 감지 (양손)
     */
    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const allHands = metadata.allHands;
        if (!allHands || allHands.length < 2) {
            return { detected: false, score: 0 };
        }

        const hand1 = allHands[0];
        const hand2 = allHands[1];
        const avgPalm = metadata.palmSize || distance(hand1[0], hand1[9]);

        // 엄지끼리의 거리
        const thumbDist = distance(hand1[4], hand2[4]) / avgPalm;

        // 각 손의 L자 형태 확인
        const isLShape = (hand: any[]) => {
            const palm = distance(hand[0], hand[9]);
            const thumbExt = isFingerExtended(hand, 4, 3) &&
                (distance(hand[4], hand[5]) / palm > 0.5 || distance(hand[4], hand[0]) / palm > 1.2);
            const indexExt = isFingerExtended(hand, 8, 7);
            return thumbExt && indexExt;
        };

        const isLShape1 = isLShape(hand1);
        const isLShape2 = isLShape(hand2);

        // 조건: 엄지끼리 가깝고(1.0 이하), 양손 모두 L자 형태(또는 검지/엄지 펴짐)
        if (thumbDist < 1.0 && isLShape1 && isLShape2) {
            return {
                detected: true,
                score: 0.95,
                label: this.label,
                // extra: { showEffect: true } // TS Interface issue, omit or extend
            };
        }

        return { detected: false, score: 0 };
    }
}
