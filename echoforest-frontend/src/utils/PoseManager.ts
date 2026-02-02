/**
 * PoseManager - 엔딩 미션용 포즈 관리 유틸리티
 * 참가자별 랜덤 포즈 할당 및 포즈 정보 관리
 */

export interface PoseInfo {
    id: string;
    name: string;
    emoji: string;
    difficulty: number;
    gestureClass: string; // useMotionDetector에서 사용하는 제스처 클래스명
}

// 사용 가능한 포즈 목록 (기존 제스처 클래스들 기반)
export const AVAILABLE_POSES: PoseInfo[] = [
    { id: 'vsign', name: 'V 사인', emoji: '✌️', difficulty: 1, gestureClass: 'VSignGesture' },
    { id: 'fist', name: '주먹', emoji: '✊', difficulty: 1, gestureClass: 'FistGesture' },
    { id: 'ok', name: 'OK', emoji: '👌', difficulty: 1, gestureClass: 'OKGesture' },
    { id: 'kiss', name: '츄~💋', emoji: '💋', difficulty: 2, gestureClass: 'KissGesture' },
    { id: 'cheekpoke', name: '양볼 콕!', emoji: '👉👈', difficulty: 2, gestureClass: 'BothCheekPokeGesture' },
    { id: 'leftpoke', name: '왼볼 콕!', emoji: '�', difficulty: 1, gestureClass: 'LeftPokeGesture' },
    { id: 'rightpoke', name: '오른볼 콕!', emoji: '�', difficulty: 1, gestureClass: 'RightPokeGesture' },
    { id: 'l', name: 'L 사인', emoji: '🔫', difficulty: 1, gestureClass: 'LGesture' },
    { id: 'heart', name: '하트', emoji: '❤️', difficulty: 2, gestureClass: 'HeartGesture' },
    { id: 'cheekheart', name: '볼하트', emoji: '🫶', difficulty: 2, gestureClass: 'CheekHeartGesture' },
    { id: 'bigheart', name: '큰 하트', emoji: '💕', difficulty: 2, gestureClass: 'BigHeartGesture' },
    { id: 'catears', name: '고양이 귀', emoji: '😺', difficulty: 2, gestureClass: 'CatEarsGesture' },
    { id: 'flower', name: '꽃받침', emoji: '🌸', difficulty: 1, gestureClass: 'FlowerPoseGesture' },
    { id: 'talmo', name: '탈모빔', emoji: '☀️', difficulty: 2, gestureClass: 'TalmoBeamGesture' },
];

// 엔딩 미션에서 사용할 기본 포즈들 (난이도 1~2)
export const ENDING_MISSION_POSES = AVAILABLE_POSES.filter(p => p.difficulty <= 2);

/**
 * 간단한 해시 함수 (시드 생성용)
 */
function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * 시드 기반 셔플 (Fisher-Yates)
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
    const result = [...array];
    let currentIndex = result.length;

    // 간단한 시드 기반 랜덤
    const seededRandom = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };

    while (currentIndex !== 0) {
        const randomIndex = Math.floor(seededRandom() * currentIndex);
        currentIndex--;
        [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
    }

    return result;
}

/**
 * roomId 기반으로 참가자들에게 각각 다른 포즈 할당
 * @param participantIds 참가자 identity 배열 (최대 4명)
 * @param roomId 방 ID (시드 생성용)
 * @returns identity → PoseInfo 맵
 */
export function assignPosesToParticipants(
    participantIds: string[],
    roomId: string
): Map<string, PoseInfo> {
    const seed = simpleHash(roomId);
    const shuffledPoses = seededShuffle(ENDING_MISSION_POSES, seed);

    const assignments = new Map<string, PoseInfo>();

    // [FIX] 참가자 ID를 정렬하여 모든 클라이언트에서 동일한 순서 보장
    const sortedIds = [...participantIds].sort();

    sortedIds.slice(0, 4).forEach((id, index) => {
        // 포즈 배열을 순환하여 할당 (참가자 > 포즈 수일 경우 대비)
        const pose = shuffledPoses[index % shuffledPoses.length];
        assignments.set(id, pose);
    });

    return assignments;
}

/**
 * 포즈 ID로 PoseInfo 조회
 */
export function getPoseById(poseId: string): PoseInfo | undefined {
    return AVAILABLE_POSES.find(p => p.id === poseId);
}

/**
 * 제스처 클래스명으로 PoseInfo 조회
 */
export function getPoseByGestureClass(gestureClass: string): PoseInfo | undefined {
    return AVAILABLE_POSES.find(p => p.gestureClass === gestureClass);
}
