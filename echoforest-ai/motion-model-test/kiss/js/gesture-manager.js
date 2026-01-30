/**
 * GestureManager - 제스처 관리 클래스
 * 여러 제스처를 등록하고 감지를 관리
 */
import { Kiss } from './gestures/Kiss.js';

export class GestureManager {
    constructor() {
        this.gestures = new Map();
        this.activeGesture = null;
        this.callbacks = {
            onDetected: null,
            onLost: null
        };

        // 기본 제스처 등록
        this.registerGesture('kiss', new Kiss());
    }

    /**
     * 제스처 등록
     */
    registerGesture(name, gestureInstance) {
        this.gestures.set(name, gestureInstance);
    }

    /**
     * 제스처 조회
     */
    getGesture(name) {
        return this.gestures.get(name);
    }

    /**
     * 등록된 모든 제스처 조회
     */
    getAllGestures() {
        return Array.from(this.gestures.entries()).map(([name, gesture]) => ({
            name,
            ...gesture.getInfo()
        }));
    }

    /**
     * 콜백 설정
     */
    onDetected(callback) {
        this.callbacks.onDetected = callback;
    }

    onLost(callback) {
        this.callbacks.onLost = callback;
    }

    /**
     * 모든 등록된 제스처에 대해 감지 수행
     * @param {Object} data - 랜드마크 데이터
     * @param {number} minConfidence - 최소 신뢰도
     * @returns {Object|null} - 감지된 제스처 또는 null
     */
    detectAll(data, minConfidence = 0.7) {
        let bestResult = null;
        let bestGestureName = null;

        for (const [name, gesture] of this.gestures) {
            const result = gesture.detect(data);

            if (result.detected && result.score >= minConfidence) {
                if (!bestResult || result.score > bestResult.score) {
                    bestResult = result;
                    bestGestureName = name;
                }
            }
        }

        if (bestResult) {
            const gesture = this.gestures.get(bestGestureName);
            const detectedGesture = {
                name: bestGestureName,
                icon: gesture.icon,
                score: bestResult.score,
                data: bestResult.data
            };

            if (this.activeGesture !== bestGestureName) {
                this.activeGesture = bestGestureName;
                if (this.callbacks.onDetected) {
                    this.callbacks.onDetected(detectedGesture);
                }
            }

            return detectedGesture;
        } else {
            if (this.activeGesture !== null) {
                this.activeGesture = null;
                if (this.callbacks.onLost) {
                    this.callbacks.onLost();
                }
            }
            return null;
        }
    }

    /**
     * 특정 제스처만 감지
     */
    detectOne(name, data, minConfidence = 0.7) {
        const gesture = this.gestures.get(name);
        if (!gesture) return null;

        const result = gesture.detect(data);

        if (result.detected && result.score >= minConfidence) {
            return {
                name,
                icon: gesture.icon,
                score: result.score,
                data: result.data
            };
        }

        return null;
    }
}
