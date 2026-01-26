import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

/**
 * 게임 창 활성화/비활성화 감지 및 소켓 전송 Hook
 * 창이 최소화되거나 탭이 가려지면 PAUSE_GAME 전송
 * 다시 활성화되면 RESUME_GAME 전송
 */
export function useGameVisibility() {
    const { roomId, nickname, isSoloMode, isGameStarted } = useGameStore();
    const [isBackground, setIsBackground] = useState(false);

    useEffect(() => {
        // 솔로 모드거나 게임 시작 전이면 작동 안 함
        if (isSoloMode || !isGameStarted || !roomId) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 화면 숨겨짐 (최소화/탭 이동)
                console.log('🙈 게임 화면 숨겨짐 -> 일시정지 요청');
                setIsBackground(true);
                // Note: PAUSE_GAME 전송은 GamePage.tsx에서 isBackground 상태 변화 감지하여 처리
            } else {
                // 화면 복귀
                console.log('👀 게임 화면 복귀 -> 재개 요청');
                setIsBackground(false);
                // Note: RESUME_GAME 전송은 GamePage.tsx에서 처리
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [roomId, nickname, isSoloMode, isGameStarted]);

    return isBackground;
}
