/**
 * useGamePause - 게임 일시정지/재개 훅
 * 
 * GamePage.tsx에서 추출된 일시정지 관련 로직
 * - Ping 전송 (Network Idle Kick 방지)
 * - 창 최소화 감지 및 일시정지/재개 요청
 */

import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameVisibility } from './useGameVisibility';
import { gameWebSocket } from '../socket/GameWebSocket';

export function useGamePause() {
    const { roomId, isSoloMode } = useGameStore();

    // 창 최소화 감지
    const isBackground = useGameVisibility();

    // 5초 Network Idle Kick 방지를 위한 3초 주기 Ping
    useEffect(() => {
        if (!roomId || isSoloMode) return;

        const pingInterval = setInterval(() => {
            if (gameWebSocket.isConnected()) {
                gameWebSocket.ping();
            }
        }, 3000);

        return () => clearInterval(pingInterval);
    }, [roomId, isSoloMode]);

    // 창 최소화 시 일시정지/재개 요청
    useEffect(() => {
        if (!roomId || isSoloMode) return;

        if (isBackground) {
            gameWebSocket.sendPauseRequest(roomId);
        } else {
            gameWebSocket.sendResumeRequest(roomId);
        }
    }, [isBackground, roomId, isSoloMode]);

    return { isBackground };
}

export default useGamePause;
