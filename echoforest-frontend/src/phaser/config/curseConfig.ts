/**
 * 저주 시스템 설정
 * 새 저주 추가 시 CURSES에 객체만 추가하면 됩니다.
 */

export interface CurseEffect {
    id: string;
    name: string;
    description: string;
    sizeMultiplier: number;      // 크기 배율 (기본 1)
    speedMultiplier: number;     // 이동속도 배율 (기본 1)
    jumpMultiplier?: number;     // 점프력 배율 (기본 1, 추후 확장용)
    duration?: number;           // 지속 시간 ms (null이면 무한)
    color?: number;              // 저주 효과 색상 (시각화용)
    hasDrainEffect?: boolean;    // HP 감소 효과 여부
    reverseControls?: boolean;   // 조작 반전 여부
}

/**
 * 저주 목록
 * 새 저주를 추가하려면 여기에 객체를 추가하세요.
 */
export const CURSES: Record<string, CurseEffect> = {
    giant: {
        id: 'giant',
        name: '거대화',
        description: '크기가 2배로 커지고 이동속도와 점프력이 절반으로 감소합니다.',
        sizeMultiplier: 2,
        speedMultiplier: 0.5,
        jumpMultiplier: 0.5,
        color: 0x8B0000,  // 어두운 빨강
    },
    drain: {
        id: 'drain',
        name: 'HP 저하',
        description: 'HP가 지속적으로 감소하여 5초 후 죽습니다.',
        sizeMultiplier: 1,
        speedMultiplier: 1,
        color: 0x800080,  // 보라색
        hasDrainEffect: true,
        duration: 5000,   // 5초 후 죽음
    },
    reverse: {
        id: 'reverse',
        name: '반전',
        description: '모든 방향키가 반대로 작동합니다.',
        sizeMultiplier: 1,
        speedMultiplier: 1,
        color: 0x4169E1,  // 파랑
        reverseControls: true,
    },
};

/**
 * 저주 ID 목록 (랜덤 선택용)
 */
export const CURSE_IDS = Object.keys(CURSES);

/**
 * 랜덤 저주 ID 반환
 */
export function getRandomCurseId(): string {
    return CURSE_IDS[Math.floor(Math.random() * CURSE_IDS.length)];
}

