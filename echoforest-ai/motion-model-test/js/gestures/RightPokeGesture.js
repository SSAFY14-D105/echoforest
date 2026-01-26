import BaseGesture from './BaseGesture.js';

export default class RightPokeGesture extends BaseGesture {
    constructor(config = {}) {
        super(config);
        // 수정: gesture-tuner.html에서는 '오른볼 콕'을 '화면상 오른쪽(물리적 왼쪽 187번) 볼 찌르기'로 정의하고 있습니다.
        // 따라서 187번대(왼쪽 볼) 좌표를 사용하여 '오른볼 콕'을 판정합니다.
        // 임계값도 0.2 -> 0.3으로 완화하여 인식률을 높입니다.
        this.thresholds = {
            pokeDistance: 0.3,
            ...config
        };

        this.cheekPoints = [187, 147, 116, 123, 50];
    }

    check(multiHandLandmarks, metadata, faceLandmarks) {
        if (!faceLandmarks || faceLandmarks.length === 0) {
            return { detected: false, score: 0, reason: 'Face not detected' };
        }
        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            return { detected: false, score: 0, reason: 'Hands not detected' };
        }

        // 오른손 찾기
        const sortedHands = [...multiHandLandmarks].sort((a, b) => a[0].x - b[0].x);
        let handR;
        if (sortedHands.length === 1) {
            handR = sortedHands[0];
        } else {
            handR = sortedHands[1];
        }

        const indexTip = handR[8];

        // 얼굴 크기
        let faceSize = metadata.faceSize || 0.1;
        if (!metadata.faceSize && faceLandmarks) {
            faceSize = this.distance(faceLandmarks[10], faceLandmarks[152]);
        }

        // 1. 검지 펴짐 체크 (유연하게 처리)
        // Case A: 완전히 펴짐 (threshold 1.2)
        // Case B: 살짝 구부러짐 (threshold 0.8) - "귀여운 콕" 지원
        const isIndexFullyExtended = this.isFingerExtended(handR, 8, 6, 1.2);
        const isIndexSemiExtended = this.isFingerExtended(handR, 8, 6, 0.8);

        // 검지가 너무 많이 접혀있으면(주먹 등) 즉시 실패
        if (!isIndexSemiExtended) {
            return { detected: false, score: 0, reason: 'Index finger folded' };
        }

        // 2. 나머지 손가락 접힘 체크 (필수 - '가위'나 '보' 방지) ✅
        // 중지(12), 약지(16), 소지(20)가 접혀 있어야 함
        // 엄지(4)는 펴져 있어도 됨 (볼콕 할 때 엄지가 펴질 수도 있음)
        const isMiddleClosed = this.isFingerClosed(handR, 12, 10);
        const isRingClosed = this.isFingerClosed(handR, 16, 14);
        const isPinkyClosed = this.isFingerClosed(handR, 20, 18);

        if (!isMiddleClosed || !isRingClosed || !isPinkyClosed) {
            return { detected: false, score: 0, reason: 'Other fingers not closed' };
        }

        // 3. 엄지 위치 체크 (손바닥 펴고 찌르기 방지)
        // 사용자가 요청한 대로 '엄지 끝(4)과 중지 PIP(10)가 가까워야 함'을 체크
        const thumbTip = handR[4];
        const middlePip = handR[10]; // 중지 두 번째 마디
        const d4to10 = this.distance(thumbTip, middlePip);
        const palmSize = metadata.palmSize || 0.1; // 0 방지
        const normDist4to10 = d4to10 / palmSize;

        // 임계값: 0.3 정도면 검지를 쥘 때 엄지가 중지 위에 올라가는 형태
        if (normDist4to10 > 0.35) {
            return { detected: false, score: 0, reason: `Thumb too far from middle finger (${normDist4to10.toFixed(2)})` };
        }

        // 3. 볼과의 거리 체크
        let minDist = Infinity;

        this.cheekPoints.forEach(idx => {
            const cheekPoint = faceLandmarks[idx];
            const d = Math.sqrt(
                Math.pow(indexTip.x - cheekPoint.x, 2) +
                Math.pow(indexTip.y - cheekPoint.y, 2)
            );
            const normDist = d / faceSize;

            if (normDist < minDist) {
                minDist = normDist;
            }
        });

        // 4. 판정
        // 4. 판정
        // (1) 검지가 완전히 펴져 있으면 거리 0.3 이내면 OK
        // (2) 검지가 살짝 구부러져 있으면("귀여운 콕") 더 가까워야 OK (0.2 이내)
        const isTouching = minDist < this.thresholds.pokeDistance; // 0.3
        const isCloseContact = minDist < 0.2;

        let detected = false;
        if (isIndexFullyExtended && isTouching) {
            detected = true;
        } else if (isIndexSemiExtended && isCloseContact) {
            // 구부린 콕은 좀 더 가까이 대야 인정
            detected = true;
        }

        if (detected) {
            const score = Math.max(0.1, 1 - (minDist / this.thresholds.pokeDistance));
            return {
                detected: true,
                score: score,
                label: '오른볼콕! 👉',
                emoji: '👉',
                details: { minDist: minDist.toFixed(4) }
            };
        }

        return {
            detected: false,
            score: 0,
            reason: `Too far (Dist: ${minDist.toFixed(2)})`,
            details: { minDist: minDist.toFixed(4) }
        };
    }
}
