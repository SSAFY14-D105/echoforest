/**
 * V-Sign (승리의 브이) 제스처 감지
 * 프론트엔드 이식용 (Portable)
 */
import BaseGesture, { GestureMetadata, GestureResult } from './BaseGesture';
import { Landmark } from '../../utils/gesture-helpers';

export default class VSignGesture extends BaseGesture {
    thresholds: any;

    constructor(config: any = {}) {
        super(config);
        // 기본 임계값 (생성자에서 덮어쓰기 가능)
        this.thresholds = {
            fingerFold: 1.1,     // 손가락 접힘 판단
            vAngleMin: 15,       // V 최소 각도
            vAngleMax: 70,       // V 최대 각도
            ...config
        };
    }

    /**
     * 벡터 각도 계산 (Degree)
     */
    calculateAngle(p1: Landmark, p2: Landmark, p3: Landmark): number {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        const angle = Math.acos(dot / (mag1 * mag2));
        return angle * (180 / Math.PI);
    }

<<<<<<< HEAD
    check(landmarks: Landmark[], metadata: GestureMetadata): GestureResult {
        const { palmSize } = metadata;
=======
    check(landmarks: Landmark[], _metadata: GestureMetadata): GestureResult {
>>>>>>> de01de68483739874f9083b4953344580dda6da3
        const t = this.thresholds;

        // 1. 손가락 상태 확인 함수
        const wrist = landmarks[0];
        const isExtended = (tipIdx: number, pipIdx: number) => {
            return this.distance(landmarks[tipIdx], wrist) > this.distance(landmarks[pipIdx], wrist);
        };
        const isFolded = (tipIdx: number, mcpIdx: number) => {
            return this.distance(landmarks[tipIdx], wrist) < this.distance(landmarks[mcpIdx], wrist) * t.fingerFold;
        };

        // 2. 핵심 조건: 검지(8)와 중지(12)는 펴져야 함
        // 7: INDEX_DIP, 11: MIDDLE_DIP
        const indexExtended = isExtended(8, 7);
        const middleExtended = isExtended(12, 11);

        if (!indexExtended || !middleExtended) {
            return { detected: false, score: 0 };
        }

        // 3. 약지(16)와 새끼(20)는 접혀야 함
        // 13: RING_MCP, 17: PINKY_MCP
        const ringFolded = isFolded(16, 13);
        const pinkyFolded = isFolded(20, 17);

        if (!ringFolded || !pinkyFolded) {
            // 약지/새끼가 펴져있으면 "숫자 3"이나 "4"일 수 있음
            return { detected: false, score: 0.2 };
        }

        // 4. V 각도 확인 (검지-MCP-중지 각도)
        const angle = this.calculateAngle(landmarks[8], landmarks[0], landmarks[12]);

        // 너무 좁으면 (11자, U) 혹은 너무 넓으면 (이상함) 탈락
        if (angle < t.vAngleMin) {
            return { detected: false, score: 0.4 };
        }

        // 최종 점수 계산 (각도가 적당할수록 고득점 - 30도 근처가 예쁨)
        let score = 0.8;
        if (angle > 20 && angle < 50) score = 0.95;

        return {
            detected: true,
            score: score,
            label: 'V'
        };
    }
}
