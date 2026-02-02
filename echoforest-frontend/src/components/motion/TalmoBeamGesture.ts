import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { type Landmark } from '../../utils/gesture-helpers';

export default class TalmoBeamGesture extends BaseGesture {

    constructor() {
        super();
        this.label = '탈모빔! ☀️ (빠박이)';
        this.emoji = '☀️';
    }

    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const hands = metadata.allHands;
        const face = metadata.faceLandmarks;

        if (!hands || !hands.length) return { detected: false, score: 0 };

        // 양손 검사 (하나라도 빔이면 OK)
        for (const hand of hands) {

            // 1. L자 모양 (엄지/검지 펴고 중지 접음)
            if (this._isLShape(hand)) {

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
                }
            }
        }

        return { detected: false, score: 0 };
    }

    private _isLShape(hand: Landmark[]): boolean {
        // 엄지는 펴짐 (4-2 > 3-2?)
        // 검지는 펴짐 (8-5 > 6-5?)
        // 중지, 약지, 소지는 접힘 (Tip이 MCP에 가까움)

        // 간단한 Finger State Check
        const isThumbExtended = this._isFingerExtended(hand, 4, 3); // 엄지
        const isIndexExtended = this._isFingerExtended(hand, 8, 6); // 검지

        // 중지가 접혀야 함 (핵심)
        // Tip(12)과 Wrist(0) 거리 vs MCP(9)와 Wrist(0) 거리
        // 혹은 Tip(12)이 PalmCenter(0,9,13) 쪽으로 굽힘
        const isMiddleClosed = !this._isFingerExtended(hand, 12, 10);
        const isRingClosed = !this._isFingerExtended(hand, 16, 14);
        const isPinkyClosed = !this._isFingerExtended(hand, 20, 18);

        return isThumbExtended && isIndexExtended && isMiddleClosed && isRingClosed && isPinkyClosed;
    }
}
