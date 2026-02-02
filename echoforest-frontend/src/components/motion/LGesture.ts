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

        // 1. 얼굴 근접 체크 (볼콕 오인식 방지)
        if (metadata.faceLandmarks) {
            const indexTip = landmarks[8];
            const nose = metadata.faceLandmarks[1]; // 코 끝

            // 손가락 끝과 코 사이의 거리
            const distToNose = distance(indexTip, nose);

            // 얼굴 크기 (이마-턱)
            const faceTop = metadata.faceLandmarks[10];
            const faceBottom = metadata.faceLandmarks[152];
            const faceSize = distance(faceTop, faceBottom);

            // 얼굴 근처(얼굴 크기의 1.2배 이내)에 손이 있으면 L 인식 차단
            if (distToNose < faceSize * 1.2) {
                return { detected: false, score: 0 };
            }
        }

        // 2. 손가락 상태 계산
        // Helper의 calculateDistances는 extended만 반환하므로 closed는 !extended로 판단
        let fingers: any;
        const calcRes = calculateDistances(landmarks, palmSize);
        fingers = calcRes.fingers;

        // 엄지 특별 체크
        const thumbTipToIndexMcp = distance(landmarks[4], landmarks[5]) / palmSize;
        const thumbTipToWrist = distance(landmarks[4], landmarks[0]) / palmSize;
        const thumbReallyExtended = isFingerExtended(landmarks, 4, 3) &&
            (thumbTipToIndexMcp > 0.5 || thumbTipToWrist > 1.2);

        fingers.thumb.extended = thumbReallyExtended;

        // 3. L 조건: 엄지, 검지 펴짐 + 나머지 접힘
        const isL = fingers.thumb.extended && fingers.index.extended &&
            !fingers.middle.extended && !fingers.ring.extended && !fingers.pinky.extended;

        if (isL) {
            return {
                detected: true,
                score: 0.85,
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
