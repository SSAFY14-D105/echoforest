import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';

export default class HeartGesture extends BaseGesture {
    thresholds: any;

    constructor(config: any = {}) {
        super(config);
        this.thresholds = {
            // 접점 거리 임계값
            tipDistance: 0.25,
            ...config
        };
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        if (multiHandLandmarks.length < 2) {
            return { detected: false, score: 0 };
        }

        const sortedHands = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        const handL = sortedHands[0];
        const handR = sortedHands[1];

        const palmSize = metadata.palmSize!;

        // ========================================
        // 1. 핵심: 엄지와 검지가 만나는지 체크
        // ========================================
        const thumbDist = this.distance(handL[4], handR[4]) / palmSize;
        const indexDist = this.distance(handL[8], handR[8]) / palmSize;

        const isTouching = thumbDist < this.thresholds.tipDistance &&
            indexDist < this.thresholds.tipDistance;

        // ========================================
        // 2. 모양: 하트 형태인지 체크
        // ========================================

        // 2-1. 수직 정렬
        const isVertical = handL[8].y < handL[4].y && handR[8].y < handR[4].y;

        // 2-2. 아치 형태: 검지가 안쪽으로 굽어있어야 함
        const isCurvedL = handL[8].x > handL[5].x;
        const isCurvedR = handR[8].x < handR[5].x;

        // 2-3. 검지 굽힘(Bent) 체크 - 세모 방지 (가장 강력한 조건) ✨
        // 검지 뿌리(5) ↔ 검지 끝(8) 거리와 검지 첫마디(5-6) 거리 비교
        // 펴져 있으면(세모) 비율이 ~2.2 이상
        // 굽혀 있으면(하트) 비율이 < 2.0
        const indexLenL = this.distance(handL[5], handL[8]);
        const indexBaseL = this.distance(handL[5], handL[6]);
        const isBentL = indexLenL < indexBaseL * 2.0;

        const indexLenR = this.distance(handR[5], handR[8]);
        const indexBaseR = this.distance(handR[5], handR[6]);
        const isBentR = indexLenR < indexBaseR * 2.0;

        const isHeartShape = isVertical && isCurvedL && isCurvedR && isBentL && isBentR;

        // ========================================
        // 3. 최종 판정
        // ========================================
        if (isTouching && isHeartShape) {
            const score = Math.max(0.1, 1 - (thumbDist + indexDist) / (this.thresholds.tipDistance * 2));
            return {
                detected: true,
                score: score,
                label: '하트 ❤️'
            };
        }

        return {
            detected: false,
            score: 0
        };
    }
}
