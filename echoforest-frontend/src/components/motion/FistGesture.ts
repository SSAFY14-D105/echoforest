import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { isFingerExtended, type Landmark } from '../../utils/gesture-helpers';

export default class FistGesture extends BaseGesture {

    constructor() {
        super();
        this.label = '주먹';
        this.emoji = '✊';
    }

    check(landmarks: Landmark[], _metadata: GestureMetadata): GestureResult {
        // 손가락 접힘 여부 (Tip-Wrist vs PIP-Wrist)
        const isIndexClosed = !isFingerExtended(landmarks, 8, 6);
        const isMiddleClosed = !isFingerExtended(landmarks, 12, 10);
        const isRingClosed = !isFingerExtended(landmarks, 16, 14);
        const isPinkyClosed = !isFingerExtended(landmarks, 20, 18);
        const isThumbClosed = !isFingerExtended(landmarks, 4, 3); // 엄지 체크 방식이 다를 수 있음 (거리 등)

        const closedList = [isIndexClosed, isMiddleClosed, isRingClosed, isPinkyClosed];
        const closedCount = closedList.filter(Boolean).length;

        // 기본 점수: 접힌 손가락 개수 비례 (0 ~ 0.8)
        let score = (closedCount / 4) * 0.8;

        // 엄지까지 접혔으면 보너스
        if (isThumbClosed) score += 0.1;

        // [중요] 주먹이라면 검지는 무조건 접혀 있어야 함! (가중치 부여)
        if (!isIndexClosed) score *= 0.5; // 검지 펴져 있으면 점수 반토막

        // [엄격] 5손가락 모두 접혀 있어야 함 (엄지 포함)
        // 4개 이상 접혀있고, 엄지도 접혀있으면 합격 (완벽한 주먹)
        if (closedCount === 4 && isThumbClosed) {
            return {
                detected: true,
                score: 0.99,
                label: this.label,
                emoji: this.emoji
            };
        } else if (closedCount === 4 && !isThumbClosed) {
            // [FIX] 엄지가 펴져 있어도 나머지 4개가 다 접혔으면 주먹으로 인정 (따봉일 수 있지만 관대하게 허용)
            // 사용자가 "주먹"을 쥐었는데 엄지가 살짝 떠서 인식이 안 되는 경우 방지
            return {
                detected: true,
                score: 0.85,
                label: this.label,
                emoji: this.emoji,
                extra: { closedCount, thumb: isThumbClosed, idx: isIndexClosed }
            };
        } else if (closedCount >= 3 && isThumbClosed) {
            // 3개 + 엄지면 약간 낮은 점수로 인정 (검지는 필수)
            if (isIndexClosed) {
                return {
                    detected: true,
                    score: 0.8,
                    label: this.label,
                    emoji: this.emoji,
                    extra: { closedCount, thumb: isThumbClosed, idx: isIndexClosed }
                };
            }
        }

        // 실패더라도 계산된 점수 반환 (디버깅용)
        return {
            detected: false,
            score: score,
            extra: { closedCount, thumb: isThumbClosed, idx: isIndexClosed }
        };
    }
}
