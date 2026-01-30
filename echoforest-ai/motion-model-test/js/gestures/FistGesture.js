import BaseGesture from './BaseGesture.js';
import { distance, calculateDistances, isFingerExtended } from '../utils/gesture-helpers.js';

export default class FistGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '주먹';
        this.emoji = '✊';
    }

    check(landmarks, metadata) {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);
        const threshold = metadata.thresholds?.fist || 0.8;

        // fingers 데이터 재활용
        let fingers = metadata.fingers;

        // Helper to check closed (if fingers obj not provided or incomplete)
        // Usually detector provides fingers, but let's be robust
        if (!fingers) {
            const calcRes = calculateDistances(landmarks, palmSize);
            fingers = calcRes.fingers;
            // Add closed logic similar to GestureTunerApp if not present in helper
            // Helper only does 'extended', not 'closed' property explicitly?
            // Actually helper returns `fingers` with `extended` property.
            // Closed logic was: distance(tip, wrist) < distance(mcp, wrist) * threshold
            // We need to implement it here if needed.
        }

        const isFingerClosed = (tipIdx, mcpIdx) => {
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
