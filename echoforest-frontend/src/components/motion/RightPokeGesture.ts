import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { Landmark } from '../../utils/gesture-helpers';

export default class RightPokeGesture extends BaseGesture {
    thresholds: any;
    cheekPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.thresholds = {
            pokeDistance: 0.2, // 0.15~0.2 적절
            ...config
        };

        // 중요: 거울모드 및 Mediapipe 좌표계 특성상, 
        // 화면에서 사용자의 '오른쪽 볼'을 터치하려면 
        // 랜드마크 인덱스는 반대쪽(왼쪽 볼) 좌표를 써야 할 수 있음.
        this.cheekPoints = [187, 147, 116, 123, 50];
    }

    check(multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks; // [FIX]

        if (!faceLandmarks || faceLandmarks.length === 0) {
            return { detected: false, score: 0 };
        }
        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            return { detected: false, score: 0 };
        }

        // 오른손 찾기
        const sortedHands = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        let handR;
        if (sortedHands.length === 1) {
            handR = sortedHands[0];
        } else {
            handR = sortedHands[1];
        }

        const indexTip = handR[8];

        // 얼굴 크기
        let faceSize = metadata.faceSize || 0.1;
        if (!metadata.faceSize && faceLandmarks) {
            faceSize = this.distance(faceLandmarks[10], faceLandmarks[152]);
        }

        // 1. 검지 펴짐 체크 (필수) ✅
        if (!this.isFingerExtended(handR, 8, 6)) {
            return { detected: false, score: 0 };
        }

        // 2. 나머지 손가락 접힘 체크 (필수 - '가위'나 '보' 방지) ✅
        const isMiddleClosed = this.isFingerClosed(handR, 12, 10);
        const isRingClosed = this.isFingerClosed(handR, 16, 14);
        const isPinkyClosed = this.isFingerClosed(handR, 20, 18);

        if (!isMiddleClosed || !isRingClosed || !isPinkyClosed) {
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
        const isTouching = minDist < this.thresholds.pokeDistance;

        if (isTouching) {
            const score = Math.max(0.1, 1 - (minDist / this.thresholds.pokeDistance));
            return {
                detected: true,
                score: score,
                label: '오른볼콕! 👉'
            };
        }

        return {
            detected: false,
            score: 0
        };
    }
}
