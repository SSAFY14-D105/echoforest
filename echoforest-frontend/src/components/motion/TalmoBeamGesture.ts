<<<<<<< HEAD
import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class TalmoBeamGesture extends BaseGesture {
    label: string;
    emoji: string;
=======
import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { type Landmark } from '../../utils/gesture-helpers';

export default class TalmoBeamGesture extends BaseGesture {
>>>>>>> de01de68483739874f9083b4953344580dda6da3

    constructor() {
        super();
        this.label = '탈모빔!';
        this.emoji = '⚡';
    }

<<<<<<< HEAD
    /**
     * 탈모빔 감지 (양손)
     */
    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const allHands = metadata.allHands;
        if (!allHands || allHands.length < 2) {
            return { detected: false, score: 0 };
        }
=======
    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const hands = metadata.allHands;
        const face = metadata.faceLandmarks;
>>>>>>> de01de68483739874f9083b4953344580dda6da3

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

<<<<<<< HEAD
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
=======
                // 2. 위치 체크: 머리 위 혹은 이마 근처
                // 얼굴이 있으면 얼굴 좌표 참조, 없으면 그냥 화면 높이 기준
                let isNearHead = false;
                if (face && face.length > 0) {
                    const handY = hand[0].y;

                    // 손이 이마 근처(위아래 오차 허용)여야 함.
                    // 머리 근처에 있으면서(0.4 이내) + 얼굴 너무 가리지 않는(0.15 이상)?
                    // 탈모빔은 보통 이마에 갖다대거나 머리 위로 쏘니까...
                    // "머리 위" 조건: Hand Y < Face Nose Y
                    if (handY < face[4].y) {
                        isNearHead = true;
                    }
                } else {
                    // 얼굴 없으면 그냥 화면 상단
                    if (hand[0].y < 0.5) isNearHead = true;
                }

                if (isNearHead) {
                    return {
                        detected: true,
                        score: 0.95,
                        label: this.label,
                        emoji: this.emoji
                    };
>>>>>>> de01de68483739874f9083b4953344580dda6da3
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
