import BaseGesture from './BaseGesture.js';
import { distanceAR } from '../utils/gesture-helpers.js';

export default class TalmoBeamGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '탈모빔!';
        this.emoji = '⚡';
    }

    /**
     * 탈모빔 감지 (양손)
     */
    check(landmarks, metadata) {
        const hands = metadata.allHands;
        const aspectRatio = metadata.aspectRatio || 1.0;

        if (!hands || hands.length < 2) {
            return { detected: false, score: 0 };
        }

        const hand1 = hands[0];
        const hand2 = hands[1];

        // 화면 좌표 사용 + AR 보정
        const avgPalm = metadata.palmSize || distanceAR(hand1[0], hand1[9], aspectRatio);
        const thumbDist = distanceAR(hand1[4], hand2[4], aspectRatio) / avgPalm;

        // 각 손의 L자 형태 확인
        const isLShape1 = this._isLShape(hand1, aspectRatio);
        const isLShape2 = this._isLShape(hand2, aspectRatio);

        // 조건: 엄지끼리 어느정도 멀어야 함(0.9 이상), 양손 모두 L자 형태
        if (thumbDist > 0.9 && isLShape1 && isLShape2) {
            return {
                detected: true,
                score: 0.95,
                label: this.label,
                emoji: this.emoji,
                extra: { showEffect: true }
            };
        }

        return { detected: false, score: 0 };
    }

    /**
     * L자 모양인지 확인 (탈모빔용)
     * 조건: 
     * 1. 엄지와 검지는 펴져야 함.
     * 2. **중지(Middle Finger)는 반드시 접혀 있어야 함** (고양이 귀와 구분하기 위함)
     */
    _isLShape(hand, ar) {
        // 거리 계산 (2D AR)
        const getDist = (idx1, idx2) => {
            return distanceAR(hand[idx1], hand[idx2], ar);
        };

        // 탈모빔: 손이 얼굴(볼)에 붙어있지 않아야 함. (볼콕 방지)
        // 1. 손목 높이 체크: 손목이 턱보다 아래에 있으면 안됨? (탈모빔은 이마나 정수리 쪽 쏘니까)
        //    또는 손과 얼굴의 거리가 너무 가까우면 안됨.
        //    간단하게: 얼굴 랜드마크가 있고, 손목이 얼굴 중심(코)과 매우 가까우면(0.2 미만) 무시.
        //    여기서는 metadata에 얼굴 정보가 없으므로 생략하고, 중지 접힘 조건을 강력하게 믿음.

        // 중지 접힘 조건 강화
        const palm = getDist(0, 5);
        const dMiddleTip = getDist(12, 0);
        const dMiddleMcp = getDist(9, 0);
        // 확실히 접혀야 함 (Tip < MCP * 1.2)
        const isMiddleClosed = (dMiddleTip / dMiddleMcp) < 1.2;

        // 엄지 확장 여부
        const isThumbExtended = (getDist(4, 0) > getDist(3, 0))
            && (getDist(4, 5) / palm > 0.5)
            && (getDist(4, 8) / palm > 0.7);

        // 검지 확장 여부
        const isIndexExtended = getDist(8, 0) > getDist(6, 0);

        return isThumbExtended && isIndexExtended && isMiddleClosed;
    }
}
