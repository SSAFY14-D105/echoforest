import BaseGesture from './BaseGesture.js';
import { distance, isFingerExtended } from '../utils/gesture-helpers.js';

export default class TalmoBeamGesture extends BaseGesture {
    constructor() {
        super();
        this.label = '탈모빔!';
        this.emoji = '⚡';
    }

    /**
     * 탈모빔 감지 (양손)
     * @param {Array} landmarks - 현재 처리 중인 손의 랜드마크 (사용 안 함)
     * @param {Object} metadata - { allHands: [hand1, hand2], palmSize: number }
     */
    check(landmarks, metadata) {
        const allHands = metadata.allHands;
        if (!allHands || allHands.length < 2) {
            return { detected: false, score: 0 };
        }

        const hand1 = allHands[0];
        const hand2 = allHands[1];
        const avgPalm = metadata.palmSize || distance(hand1[0], hand1[9]);

        // 엄지끼리의 거리
        const thumbDist = distance(hand1[4], hand2[4]) / avgPalm;

        // 각 손의 L자 형태 확인
        // Helper 함수로 각 손의 상태 확인
        const isLShape = (hand) => {
            const palm = distance(hand[0], hand[9]);
            const thumbExt = isFingerExtended(hand, 4, 3) &&
                (distance(hand[4], hand[5]) / palm > 0.5 || distance(hand[4], hand[0]) / palm > 1.2);
            const indexExt = isFingerExtended(hand, 8, 7);
            return thumbExt && indexExt;
        };

        const isLShape1 = isLShape(hand1);
        const isLShape2 = isLShape(hand2);

        // 조건: 엄지끼리 가깝고(1.0 이하), 양손 모두 L자 형태(또는 검지/엄지 펴짐)
        if (thumbDist < 1.0 && isLShape1 && isLShape2) {
            return {
                detected: true,
                score: 0.95,
                label: this.label,
                emoji: this.emoji,
                // 추가 메타데이터 반환 가능 (그리기용)
                extra: { showEffect: true }
            };
        }

        return { detected: false, score: 0 };
    }
}
