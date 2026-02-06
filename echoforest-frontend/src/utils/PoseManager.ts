import BaseGesture, { GestureResult } from '../components/motion/BaseGesture';
import BigHeartGesture from '../components/motion/BigHeartGesture';
import BothCheekPokeGesture from '../components/motion/BothCheekPokeGesture';
import CatEarsGesture from '../components/motion/CatEarsGesture';
import FlowerPoseGesture from '../components/motion/FlowerPoseGesture';
import FistGesture from '../components/motion/FistGesture';
import HeartGesture from '../components/motion/HeartGesture';
import KissGesture from '../components/motion/KissGesture';
import CheekHeartGesture from '../components/motion/CheekHeartGesture';
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
            new FlowerPoseGesture(), // CheekHeart -> FlowerPose 교체
            new FistGesture(),
            new HeartGesture(),
            new KissGesture(),
            new CheekHeartGesture(),
            new LGesture(),
            new LeftPokeGesture(),
            new OKGesture(),
            new RightPokeGesture(),
            new TalmoBeamGesture(),
            new VSignGesture()
        ];
        console.log("PoseManager initialized with:", this.gestures.map(g => g.label || g.constructor.name));
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
                    // 임계값 체크 (0.5 이상이면 인식)
                    if (result.score >= 0.8) {
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
    /**
     * 모든 제스처의 판별 결과(점수 포함)를 반환 (디버깅용)
     */
    detectWithDetails(landmarks: Landmark[], metadata: any): GestureResult[] {
        const results: GestureResult[] = [];
        for (const gesture of this.gestures) {
            try {
                const res = gesture.check(landmarks, metadata);
                // [FIX] 실패한 결과에도 라벨/이모지 주입 (디버깅용)
                if (!res.label) res.label = gesture.label;
                if (!(res as any).emoji) (res as any).emoji = gesture.emoji;
                results.push(res);
            } catch (e) {
                console.warn(`Gesture check failed for ${gesture.constructor.name}`, e);
            }
        }
        // 점수 높은 순 정렬
        return results.sort((a, b) => b.score - a.score);
    }
}
