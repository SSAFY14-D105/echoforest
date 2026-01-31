import { Landmark, distance } from '../../utils/gesture-helpers';

export interface GestureResult {
    detected: boolean;
    score: number;
    label?: string;
    emoji?: string;
    extra?: any;
    left?: { detected: boolean; score: number; label?: string; emoji?: string };
    right?: { detected: boolean; score: number; label?: string; emoji?: string };
}

export interface GestureMetadata {
    palmSize?: number;
    aspectRatio?: number;
    allHands?: Landmark[][]; // 양손 정보 (landmarks[0], landmarks[1])
    faceLandmarks?: Landmark[]; // 얼굴 정보
    faceSize?: number;
}

export default class BaseGesture {
    public config: any;
    public label: string;
    public emoji: string;

    constructor(config: any = {}) {
        this.config = config;
        this.label = 'Gesture';
        this.emoji = '🖐️';
    }

    /**
     * 제스처 감지 메서드 (오버라이딩 필요)
     */
    check(landmarks: Landmark[], metadata: GestureMetadata = {}): GestureResult {
        return { detected: false, score: 0 };
    }

    /**
     * 손가락 마디가 펴졌는지 체크 (단순 거리 비교)
     * (헬퍼 함수를 내부 메서드로 래핑)
     */
    protected _isFingerExtended(landmarks: Landmark[], tipIdx: number, pipIdx: number): boolean {
        const tip = landmarks[tipIdx];
        const pip = landmarks[pipIdx];
        const wrist = landmarks[0];

        // 손가락 끝이 손목보다 멀리 있으면 펴진 것으로 간주
        return distance(tip, wrist) > distance(pip, wrist);
    }

    /**
     * 3D 좌표 거리 계산 (헬퍼 래핑)
     */
    protected _getDistance(p1: Landmark, p2: Landmark): number {
        return distance(p1, p2);
    }
}
