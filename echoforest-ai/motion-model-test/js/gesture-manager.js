export default class GestureManager {
    constructor() {
        this.gestures = [];
    }

    register(gestureInstance) {
        this.gestures.push(gestureInstance);
    }

    // multiHandLandmarks: 손 랜드마크 배열
    // faceLandmarks: 얼굴 랜드마크 (Optional, 볼콕 등 얼굴 제스처용)
    detectAll(multiHandLandmarks, faceLandmarks) {
        // 손이 없어도 얼굴만으로 체크하는 제스처가 있을 수 있지만, 
        // 현재는 손 데이터가 필수라고 가정 (없으면 즉시 리턴)
        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            return { type: 'none', score: 0, emoji: '🤚', label: '대기' };
        }

        // Shared metadata calculation
        const firstHand = multiHandLandmarks[0];
        const metadata = {
            palmSize: this.calculatePalmSize(firstHand),
            handCount: multiHandLandmarks.length,
            // 얼굴 크기 계산 (이마-턱 거리)
            faceSize: (faceLandmarks && faceLandmarks.length > 0) ?
                this.calculateFaceSize(faceLandmarks[0]) : null
        };

        let bestResult = { type: 'none', score: 0, emoji: '🤚', label: '대기' };

        // 첫 번째 얼굴만 사용한다고 가정
        const face = (faceLandmarks && faceLandmarks.length > 0) ? faceLandmarks[0] : null;

        for (const gesture of this.gestures) {
            // check 함수에 face 데이터도 전달
            const result = gesture.check(multiHandLandmarks, metadata, face);

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

    calculateFaceSize(landmarks) {
        // 이마(10) to 턱(152)
        const p1 = landmarks[10];
        const p2 = landmarks[152];
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) +
            Math.pow(p1.y - p2.y, 2) +
            Math.pow(p1.z - p2.z, 2)
        );
    }
}
