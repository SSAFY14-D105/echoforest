import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { isFingerExtended, distance, calculateAngle, type Landmark } from '../../utils/gesture-helpers';

export default class FistGesture extends BaseGesture {

    constructor() {
        super();
        this.label = '엄지척!';
        this.emoji = '👍';
    }

    check(landmarks: Landmark[], _metadata: GestureMetadata): GestureResult {
        // 엄지척: 엄지는 펴지고, 나머지 4개 손가락은 접혀 있어야 함

        // [FIX] 엄지 굽힙/펴짐 판단 개선: 엄지 끝과 검지 첫마디 거리로 판단
        // 엄지척: 엄지(4)와 검지 첫마디(7) 사이 거리가 멈
        // 주먹: 엄지가 검지 위에 올라가서 거리가 가까움

        const palmSize = distance(landmarks[0], landmarks[9]);

        // 엄지 끝(4)과 검지 첫마디(7) 사이 거리
        const thumbToIndexKnuckle = distance(landmarks[4], landmarks[7]) / palmSize;

        // 엄지가 검지에서 충분히 멀리 떨어져 있어야 엄지척으로 인정
        const isThumbExtended = thumbToIndexKnuckle > 0.8; // 0.8 * palmSize 이상 떨어져야 함

        const isIndexClosed = !isFingerExtended(landmarks, 8, 6);
        const isMiddleClosed = !isFingerExtended(landmarks, 12, 10);
        const isRingClosed = !isFingerExtended(landmarks, 16, 14);
        const isPinkyClosed = !isFingerExtended(landmarks, 20, 18);

        const closedList = [isIndexClosed, isMiddleClosed, isRingClosed, isPinkyClosed];
        const closedCount = closedList.filter(Boolean).length;

        // 디버깅용 상태 정보
        const debugInfo = {
            thumb: isThumbExtended,
            thumbToIndexDist: thumbToIndexKnuckle.toFixed(2),
            closedCount,
            index: isIndexClosed,
            middle: isMiddleClosed,
            ring: isRingClosed,
            pinky: isPinkyClosed
        };

        // [엄격] 엄지 펴지고 + 4개 손가락 모두 접힘만 인정 (threshold 0.8 이상)
        if (isThumbExtended && closedCount === 4) {
            return {
                detected: true,
                score: 0.85,
                label: this.label,
                emoji: this.emoji,
                extra: debugInfo
            };
        }

        // [거의] 4개 손가락은 접혔지만 엄지가 안 펴짐 → threshold 미만 (0.49)
        if (!isThumbExtended && closedCount === 4) {
            return {
                detected: false,
                score: 0.49,
                extra: debugInfo
            };
        }

        // [실패] 그 외 모든 경우 → 0점 (3개만 접혀도 인정 안 함)
        return {
            detected: false,
            score: 0,
            extra: debugInfo
        };
    }
}
