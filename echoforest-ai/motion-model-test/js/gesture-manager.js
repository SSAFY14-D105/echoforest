export default class GestureManager {
    constructor() {
        this.gestures = [];
    }

    register(gestureInstance) {
        this.gestures.push(gestureInstance);
    }

    // multiHandLandmarks: Array of 21-landmark arrays
    detectAll(multiHandLandmarks) {
        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            return { type: 'none', score: 0, emoji: '🤚', label: '대기' };
        }

        // Shared metadata calculation (using the first hand for reference if single-hand needed)
        const firstHand = multiHandLandmarks[0];
        const metadata = {
            palmSize: this.calculatePalmSize(firstHand),
            handCount: multiHandLandmarks.length
        };

        let bestResult = { type: 'none', score: 0, emoji: '🤚', label: '대기' };

        for (const gesture of this.gestures) {
            const result = gesture.check(multiHandLandmarks, metadata);
            if (result.detected && result.score > bestResult.score) {
                bestResult = { type: gesture.constructor.name, ...result };
            }
        }

        return bestResult;
    }

    calculatePalmSize(landmarks) {
        // Wrist(0) to Middle-MCP(9)
        const p1 = landmarks[0];
        const p2 = landmarks[9];
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) +
            Math.pow(p1.y - p2.y, 2) +
            Math.pow(p1.z - p2.z, 2)
        );
    }
}
