import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, type Landmark } from '../../utils/gesture-helpers';

export default class HeartGesture extends BaseGesture {
    label: string;
    emoji: string;
    private thresholds: any;

    constructor(config: any = {}) {
        super(config);
        this.thresholds = {
            tipDistance: 0.25,
            ...config
        };
        this.label = '하트 ❤️';
        this.emoji = '❤️';
    }

    check(_landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const hands = metadata.allHands;

        if (!hands || hands.length < 2) {
            return { detected: false, score: 0 };
        }

        const sortedHands = [...hands].sort((a, b) => a[0].x - b[0].x);
        const handL = sortedHands[0];
        const handR = sortedHands[1];

        const palmSize = metadata.palmSize || 1.0;

        // 1. 엄지와 검지가 만나는지 체크
        const thumbDist = distance(handL[4], handR[4]) / palmSize;
        const indexDist = distance(handL[8], handR[8]) / palmSize;

        const isTouching = thumbDist < this.thresholds.tipDistance &&
            indexDist < this.thresholds.tipDistance;

        // 2. 모양: 하트 형태인지 체크
        // 2-1. 수직 정렬
        const isVertical = handL[8].y < handL[4].y && handR[8].y < handR[4].y;

        // 2-2. 아치 형태: 검지가 안쪽으로 굽어있어야 함
        const isCurvedL = handL[8].x > handL[5].x;
        const isCurvedR = handR[8].x < handR[5].x;

        // 2-3. 검지 굽힘(Bent) 체크 - 세모 방지
        const indexLenL = distance(handL[5], handL[8]);
        const indexBaseL = distance(handL[5], handL[6]);
        const isBentL = indexLenL < indexBaseL * 2.0;

        const indexLenR = distance(handR[5], handR[8]);
        const indexBaseR = distance(handR[5], handR[6]);
        const isBentR = indexLenR < indexBaseR * 2.0;

        const isHeartShape = isVertical && isCurvedL && isCurvedR && isBentL && isBentR;

        if (isTouching && isHeartShape) {
            const score = Math.max(0.1, 1 - (thumbDist + indexDist) / (this.thresholds.tipDistance * 2));
            return {
                detected: true,
                score: score,
                label: this.label,
                emoji: this.emoji,
                extra: { thumbDist, indexDist }
            };
        }

        return { detected: false, score: 0 };
    }
}
