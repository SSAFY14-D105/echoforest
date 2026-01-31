import BaseGesture from './BaseGesture.js';
import { distance, distanceAR, isFingerExtended } from '../utils/gesture-helpers.js';

export default class TalmoBeamGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '탈모빔!';
        this.emoji = '⚡';
    }

    /**
     * 탈모빔 감지 (양손)
     * @param {Array} landmarks - 현재 처리 중인 손의 랜드마크 (사용 안 함)
     * @param {Object} metadata - { allHands: [], palmSize: number, aspectRatio: number }
     */
    check(landmarks, metadata) {
        const hands = metadata.allHands;
        const aspectRatio = metadata.aspectRatio || 1.0;

        if (!hands || hands.length < 2) {
            return { detected: false, score: 0 };
        }

        const hand1 = hands[0];
        const hand2 = hands[1];

        // 화면 좌표 사용 + AR 보정 (가장 안정적이라는 피드백 반영)
        const avgPalm = metadata.palmSize || distanceAR(hand1[0], hand1[9], aspectRatio);
        const thumbDist = distanceAR(hand1[4], hand2[4], aspectRatio) / avgPalm;

        // 각 손의 L자 형태 확인
        const isLShape1 = this._isLShape(hand1, aspectRatio);
        const isLShape2 = this._isLShape(hand2, aspectRatio);

        // 조건: 엄지끼리 어느정도 멀어야 함(0.9 이상), 양손 모두 L자 형태
        if (thumbDist > 0.9 && isLShape1 && isLShape2) {
            return {
                detected: true,
                score: 0.95,
                label: this.label,
                emoji: this.emoji,
                extra: { showEffect: true }
            };
        }

        return { detected: false, score: 0 };
    }

    /**
     * L자 모양인지 확인
     * @param {Array} hand - 화면 랜드마크
     * @param {number} ar - 종횡비
     */
    _isLShape(hand, ar) {
        // 거리 계산 (2D AR)
        const getDist = (idx1, idx2) => {
            return distanceAR(hand[idx1], hand[idx2], ar);
        };

        const palm = getDist(0, 5); // Wrist to Index MCP

        // 엄지 확장 여부
        // 1. 손목-엄지끝 > 손목-엄지IP (기본적으로 펴짐)
        // 2. 엄지끝-검지MCP / 손바닥 > 0.5 (충분히 벌어짐)
        const isThumbExtended = (getDist(4, 0) > getDist(3, 0))
            && (getDist(4, 5) / palm > 0.5)
            && (getDist(4, 8) / palm > 0.7);

        // 검지 확장 여부
        const isIndexExtended = getDist(8, 0) > getDist(6, 0);

        return isThumbExtended && isIndexExtended;
    }
}
