import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class FistGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;

    constructor(config: any = {}) {
        super(config);
        this.label = '주먹';
        this.emoji = '✊';
        this.thresholds = {
            ...config
        };
    }

    check(landmarks: Landmark[], _metadata: GestureMetadata): GestureResult {
        // 손가락 접힘 여부 (Tip-Wrist vs PIP-Wrist)
        const isIndexClosed = !isFingerExtended(landmarks, 8, 6);
        const isMiddleClosed = !isFingerExtended(landmarks, 12, 10);
        const isRingClosed = !isFingerExtended(landmarks, 16, 14);
        const isPinkyClosed = !isFingerExtended(landmarks, 20, 18);
        const isThumbClosed = !isFingerExtended(landmarks, 4, 3);

        // [중요] 주먹이라면 검지는 무조건 접혀 있어야 함!
        // 검지가 펴져 있으면 '가위'나 '볼콕' 등 다른 제스처일 확률이 높음
        if (!isIndexClosed) {
            return { detected: false, score: 0 };
        }

        const closedList = [isIndexClosed, isMiddleClosed, isRingClosed, isPinkyClosed];
        const closedCount = closedList.filter(Boolean).length;

        // [수정] 주먹은 4손가락이 모두 접혀 있어야 함 (하나라도 펴지면 주먹 아님)
        if (closedCount === 4) {
            let score = 0.95;
            if (isThumbClosed) score += 0.04;

            return {
                detected: true,
                score: Math.min(0.99, score),
                label: this.label
            };
        }

        return { detected: false, score: 0 };
    }
}
