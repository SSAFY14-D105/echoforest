import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class LeftPokeGesture extends BaseGesture {
    thresholds: any;
    cheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '왼볼콕! 👈';
        this.emoji = '👈';
        this.thresholds = {
            pokeDistance: 0.25,
            ...config
        };

        // 왼쪽 볼 영역 (사용자의 왼쪽 볼)
        // 50(볼), 205(광대), 61(입꼬리), 187(귀쪽)
        this.cheekPoints = [50, 205, 61, 187];
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        // 왼손 찾기
        // 거울모드: 화면상 왼쪽에 있는 손 (x 좌표가 작은 손)
        const sortedHands = [...allHands].sort((a, b) => a[0].x - b[0].x);
        const handL = sortedHands[0]; // x가 가장 작은 손

        const indexTip = handL[8];
        const faceSize = metadata.faceSize || 0.1;

        // 1. 검지 펴짐 체크
        if (!isFingerExtended(handL, 8, 6)) {
            return { detected: false, score: 0 };
        }

        // 2. 볼과의 거리 체크
        let minDist = Infinity;
        for (const idx of this.cheekPoints) {
            const cheekPoint = faceLandmarks[idx];
            const d = distance(indexTip, cheekPoint);
            const normDist = d / faceSize;
            if (normDist < minDist) minDist = normDist;
        }

        if (minDist < this.thresholds.pokeDistance) {
            const score = Math.max(0.1, 1 - (minDist / this.thresholds.pokeDistance));
            return {
                detected: true,
                score: score,
                label: this.label
            };
        }

        return { detected: false, score: 0 };
    }
}
