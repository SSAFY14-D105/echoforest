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
            distance: 0.6, // [FIX] 턱과의 거리 임계값 완화 (0.35 → 0.6)
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
            // 1. 손목(0)이나 손바닥 중심이 턱 근처에 있는지 체크
            // 꽃받침은 보통 손목이나 손바닥 아랫부분을 턱에 댐
            const wrist = hand[0] as Landmark;
            const thumbBase = hand[1] as Landmark;
            const pinkyBase = hand[17] as Landmark;

            // 손의 "받침" 부분 (손목~손바닥 하단)
            const basePoints = [wrist, thumbBase, pinkyBase];

            let minToJaw = Infinity;

            // 얼굴의 턱 포인트들과 비교
            for (const jawIdx of this.jawPoints) {
                const jawPt = faceLandmarks[jawIdx] as Landmark;
                if (!jawPt) continue;

                for (const basePt of basePoints) {
                    const d = distance(basePt, jawPt);
                    const norm = d / faceSize;
                    if (norm < minToJaw) minToJaw = norm;
                }
            }

            // 2. 거리 체크
            const extendedCount = [8, 12, 16, 20].filter(idx => isFingerExtended(hand as Landmark[], idx, idx - 2)).length;

            // [DEBUG] 정보 수집
            debugInfo.push({
                minToJaw: minToJaw.toFixed(3),
                threshold: this.thresholds.distance,
                extendedFingers: extendedCount,
                passed: minToJaw < this.thresholds.distance && extendedCount >= 2
            });

            if (minToJaw < this.thresholds.distance) {
                // 3. 모양 체크 (손이 펴져 있어야 함, 주먹이면 안됨)
                // [FIX] 2개 이상의 손가락이 펴져 있으면 인정 (3개 → 2개로 완화)
                if (extendedCount >= 2) {
                    detectedHands++;
                    // 거리가 가까울수록 점수 높음
                    const score = Math.max(0.2, 1.0 - (minToJaw / this.thresholds.distance));
                    totalScore += score;
                }
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

        // [FIX] 양손 필수로 변경 - 한손 꽃받침은 인식 안 함
        // [FIX] 양손 필수로 변경 - 한손 꽃받침은 인식 안 함
        if (detectedHands >= 2) {
            // [FIX] 손하트 오인식 방지: 양손 검지/중지 끝이 붙어 있으면(하트 모양) 꽃받침 아님
            // 하트는 손끝이 붙어있고, 꽃받침은 손목이 붙어있고 손끝은 벌어짐
            const hand1 = allHands[0];
            const hand2 = allHands[1];
            const indexTipDist = distance(hand1[8], hand2[8]) / faceSize;

            // 손끝이 너무 가까우면(0.2 미만) 하트로 간주하고 차단
            if (indexTipDist < 0.2) {
                return { detected: false, score: 0 };
            }

            // [FIX] 점수 계산 개선
            let finalScore = totalScore / detectedHands;
            // 양손이면 점수 가산
            finalScore = Math.min(0.99, finalScore + 0.3);

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
