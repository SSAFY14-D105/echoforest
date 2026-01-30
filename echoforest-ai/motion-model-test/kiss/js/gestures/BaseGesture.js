/**
 * BaseGesture - 제스처 감지 기본 클래스
 * 모든 제스처 클래스의 부모 클래스
 */
export class BaseGesture {
    constructor(name, icon) {
        this.name = name;
        this.icon = icon;
        this.thresholds = {};
    }

    /**
     * 두 점 사이의 거리 계산
     */
    distance(p1, p2) {
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) +
            Math.pow(p1.y - p2.y, 2) +
            Math.pow((p1.z || 0) - (p2.z || 0), 2)
        );
    }

    /**
     * 제스처 감지 (하위 클래스에서 구현)
     * @param {Object} data - 랜드마크 데이터
     * @returns {Object} - { detected: boolean, score: number, data: Object }
     */
    detect(data) {
        throw new Error('detect() must be implemented by subclass');
    }

    /**
     * 임계값 설정
     */
    setThreshold(key, value) {
        this.thresholds[key] = value;
    }

    /**
     * 임계값 조회
     */
    getThreshold(key) {
        return this.thresholds[key];
    }

    /**
     * 제스처 정보 반환
     */
    getInfo() {
        return {
            name: this.name,
            icon: this.icon,
            thresholds: { ...this.thresholds }
        };
    }
}
