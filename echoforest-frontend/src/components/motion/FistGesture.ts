<<<<<<< HEAD
import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';
=======
import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, type Landmark } from '../../utils/gesture-helpers';
>>>>>>> de01de68483739874f9083b4953344580dda6da3

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
<<<<<<< HEAD
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
=======
        const threshold = 0.8; // Default threshold

        // 만약 Helper가 fingers 객체를 제공하지 않는다면 계산
        // let fingers = (_metadata as any).fingers;
>>>>>>> de01de68483739874f9083b4953344580dda6da3

        const closedList = [isIndexClosed, isMiddleClosed, isRingClosed, isPinkyClosed];
        const closedCount = closedList.filter(Boolean).length;

        // 검지 포함 4손가락 중 3개 이상 접힘
        if (closedCount >= 3) {
            let score = 0.85;
            if (closedCount === 4) score += 0.1;
            if (isThumbClosed) score += 0.05;

            return {
                detected: true,
                score: Math.min(0.99, score),
                label: this.label
            };
        }

        return { detected: false, score: 0 };
    }
}
