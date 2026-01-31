import BaseGesture, { GestureResult, GestureMetadata } from './BaseGesture';
import { Landmark } from '../../utils/gesture-helpers';
import CheekHeartGesture from './CheekHeartGesture';

// BothCheekPokeGesture는 사실 CheekHeartGesture가 양손 감지를 지원하므로
// 별도의 로직이 필요 없을 수 있지만, 명시적인 분리나 가중치 조정을 위해 유지할 수 있음.
// 여기서는 CheekHeartGesture를 상속받거나 래핑하는 형태로 구현.

export default class BothCheekPokeGesture extends BaseGesture {
    private cheekHeartGesture: CheekHeartGesture;

    constructor() {
        super();
        this.label = '양손 볼찌르기! 👉👈';
        this.emoji = '👉👈';
        this.cheekHeartGesture = new CheekHeartGesture();
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        // CheekHeartGesture의 check 로직 사용
        const result = this.cheekHeartGesture.check(landmarks, metadata);

        // 양손이 다 감지되었을 때만 True 리턴 (Strict Mode)
        if (result.detected && result.left?.detected && result.right?.detected) {
            return {
                detected: true,
                score: result.score,
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
