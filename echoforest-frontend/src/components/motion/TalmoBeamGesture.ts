import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, isFingerExtended, type Landmark } from '../../utils/gesture-helpers';

export default class TalmoBeamGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '탈모빔!';
        this.emoji = '⚡';
    }

    /**
     * 탈모빔 감지 (양손)
     */
    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
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
                (distance(hand[4], hand[5]) / palm > 0.3 || distance(hand[4], hand[0]) / palm > 0.8);
            const indexExt = isFingerExtended(hand, 8, 7);

            // [중요] 중지, 약지, 새끼는 반드시 접혀 있어야 함
            const middleFolded = this.isFingerClosed(hand, 12, 9);
            const ringFolded = this.isFingerClosed(hand, 16, 13);
            const pinkyFolded = this.isFingerClosed(hand, 20, 17);

            // [추가] 엄지가 중지 두번째 마디(PIP, 10번)와 너무 가까우면 안 됨 (주먹 쥔 상태 방지)
            const thumbToMiddleDist = distance(hand[4], hand[10]) / palm;
            const thumbIsFarFromMiddle = thumbToMiddleDist > 0.3;

            return thumbExt && indexExt && middleFolded && ringFolded && pinkyFolded && thumbIsFarFromMiddle;
        };

        const isLShape1 = isLShape(hand1);
        const isLShape2 = isLShape(hand2);

        // 조건: 엄지끼리 적당히 떨어져 있어야 함 (탈모빔은 관자놀이 쪽이니까)
        if (thumbDist > 0.5 && isLShape1 && isLShape2) {
            return {
                detected: true,
                score: 0.95,
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
