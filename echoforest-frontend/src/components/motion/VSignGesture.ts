import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, type Landmark } from '../../utils/gesture-helpers';

export default class VSignGesture extends BaseGesture {
    private thresholds: any;

    constructor(config: any = {}) {
        super(config);
        // 기본 임계값
        this.thresholds = {
            fingerFold: 1.1,     // 손가락 접힘 판단
            vAngleMin: 15,       // V 최소 각도
            vAngleMax: 70,       // V 최대 각도
            ...config
        };
        this.label = 'V';
        this.emoji = '✌️';
    }

    /**
     * 벡터 각도 계산 (Degree) - VSign 전용 로직
     */
    private calculateAngle(p1: Landmark, p2: Landmark, p3: Landmark): number {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        // 0으로 나누기 방지
        if (mag1 === 0 || mag2 === 0) return 0;

        const val = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        const angle = Math.acos(val);
        return angle * (180 / Math.PI);
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const t = this.thresholds;
        const wrist = landmarks[0];

        // 1. 손가락 상태 확인 함수
        const isExtended = (tipIdx: number, pipIdx: number) => {
            return distance(landmarks[tipIdx], wrist) > distance(landmarks[pipIdx], wrist);
        };
        const isFolded = (tipIdx: number, mcpIdx: number) => {
            return distance(landmarks[tipIdx], wrist) < distance(landmarks[mcpIdx], wrist) * t.fingerFold;
        };

        // 2. 핵심 조건: 검지(8)와 중지(12)는 펴져야 함
        const indexExtended = isExtended(8, 7);
        const middleExtended = isExtended(12, 11);

        if (!indexExtended || !middleExtended) {
            return { detected: false, score: 0 };
        }

        // 3. 약지(16)와 새끼(20)는 접혀야 함
        const ringFolded = isFolded(16, 13);
        const pinkyFolded = isFolded(20, 17);

        if (!ringFolded || !pinkyFolded) {
            return { detected: false, score: 0 };
        }

        // 4. V 각도 확인 (손목 중심 검지-중지 각도)
        const angle = this.calculateAngle(landmarks[8], landmarks[0], landmarks[12]);

        if (angle < t.vAngleMin) {
            return { detected: false, score: 0 };
        }

        // 5. 점수 계산
        let score = 0.8;
        if (angle > 20 && angle < 50) score = 0.95;

        return {
            detected: true,
            score: score,
            label: this.label,
            emoji: this.emoji,
            extra: { angle }
        };
    }
}
