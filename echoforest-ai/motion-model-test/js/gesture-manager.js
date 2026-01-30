/**
 * 제스처 관리자
 * 등록된 제스처들을 순회하며 감지 수행
 */
export default class GestureManager {
    constructor() {
        this.gestures = [];
    }

    register(gestureInstance) {
        this.gestures.push(gestureInstance);
    }

    detectAll(landmarks) {
        // 메타데이터 계산 (한 번만 해서 공유)
        const wrist = landmarks[0];
        const middleMcp = landmarks[9]; // 중지 뿌리
        const palmSize = Math.sqrt(
            Math.pow(wrist.x - middleMcp.x, 2) +
            Math.pow(wrist.y - middleMcp.y, 2)
        );

        const metadata = { palmSize };
        let bestResult = { type: 'none', score: 0, emoji: '🤚', label: '대기' };

        for (const gesture of this.gestures) {
            const result = gesture.check(landmarks, metadata);

            if (result.detected && result.score > bestResult.score) {
                bestResult = {
                    type: gesture.constructor.name, // 클래스 이름
                    ...result
                };
            }
        }

        return bestResult;
    }
}
