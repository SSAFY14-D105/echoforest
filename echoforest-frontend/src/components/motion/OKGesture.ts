import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, type Landmark } from '../../utils/gesture-helpers';

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

        const isTouch = normalizedDist < 0.25; // 0.2→0.25로 완화

        // 2. 나머지 세 손가락 펴짐 체크 (완화된 조건)
        // [FIX] 손목에서 끝까지 거리 > 손목에서 MCP까지 거리 * 0.9 → 살짝 구부러져도 OK
        const wrist = landmarks[0];
        const isMiddleExtended = distance(landmarks[12], wrist) > distance(landmarks[9], wrist) * 0.9;
        const isRingExtended = distance(landmarks[16], wrist) > distance(landmarks[13], wrist) * 0.9;
        const isPinkyExtended = distance(landmarks[20], wrist) > distance(landmarks[17], wrist) * 0.9;

        // 엄지-검지 붙고 + 나머지 1개 이상 펴짐 (2→1로 완화)
        const extendedCount = [isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;

        // [DEBUG] 실시간 상태 추적
        const debugInfo = {
            normalizedDist: normalizedDist.toFixed(3),
            isTouch,
            extendedCount,
            middle: isMiddleExtended,
            ring: isRingExtended,
            pinky: isPinkyExtended
        };

        if (isTouch && extendedCount >= 2) {
            return {
                detected: true,
                score: 0.95, // 확실한 OK
                label: this.label,
                emoji: this.emoji,
                extra: debugInfo
            };
        }

        // 디버깅용 정보 (인식 실패 시)
        // 붙긴 했는데 손가락이 안 펴졌으면 점수 부여 (하지만 detected: false)
        return {
            detected: false,
            score: isTouch ? 0.4 : 0,
            extra: debugInfo
        };
    }
}
