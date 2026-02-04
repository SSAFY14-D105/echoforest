import BaseGesture, { type GestureResult, type GestureMetadata } from './BaseGesture';
import { distance, isFingerExtended, calculateDistances, calculateAngle, type Landmark } from '../../utils/gesture-helpers';

export default class LGesture extends BaseGesture {
    constructor() {
        super();
        this.label = 'L';
        this.emoji = '🔫';
    }

    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const palmSize = metadata.palmSize || distance(landmarks[0], landmarks[9]);

        // 1. 얼굴 근접 체크 (볼콕 오인식 방지) - 거리 완화
        // 1. 얼굴 근접 체크 로직 제거됨 (볼콕 오인식 방지 로직은 2번 스텝에서 처리)

        // 2. 손가락 상태 계산
        let fingers: any;
        const calcRes = calculateDistances(landmarks, palmSize);
        fingers = calcRes.fingers;

        // [FIX] 엄지 확장 조건 완화
        const thumbTipToIndexMcp = distance(landmarks[4], landmarks[5]) / palmSize;

        // [FIX] 엄지 인식 로직 개선: 각도(직선) + 거리(벌림) 체크
        // isFingerExtended는 엄지의 경우 부정확할 수 있음
        const thumbAngle = calculateAngle(landmarks[2], landmarks[3], landmarks[4]);
        const isThumbStraight = thumbAngle > 150; // 엄지가 펴져 있는지 (180도에 가까움)

        // 엄지가 검지 기저부(5)에서 충분히 떨어져 있어야 함 (L자 모양 = 벌림)
        const isThumbAbducted = thumbTipToIndexMcp > 0.25;

        // [중요] 볼콕과 구분하기 위해, 엄지가 중지 두번째 마디(PIP, 10)에서 멀어야 함
        // 볼콕은 엄지가 주먹쥐듯 말려들어가있음
        const thumbTipToMiddlePIP = distance(landmarks[4], landmarks[10]) / palmSize;
        const isThumbFarFromMiddle = thumbTipToMiddlePIP > 0.4;

        // 기존 OR 조건(||)은 엄지가 검지에 붙어있어도(Adducted) 길이가 길면(WristDistance) 통과되는 문제 있었음
        // -> AND 조건(&&)으로 변경하여 확실히 벌려진 상태만 인식
        const thumbReallyExtended = isThumbStraight && isThumbAbducted && isThumbFarFromMiddle;

        fingers.thumb.extended = thumbReallyExtended;

        // 3. L 조건: 엄지, 검지 펴짐 + 중지, 약지, 새끼 접힘
        // [FIX] 중지도 접혀야 L로 인정 (볼콕 오인식 방지)
        const isL = fingers.thumb.extended && fingers.index.extended &&
            !fingers.middle.extended && !fingers.ring.extended && !fingers.pinky.extended;

        if (isL) {
            // [FIX] 양손 L자 체크 - 둘 다 L이면 BigHeart로 간주하고 L 인식 차단
            if (metadata.allHands && metadata.allHands.length >= 2) {
                const otherHand = metadata.allHands[1];
                const otherPalmSize = distance(otherHand[0], otherHand[9]);
                const otherCalcRes = calculateDistances(otherHand, otherPalmSize);
                const otherFingers = otherCalcRes.fingers;

                // 다른 손 엄지 확장 체크
                const otherThumbTipToIndexMcp = distance(otherHand[4], otherHand[5]) / otherPalmSize;
                const otherThumbTipToWrist = distance(otherHand[4], otherHand[0]) / otherPalmSize;
                const otherThumbExtended = isFingerExtended(otherHand, 4, 3) &&
                    (otherThumbTipToIndexMcp > 0.3 || otherThumbTipToWrist > 0.8);

                const isOtherL = otherThumbExtended && otherFingers.index.extended &&
                    !otherFingers.middle.extended && !otherFingers.ring.extended && !otherFingers.pinky.extended;

                if (isOtherL) {
                    // 양손 다 L → BigHeart로 넘김
                    return { detected: false, score: 0 };
                }
            }

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
