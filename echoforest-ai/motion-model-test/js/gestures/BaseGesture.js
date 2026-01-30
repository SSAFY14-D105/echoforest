/**
 * 기본 제스처 클래스 (인터페이스)
 * 모든 제스처 감지 모듈은 이 클래스를 상속받아야 합니다.
 * 이 코드는 프론트엔드로 복사되어 사용될 수 있습니다.
 */
export default class BaseGesture {
    constructor(config = {}) {
        this.config = config;
    }

    /**
     * 제스처 감지 메서드
     * @param {Object} landmarks - MediaPipe 손 랜드마크 (0~20)
     * @param {Object} metadata - 추가 정보 (손바닥 크기 등)
     * @returns {Object} { detected: boolean, score: number }
     */
    check(landmarks, metadata) {
        throw new Error("check() method must be implemented");
    }

    /**
     * 두 점 사이의 거리 계산 (3D)
     */
    distance(p1, p2) {
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) +
            Math.pow(p1.y - p2.y, 2) +
            Math.pow((p1.z || 0) - (p2.z || 0), 2)
        );
    }
    /**
     * 손가락 펴짐 여부 확인
     */
    isFingerExtended(landmarks, tipIdx, pipIdx, threshold = 1.0) {
        const wrist = landmarks[0];
        return this.distance(landmarks[tipIdx], wrist) > this.distance(landmarks[pipIdx], wrist) * threshold;
    }

    /**
     * 손가락 접힘 여부 확인
     */
    isFingerClosed(landmarks, tipIdx, mcpIdx, threshold = 1.0) {
        const wrist = landmarks[0];
        return this.distance(landmarks[tipIdx], wrist) < this.distance(landmarks[mcpIdx], wrist) * threshold;
    }
}
