import BaseGesture, { GestureResult, GestureMetadata } from './BaseGesture';
import { distance, Landmark } from '../../../utils/gesture-helpers';

export default class OKGesture extends BaseGesture {
    constructor() {
        super();
        this.label = 'OK';
        this.emoji = '👌';
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);
        const threshold = 0.05; // Default

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const thumbIndexDist = distance(thumbTip, indexTip);
        const normalizedDist = thumbIndexDist / palmSize;

        if (normalizedDist < threshold) {
            // 거리가 매우 가까우면 더 높은 점수
            const score = normalizedDist < 0.12 ? 0.95 : 0.8;
            return {
                detected: true,
                score: score,
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
