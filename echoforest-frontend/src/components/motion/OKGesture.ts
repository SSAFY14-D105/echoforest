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
            pinchDistance: 0.2, // 인식 범위 0.2로 확대 (매우 관대함)
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

            // 2. 나머지 손가락 펴짐 확인 (K 모양)
            // 인자: (landmarks, tipIdx, pipIdx)
            // 중지(12-10), 약지(16-14), 소지(20-18)
            const isMiddleOpen = isFingerExtended(landmarks, 12, 10);
            // 약지나 소지는 사람마다 구부러질 수 있으므로 체크 완화

            // 최소한 중지는 펴져 있어야 주먹(Fist)과 구분됨
            if (isMiddleOpen) {
                return {
                    detected: true,
                    score: 0.95, // 점수 상향
                    label: this.label
                };
            }
        }

        return { detected: false, score: 0 };
    }
}
