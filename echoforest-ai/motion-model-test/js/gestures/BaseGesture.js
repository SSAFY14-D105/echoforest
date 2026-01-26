export default class BaseGesture {
    constructor(config = {}) {
        this.config = config;
    }

    // 두 점 사이의 유클리드 거리 계산
    distance(p1, p2) {
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) +
            Math.pow(p1.y - p2.y, 2) +
            Math.pow((p1.z || 0) - (p2.z || 0), 2)
        );
    }

    // 손가락이 펴져있는지 확인 (Tip-Wrist 거리가 PIP-Wrist 거리보다 길어야 함)
    // threshold: 1.6 정도면 적당
    isFingerExtended(landmarks, tipIdx, pipIdx, threshold = 1.6) {
        const wrist = landmarks[0];
        const tip = landmarks[tipIdx];
        const pip = landmarks[pipIdx];

        return this.distance(wrist, tip) > this.distance(wrist, pip) * threshold;
    }

    // 손가락이 접혀있는지 확인
    isFingerClosed(landmarks, tipIdx, pipIdx, threshold = 1.4) {
        const wrist = landmarks[0];
        const tip = landmarks[tipIdx];
        const pip = landmarks[pipIdx];

        return this.distance(wrist, tip) < this.distance(wrist, pip) * threshold;
    }
}
