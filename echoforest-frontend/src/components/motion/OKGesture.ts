import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, isFingerExtended, type Landmark } from '../../utils/gesture-helpers';

export default class OKGesture extends BaseGesture {
    constructor() {
        super();
        this.label = 'OK';
        this.emoji = '👌';
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);

        // 1. 엄지와 검지 끝이 붙어있는지 확인 (거리 체크 - 동그라미)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const thumbIndexDist = distance(thumbTip, indexTip);
        const normalizedDist = thumbIndexDist / palmSize;

        const isTouch = normalizedDist < 0.2; // 0.2 이내면 붙은 것으로 간주

        // 2. 나머지 세 손가락(중지, 약지, 소지)이 펴져 있는지 확인
        const isMiddleExtended = isFingerExtended(landmarks, 12, 11);
        const isRingExtended = isFingerExtended(landmarks, 16, 15);
        const isPinkyExtended = isFingerExtended(landmarks, 20, 19);

        // 사용자가 요청한 단순 로직: 엄지-검지 붙고 + 나머지 펴짐 (2개 이상)
        const extendedCount = [isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;

        if (isTouch && extendedCount >= 2) {
            return {
                detected: true,
                score: 0.95, // 확실한 OK
                label: this.label,
                emoji: this.emoji,
                extra: { normalizedDist: normalizedDist.toFixed(3), extendedCount }
            };
        }

        // 디버깅용 정보 (인식 실패 시)
        // 붙긴 했는데 손가락이 안 펴졌으면 점수 부여 (하지만 detected: false)
        return {
            detected: false,
            score: isTouch ? 0.4 : 0,
            extra: { normalizedDist: normalizedDist.toFixed(3), extendedCount }
        };
    }
}
