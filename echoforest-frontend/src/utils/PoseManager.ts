import BaseGesture, { GestureResult } from '../components/motion/BaseGesture';
import BigHeartGesture from '../components/motion/BigHeartGesture';
import BothCheekPokeGesture from '../components/motion/BothCheekPokeGesture';
import CatEarsGesture from '../components/motion/CatEarsGesture';
import CheekHeartGesture from '../components/motion/CheekHeartGesture';
import FistGesture from '../components/motion/FistGesture';
import HeartGesture from '../components/motion/HeartGesture';
import KissGesture from '../components/motion/KissGesture';
import LGesture from '../components/motion/LGesture';
import LeftPokeGesture from '../components/motion/LeftPokeGesture';
import OKGesture from '../components/motion/OKGesture';
import RightPokeGesture from '../components/motion/RightPokeGesture';
import TalmoBeamGesture from '../components/motion/TalmoBeamGesture';
import VSignGesture from '../components/motion/VSignGesture';
import { Landmark } from './gesture-helpers';

export interface PoseInfo {
    label: string;
    emoji: string;
    score: number;
    detected: boolean;
    timestamp?: number;
}

export default class PoseManager {
    private gestures: BaseGesture[];

    constructor() {
        this.gestures = [
            new BigHeartGesture(),
            new BothCheekPokeGesture(),
            new CatEarsGesture(),
            new CheekHeartGesture(),
            new FistGesture(),
            new HeartGesture(),
            new KissGesture(),
            new LGesture(),
            new LeftPokeGesture(),
            new OKGesture(),
            new RightPokeGesture(),
            new TalmoBeamGesture(),
            new VSignGesture()
        ];
    }

    public getGestures() {
        return this.gestures;
    }

    /**
     * 모든 제스처 감지 후 가장 높은 점수의 제스처 반환
     */
    detect(landmarks: Landmark[], metadata: any): PoseInfo | null {
        let bestResult: GestureResult | null = null;
        let maxScore = 0;

        for (const gesture of this.gestures) {
            try {
                const result = gesture.check(landmarks, metadata);
                if (result.detected && result.score > maxScore) {
                    // 임계값 체크 (0.6 이상 확신할 때만)
                    if (result.score >= 0.6) {
                        maxScore = result.score;
                        bestResult = result;
                    }
                }
            } catch (e) {
                console.warn(`Gesture check failed for ${gesture.constructor.name}:`, e);
            }
        }

        if (bestResult && bestResult.detected) {
            return {
                label: bestResult.label || 'Unknown',
                emoji: (bestResult as any).emoji || '',
                score: bestResult.score,
                detected: true,
                timestamp: Date.now()
            };
        }

        return null;
    }
}
