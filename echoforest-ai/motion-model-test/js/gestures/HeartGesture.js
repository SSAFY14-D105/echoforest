import BaseGesture from './BaseGesture.js';

export default class HeartGesture extends BaseGesture {
    constructor(config = {}) {
        super(config);
        this.thresholds = {
            tipDistance: 0.15, // Max distance between fingers to consider "touching" (normalized by palm size)
            ...config
        };
    }

    check(multiHandLandmarks, metadata) {
        if (multiHandLandmarks.length < 2) {
            return { detected: false, score: 0, reason: 'Two hands required' };
        }

        // Sort hands by x-coordinate to easily identify left/right in view
        const sortedHands = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        const handL = sortedHands[0]; // Left side of screen
        const handR = sortedHands[1]; // Right side of screen

        // Heart typically involves meeting Thumb Tips and Index Tips
        // Thumb Tip: index 4, Index Tip: index 8
        const thumbL = handL[4];
        const thumbR = handR[4];
        const indexL = handL[8];
        const indexR = handR[8];

        const thumbDist = this.distance(thumbL, thumbR) / metadata.palmSize;
        const indexDist = this.distance(indexL, indexR) / metadata.palmSize;

        // 1. Proximity Check (Thumbs and Indices must be close)
        const isTouching = thumbDist < this.thresholds.tipDistance &&
            indexDist < this.thresholds.tipDistance;

        // 2. Vertical Alignment Check (Index tips should be above thumb tips)
        const isVertical = indexL.y < thumbL.y && indexR.y < thumbR.y;

        // 3. Heart Shape Check (Index fingers should curve INWARDS to meet)
        // Left hand (handL) index tip should be to the RIGHT of its MCP
        // Right hand (handR) index tip should be to the LEFT of its MCP
        const isCurvedL = indexL.x > handL[5].x;
        const isCurvedR = indexR.x < handR[5].x;
        const isHeartArch = isCurvedL && isCurvedR;

        // 4. Finger State (Optional/Relaxed)
        // We no longer require other fingers to be folded, but we might want to check 
        // if they aren't interfering too much. For now, let's keep it focused on Index/Thumb.

        // 5. Scoring and Result
        if (isTouching && isVertical && isHeartArch) {
            const score = Math.max(0, 1 - (thumbDist + indexDist) / (this.thresholds.tipDistance * 2));
            return {
                detected: true,
                score: score,
                label: '양손 하트! ❤️',
                emoji: '❤️',
                details: { thumbDist, indexDist, isVertical, isHeartArch }
            };
        }

        let reason = 'Conditions not met';
        if (!isTouching) reason = 'Fingers too far';
        else if (!isVertical) reason = 'Hands upside down';
        else if (!isHeartArch) reason = 'Index fingers not curved';

        return {
            detected: false,
            score: 0,
            reason: reason,
            details: { thumbDist, indexDist, isVertical, isHeartArch }
        };
    }
}
