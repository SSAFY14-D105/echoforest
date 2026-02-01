import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, type Landmark } from '../../utils/gesture-helpers';

export default class FistGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '주먹';
        this.emoji = '✊';
    }

    check(landmarks: Landmark[], _metadata: GestureMetadata): GestureResult {
        const threshold = 0.8; // Default threshold

        // 만약 Helper가 fingers 객체를 제공하지 않는다면 계산
        // let fingers = (_metadata as any).fingers;

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
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
