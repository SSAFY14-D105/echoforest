import BaseGesture, { GestureResult, GestureMetadata } from './BaseGesture';
import { distance, distanceAR, Landmark } from '../../../utils/gesture-helpers';

export default class CatEarsGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '고양이 귀! 🐱';
        this.emoji = '🐱';
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
        const forehead = face[10];

        // 1. 위치 체크 (머리 위)
        const isAbove = (hand1[9].y < forehead.y * 1.25) && (hand2[9].y < forehead.y * 1.25);
        if (!isAbove) return { detected: false, score: 0 };

        // 2. 거리 체크 (하트와 구분)
        const tipsGap = distanceAR(hand1[12], hand2[12], aspectRatio);

        // 0.16 미만이면 하트
        if (tipsGap < 0.16) {
            return { detected: false, score: 0 };
        }

        // 3. 손가락 체크 (검지/중지)
        const isIndex1 = this._isFingerStraight(hand1, 8, 5);
        const isMiddle1 = this._isFingerStraight(hand1, 12, 9);
        const isIndex2 = this._isFingerStraight(hand2, 8, 5);
        const isMiddle2 = this._isFingerStraight(hand2, 12, 9);

        if (isIndex1 && isMiddle1 && isIndex2 && isMiddle2) {
            return {
                detected: true,
                score: 0.98,
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }

    private _isFingerStraight(hand: Landmark[], idxTip: number, idxMcp: number): boolean {
        const tip = hand[idxTip];
        const mcp = hand[idxMcp];
        const pip = hand[idxMcp + 1];
        const dip = hand[idxMcp + 2];

        const len1 = distance(mcp, pip);
        const len2 = distance(pip, dip);
        const len3 = distance(dip, tip);
        const totalLen = len1 + len2 + len3;
        const directDist = distance(mcp, tip);

        return (directDist / totalLen) > 0.8;
    }
}
