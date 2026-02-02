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
                (distance(hand[4], hand[5]) / palm > 0.5 || distance(hand[4], hand[0]) / palm > 1.2);
            const indexExt = isFingerExtended(hand, 8, 7);
            return thumbExt && indexExt;
        };

        const isLShape1 = isLShape(hand1);
        const isLShape2 = isLShape(hand2);

        // 조건: 엄지끼리 가깝고(1.0 이하), 양손 모두 L자 형태(또는 검지/엄지 펴짐)
        if (thumbDist < 1.0 && isLShape1 && isLShape2) {

            // [추가] 높이 조건: 손이 이마보다 낮으면(y값이 크면) 탈모빔 아님
            const face = metadata.faceLandmarks;
            if (face) {
                const forehead = face[10];
                // 손가락 끝(8)이 이마보다 확실히 위에 있거나, 적어도 눈보다는 위여야 함.
                // y는 아래로 갈수록 커짐. 따라서 hand.y < forehead.y * 1.3 (약간의 여유)
                if (hand1[8].y > forehead.y * 1.5 || hand2[8].y > forehead.y * 1.5) {
                    return { detected: false, score: 0 };
                }
            }

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
