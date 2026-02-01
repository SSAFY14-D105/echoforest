/**
 * 제스처 인식에 필요한 도움 함수 모음
 */

export interface Landmark {
    x: number;
    y: number;
    z?: number;
    visibility?: number;
}

// 두 점 사이의 거리 계산 (3D or 2D)
export function distance(p1: Landmark, p2: Landmark): number {
    if (!p1 || !p2) return 0;
    // 3D 좌표 (x, y, z)가 있으면 3D 거리, 없으면 2D 거리
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z !== undefined && p2.z !== undefined) ? p1.z - p2.z : 0;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 종횡비(Aspect Ratio)를 고려한 거리 계산 (2D Only)
// aspectRatio = width / height (예: 16/9 = 1.777)
// Z축(깊이)은 카메라 거리에 따른 스케일 오차가 커서 정규화 수치가 흔들리는 원인이 되므로 제외합니다.
export function distanceAR(p1: Landmark, p2: Landmark, aspectRatio: number = 1.0): number {
    if (!p1 || !p2) return 0;
    const dx = (p1.x - p2.x) * aspectRatio;
    const dy = (p1.y - p2.y);
    return Math.sqrt(dx * dx + dy * dy);
}

// 손가락이 펴져 있는지 확인
// tipIdx: 손가락 끝 인덱스 (4, 8, 12, 16, 20)
// pipIdx: 손가락 중간 관절 인덱스 (3, 6, 10, 14, 18) - 엄지는 3(IP)
export function isFingerExtended(landmarks: Landmark[], tipIdx: number, pipIdx: number): boolean {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const wrist = landmarks[0];

    // 손가락 끝이 손목보다 멀리 있으면 펴진 것으로 간주
    // (단순화된 로직, 필요시 각도 계산 등으로 고도화 가능)
    return distance(tip, wrist) > distance(pip, wrist);
}

// 캡처 및 분석용 손가락 거리 데이터 통합 계산
export function calculateDistances(landmarks: Landmark[], palmSize: number) {
    const thumb = landmarks[4];
    const targets = [5, 8, 12, 15, 16, 19, 20];
    const thumbDistances: Record<number, number> = {};

    targets.forEach(t => {
        thumbDistances[t] = distance(thumb, landmarks[t]) / palmSize;
    });

    // 5x5 매트릭스용 데이터 (손가락 끝 간의 모든 거리)
    const tips = [4, 8, 12, 16, 20];
    const matrix: Record<string, number> = {};
    tips.forEach(a => {
        tips.forEach(b => {
            if (a !== b) matrix[`${a}_${b}`] = distance(landmarks[a], landmarks[b]) / palmSize;
        });
    });

    // 손가락 상태 (펴짐/접힘)
    // 엄지(4-3), 검지(8-7), 중지(12-11), 약지(16-15), 새끼(20-19)
    const fingers = {
        thumb: { extended: isFingerExtended(landmarks, 4, 3) },
        index: { extended: isFingerExtended(landmarks, 8, 7) },
        middle: { extended: isFingerExtended(landmarks, 12, 11) },
        ring: { extended: isFingerExtended(landmarks, 16, 15) },
        pinky: { extended: isFingerExtended(landmarks, 20, 19) }
    };

    return { thumbDistances, matrix, fingers };
}

// 세 점(A, B, C) 사이의 각도 계산 (B가 중심)
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
    if (!a || !b || !c) return 0;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360.0 - angle;
    }
    return angle;
}
