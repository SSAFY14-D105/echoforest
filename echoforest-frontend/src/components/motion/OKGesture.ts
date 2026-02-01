import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class OKGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;

    constructor(config: any = {}) {
        super(config);
        this.label = 'OK';
        this.emoji = '👌';
        this.thresholds = {
            pinchDistance: 0.15, // 엄지-검지 거리 임계값 (0.05 -> 0.15로 완화)
            ...config
        };
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const thumbIndexDist = distance(thumbTip, indexTip);
        const normalizedDist = thumbIndexDist / palmSize;

        // 1. 엄지와 검지가 가까워야 함 (O 모양)
        if (normalizedDist < this.thresholds.pinchDistance) {

            // 2. 나머지 세 손가락 확인 (K 모양)
            // 중지(12), 약지(16), 소지(20) 중 최소 2개 이상은 펴져 있어야 함.
            const isMiddleOpen = isFingerExtended(landmarks, 12);
            const isRingOpen = isFingerExtended(landmarks, 16);
            const isPinkyOpen = isFingerExtended(landmarks, 20);

            // 중지와 약지는 확실히 펴져야 OK로 인정
            if (isMiddleOpen && isRingOpen) {
                return {
                    detected: true,
                    score: 0.9,
                    label: this.label
                };
            }
        }

        return { detected: false, score: 0 };
    }
}
