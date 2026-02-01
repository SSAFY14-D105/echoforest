import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, Landmark } from '../../utils/gesture-helpers';

export default class LeftPokeGesture extends BaseGesture {
    thresholds: any;
    cheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        // "왼볼 콕"은 사용자가 왼손으로 왼쪽 볼을 찌르는 동작
        this.thresholds = {
            pokeDistance: 0.3,
            ...config
        };

        this.cheekPoints = [411, 376, 345, 352, 280];
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks; // [FIX]

        if (!faceLandmarks || faceLandmarks.length === 0) {
            return { detected: false, score: 0 };
        }
        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            return { detected: false, score: 0 };
        }

        // 왼손 찾기 (거울모드: 화면 왼쪽에 있는 손 = x좌표가 작은 손)
        const sortedHands = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        const handL = sortedHands[0]; // x가 가장 작은 손이 화면 왼쪽(왼손)

        const indexTip = handL[8];

        // 얼굴 크기
        let faceSize = metadata.faceSize || 0.1;
        if (!metadata.faceSize && faceLandmarks) {
            faceSize = this.distance(faceLandmarks[10], faceLandmarks[152]);
        }

        // 1. 검지 펴짐 체크 (유연하게 처리)
        // Case A: 완전히 펴짐 (threshold 1.2)
        // Case B: 살짝 구부러짐 (threshold 0.8) - "귀여운 콕" 지원
        const isIndexFullyExtended = this.isFingerExtended(handL, 8, 6, 1.2);
        const isIndexSemiExtended = this.isFingerExtended(handL, 8, 6, 0.8);

        // 검지가 너무 많이 접혀있으면(주먹 등) 즉시 실패
        if (!isIndexSemiExtended) {
            return { detected: false, score: 0 };
        }

        // 2. 나머지 손가락 접힘 체크 (필수 - '가위'나 '보' 방지) ✅
        const isMiddleClosed = this.isFingerClosed(handL, 12, 10);
        const isRingClosed = this.isFingerClosed(handL, 16, 14);
        const isPinkyClosed = this.isFingerClosed(handL, 20, 18);

        if (!isMiddleClosed || !isRingClosed || !isPinkyClosed) {
            return { detected: false, score: 0 };
        }

        // 3. 엄지 위치 체크 (손바닥 펴고 찌르기 방지)
        const thumbTip = handL[4];
        const middlePip = handL[10];
        const d4to10 = this.distance(thumbTip, middlePip);
        const palmSize = metadata.palmSize || 0.1;
        const normDist4to10 = d4to10 / palmSize;

        if (normDist4to10 > 0.35) {
            return { detected: false, score: 0 };
        }

        // 3. 볼과의 거리 체크
        let minDist = Infinity;

        this.cheekPoints.forEach(idx => {
            const cheekPoint = faceLandmarks[idx];
            const d = Math.sqrt(
                Math.pow(indexTip.x - cheekPoint.x, 2) +
                Math.pow(indexTip.y - cheekPoint.y, 2)
            );
            const normDist = d / faceSize;

            if (normDist < minDist) {
                minDist = normDist;
            }
        });

        // 4. 판정
        const isTouching = minDist < this.thresholds.pokeDistance; // 0.3
        const isCloseContact = minDist < 0.2;

        let detected = false;
        if (isIndexFullyExtended && isTouching) {
            detected = true;
        } else if (isIndexSemiExtended && isCloseContact) {
            detected = true;
        }

        if (detected) {
            const score = Math.max(0.1, 1 - (minDist / this.thresholds.pokeDistance));
            return {
                detected: true,
                score: score,
                label: '왼볼콕! 👈'
            };
        }

        return {
            detected: false,
            score: 0
        };
    }
}
