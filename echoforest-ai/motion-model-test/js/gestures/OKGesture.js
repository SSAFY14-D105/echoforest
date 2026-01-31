import BaseGesture from './BaseGesture.js';
import { distance } from '../utils/gesture-helpers.js';

export default class OKGesture extends BaseGesture {
    constructor() {
        super();
        this.label = 'OK';
        this.emoji = '👌';
    }

    check(landmarks, metadata) {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);
        const threshold = metadata.thresholds?.ok || 0.05; // 설정값 주입

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
