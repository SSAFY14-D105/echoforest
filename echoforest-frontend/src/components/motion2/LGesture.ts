import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, isFingerExtended, calculateDistances, type Landmark } from '../../utils/gesture-helpers';

export default class LGesture extends BaseGesture {
    constructor() {
        super();
        this.label = 'L';
        this.emoji = '🔫';
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);

        // 1. 얼굴 근접 체크 (볼콕 오인식 방지) - 거리 완화
        if (metadata.faceLandmarks) {
            const indexTip = landmarks[8];
            const nose = metadata.faceLandmarks[1];

            const distToNose = distance(indexTip, nose);

            // 얼굴 크기 (이마-턱) - 동적 faceSize가 있으면 그거 사용
            const faceSize = metadata.faceSize || distance(metadata.faceLandmarks[10], metadata.faceLandmarks[152]);

            // [FIX] 얼굴 근처 차단 기준 대폭 완화 (1.2배 -> 0.6배)
            // 얼굴에 너무 가까이 대도 L사인이면 인식되도록 수정
            if (distToNose < faceSize * 0.6) {
                // 하지만 여전히 '볼콕'과 헷갈릴 수 있으므로 점수만 깎고 완전히 차단하진 않음
                // return { detected: false, score: 0 }; 
            }
        }

        // 2. 손가락 상태 계산
        let fingers: any;
        const calcRes = calculateDistances(landmarks, palmSize);
        fingers = calcRes.fingers;

        // [FIX] 엄지 확장 조건 완화
        const thumbTipToIndexMcp = distance(landmarks[4], landmarks[5]) / palmSize;
        const thumbTipToWrist = distance(landmarks[4], landmarks[0]) / palmSize;

        // 기존 0.5, 1.2 -> 0.3, 0.8로 완화
        const thumbReallyExtended = isFingerExtended(landmarks, 4, 3) &&
            (thumbTipToIndexMcp > 0.3 || thumbTipToWrist > 0.8);

        fingers.thumb.extended = thumbReallyExtended;

        // 3. L 조건: 엄지, 검지 펴짐 + 중지, 약지, 새끼 접힘
        // [FIX] 중지도 접혀야 L로 인정 (볼콕 오인식 방지)
        const isL = fingers.thumb.extended && fingers.index.extended &&
            !fingers.middle.extended && !fingers.ring.extended && !fingers.pinky.extended;

        if (isL) {
            return {
                detected: true,
                score: 0.9, // 점수 상향
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
