import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { distance, isFingerExtended, Landmark } from '../../utils/gesture-helpers';

export default class FlowerPoseGesture extends BaseGesture {
    label: string;
    emoji: string;
    thresholds: any;
    chinPoint: number;
    jawPoints: number[];

    constructor(config: any = {}) {
        super(config);
        this.label = '꽃받침! 🌸';
        this.emoji = '🌸';
        this.thresholds = {
            maxWristDistance: 2.5, // [INCREASED] 양손 손목 간 최대 거리 (얼굴 가까이 대도 인식되게)
            ...config
        };

        // 턱 끝(152) 및 턱 라인
        this.chinPoint = 152;
        // [FIX] 더 많은 턱 포인트 추가 (인식률 향상)
        this.jawPoints = [152, 365, 397, 136, 172, 148, 377]; // 턱 끝 + 좌우 턱 라인
    }

    check(_multiHandLandmarks: any[], metadata: GestureMetadata): GestureResult {
        const faceLandmarks = metadata.faceLandmarks;
        const allHands = metadata.allHands;

        if (!faceLandmarks || !faceLandmarks.length || !allHands || !allHands.length) {
            return { detected: false, score: 0 };
        }

        // [FIX] faceSize 동적 계산 (얼굴의 실제 크기 측정)
        // 얼굴 높이 = 이마(10) ~ 턱(152) 거리
        let faceSize = metadata.faceSize || 0.1;
        if (faceLandmarks[10] && faceLandmarks[152]) {
            const forehead = faceLandmarks[10] as Landmark;
            const chin = faceLandmarks[152] as Landmark;
            faceSize = distance(forehead, chin);
        }

        let detectedHands = 0;
        let totalScore = 0;

        // [DEBUG] 감지 상태 추적
        const debugInfo: any[] = [];

        for (const hand of allHands) {
            // 손가락 펴짐 체크 (2개 이상의 손가락이 펴져 있어야 함)
            const extendedCount = [8, 12, 16, 20].filter(idx => isFingerExtended(hand as Landmark[], idx, idx - 2)).length;

            console.log(`[FlowerPose] Hand extended fingers: ${extendedCount}`);

            if (extendedCount >= 2) {
                detectedHands++;
                const score = 0.7; // 기본 점수
                totalScore += score;
                console.log(`[FlowerPose] ✅ Hand passed (detectedHands: ${detectedHands})`);
            } else {
                console.log(`[FlowerPose] ❌ Hand rejected: not enough fingers extended (${extendedCount} < 2)`);
            }
        }

        // [DEBUG] 디버그 정보 출력 (10초마다 한 번씩)
        if (allHands.length > 0 && Date.now() % 10000 < 100) {
            // console.log('[FlowerPoseGesture] Debug:', {
            //     faceSize: faceSize.toFixed(3),
            //     handsCount: allHands.length,
            //     debugInfo
            // });
        }

        // 양손 필수
        if (detectedHands >= 2) {
            const hand1 = allHands[0];
            const hand2 = allHands[1];

            // [NEW] 핵심 조건: 양손 손목 간 거리가 가까워야 함 (꽃받침의 본질)
            const wrist1 = hand1[0];
            const wrist2 = hand2[0];
            const wristDist = distance(wrist1, wrist2) / faceSize;

            // [DEBUG] 손목 간 거리 로그
            console.log(`[FlowerPose] Wrist distance: ${wristDist.toFixed(3)}, threshold: ${this.thresholds.maxWristDistance}`);

            // 손목이 너무 멀면 (손을 벌린 자세) 차단
            if (wristDist > this.thresholds.maxWristDistance) {
                console.log(`[FlowerPose] ❌ Rejected: wrists too far apart (${wristDist.toFixed(3)} > ${this.thresholds.maxWristDistance})`);
                return { detected: false, score: 0 };
            }

            console.log(`[FlowerPose] ✅ Wrists close enough (${wristDist.toFixed(3)} <= ${this.thresholds.maxWristDistance})`);

            // 손하트 오인식 방지: 양손 검지/중지 끝이 붙어 있으면(하트 모양) 꽃받침 아님
            const indexTipDist = distance(hand1[8], hand2[8]) / faceSize;

            // 손끝이 너무 가까우면(0.2 미만) 하트로 간주하고 차단
            if (indexTipDist < 0.2) {
                console.log(`[FlowerPose] ❌ Rejected: heart shape detected`);
                return { detected: false, score: 0 };
            }

            // 점수 계산: 손목이 가까울수록 높은 점수
            let finalScore = totalScore / detectedHands;
            const wristBonus = Math.max(0, (this.thresholds.maxWristDistance - wristDist) / this.thresholds.maxWristDistance) * 0.3;
            finalScore = Math.min(0.99, finalScore + wristBonus);

            console.log(`[FlowerPose] ✅ Detected! Score: ${finalScore.toFixed(3)}`);

            return {
                detected: true,
                score: finalScore,
                label: this.label,
                emoji: this.emoji
            };
        }

        return { detected: false, score: 0 };
    }
}
