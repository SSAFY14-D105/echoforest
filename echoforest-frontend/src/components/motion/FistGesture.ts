import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, calculateDistances, Landmark } from '../../utils/gesture-helpers';

export default class FistGesture extends BaseGesture {
    label: string;
    emoji: string;

    constructor() {
        super();
        this.label = '주먹';
        this.emoji = '✊';
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);
        const threshold = this.config.thresholds?.fist || 0.8;

        // fingers 데이터 재활용
        // @ts-ignore
        let fingers = metadata.fingers;

        if (!fingers) {
            const calcRes = calculateDistances(landmarks, palmSize);
            fingers = calcRes.fingers;
        }

        const isFingerClosed = (tipIdx: number, mcpIdx: number) => {
            const wrist = landmarks[0];
            return distance(landmarks[tipIdx], wrist) < distance(landmarks[mcpIdx], wrist) * threshold;
        };

        const closedCount = [
            isFingerClosed(4, 2),   // Thumb
            isFingerClosed(8, 5),   // Index
            isFingerClosed(12, 9),  // Middle
            isFingerClosed(16, 13), // Ring
            isFingerClosed(20, 17)  // Pinky
        ].filter(Boolean).length;

        if (closedCount >= 4) {
            const score = closedCount >= 5 ? 0.95 : 0.8;
            return {
                detected: true,
                score: score,
                label: this.label
            };
        }

        return { detected: false, score: 0 };
    }
}
