import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class RightPokeGesture extends BaseGesture {
    thresholds: any;
    cheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '오른볼콕! 👉';
        this.emoji = '👉';
        this.thresholds = {
            pokeDistance: 0.25, // 넉넉하게
            ...config
        };

        // 오른쪽 볼 영역 (사용자의 오른쪽 볼)
        // 280(볼), 425(광대), 291(입꼬리), 411(귀쪽)
        this.cheekPoints = [280, 425, 291, 411];
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        // 오른손 찾기
        // 거울모드: 화면상 오른쪽에 있는 손 (x 좌표가 큰 손) -> 일반적으로 x는 0(왼) ~ 1(오)
        // 사용자가 오른손을 들면 화면상 오른쪽에 나타남 (거울)
        // 따라서 x가 가장 큰 손이 오른손
        const sortedHands = [...allHands].sort((a, b) => b[0].x - a[0].x);
        const handR = sortedHands[0]; // x가 가장 큰 손

        const indexTip = handR[8];
        const faceSize = metadata.faceSize || 0.1;

        // 1. 검지 펴짐 체크 (필수)
        // 인자: (landmarks, tip, pip) - 검지: 8, 6
        if (!isFingerExtended(handR, 8, 6)) {
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
