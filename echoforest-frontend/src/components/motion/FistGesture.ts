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
            // 특별한 threshold 필요 없음 (isFingerExtended 로직 사용)
            ...config
        };
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        // 손가락이 접혀있는지 확인 (펴져있지 않으면 접힌 것)
        // 인자: (landmarks, tipIdx, pipIdx)
        const isIndexClosed = !isFingerExtended(landmarks, 8, 6);
        const isMiddleClosed = !isFingerExtended(landmarks, 12, 10);
        const isRingClosed = !isFingerExtended(landmarks, 16, 14);
        const isPinkyClosed = !isFingerExtended(landmarks, 20, 18);
        const isThumbClosed = !isFingerExtended(landmarks, 4, 3);

        const closedList = [isIndexClosed, isMiddleClosed, isRingClosed, isPinkyClosed];
        const closedCount = closedList.filter(Boolean).length;

        // 검지, 중지, 약지, 소지 중 3개 이상 접혀있으면 주먹으로 인정
        // (엄지는 사람마다 쥐는 방식이 다양해서 제외하거나 가산점으로만 사용)
        if (closedCount >= 3) {
            let score = 0.85;
            if (closedCount === 4) score += 0.1; // 4개 다 접히면 가산
            if (isThumbClosed) score += 0.05; // 엄지까지 접히면 가산

            return {
                detected: true,
                score: Math.min(0.99, score),
                label: this.label
            };
        }

        return { detected: false, score: 0 };
    }
}
