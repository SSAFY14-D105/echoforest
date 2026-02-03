/**
 * GamePage - 게임 메인 페이지 (Container)
 * 
 * 리팩토링 완료:
 * - 커스텀 훅: useGameWebSocket, useSttProcessor, useGamePause
 * - View 컴포넌트: SoloPlayView, StagePlayView, WaitingRoom
 * 
 * [PERFORMANCE] 최적화:
 * - useGameStore 전체 구독 -> useShallow 부분 구독으로 변경
 * - players 배열(고빈도 업데이트) 구독 제거하여 프레임 드랍 방지
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useToastStore } from '../../../store/useToastStore';
import type { Player } from '../../../store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import { liveKitService } from '../../../socket/LiveKitService';
import StageSelectScreen from '../../../components/StageSelectScreen/StageSelectScreen';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import styles from './GamePage.module.css';
import { useShallow } from 'zustand/react/shallow';

// 커스텀 훅
import { useGameWebSocket } from '../../../hooks/useGameWebSocket';
import { useSttProcessor } from '../../../hooks/useSttProcessor';
import { useGamePause } from '../../../hooks/useGamePause';

// View 컴포넌트
import SoloPlayView from './SoloPlayView';
import StagePlayView from './StagePlayView';
import WaitingRoom from './WaitingRoom';

const MAX_PLAYERS = 4;

export default function GamePage() {
  // === Store Selector Optimization ===
  // [PERFORMANCE] players 배열은 20-60FPS로 업데이트되므로 GamePage 레벨에서 구독하면 안 됨.
  // WaitingRoom 등 필요한 곳에서만 구독하거나 Selectors를 사용해야 함.
  const {
    nickname,
    roomId,
    isHost,
    isGameStarted,
    isSoloMode,
    currentStage,
    clearedStages,
    pausedBy,
    addPlayer,
    startGame,
    selectStage,
    clearStage,
    leaveGame,
  } = useGameStore(
    useShallow((state) => ({
      nickname: state.nickname,
      roomId: state.roomId,
      isHost: state.isHost,
      isGameStarted: state.isGameStarted,
      isSoloMode: state.isSoloMode,
      currentStage: state.currentStage,
      clearedStages: state.clearedStages,
      pausedBy: state.pausedBy,
      addPlayer: state.addPlayer,
      startGame: state.startGame,
      selectStage: state.selectStage,
      clearStage: state.clearStage,
      leaveGame: state.leaveGame,
    }))
  );

  // === Custom Hooks ===
  useGameWebSocket();
  useGamePause();

  const {
    isListening,
    curseState,
  } = useSttProcessor();

  // === Local State ===
  const [myReady, setMyReady] = useState(false);

  // === 유틸리티 함수 ===
  const getMultiStageId = (num: number): string => `MULTI_${num}`;

  // === 초기화 ===
  useEffect(() => {
    if (isSoloMode) return;
    const currentPlayers = useGameStore.getState().players;
    const alreadyExists = currentPlayers.some(p => p.nickname === nickname);
    if (alreadyExists) return;

    const myPlayer: Player = {
      id: nickname,
      nickname: nickname,
      isHost: isHost,
      isLocal: true
    };
    addPlayer(myPlayer);
  }, [isSoloMode, nickname, isHost, addPlayer]);

  // [FIX] 게임 페이지 언마운트 시 LiveKit 연결 해제
  useEffect(() => {
    return () => {
      liveKitService.disconnect();
    };
  }, []);

  // Player state 전송 (Phaser -> React -> Socket)
  const handleSendState = useCallback((x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden: boolean = false) => {
    if (isHost && roomId) {
      gameWebSocket.sendPlayerState(roomId, x, y, vx, vy, anim, isDead, curses, isHidden);
    } else if (roomId) {
      gameWebSocket.sendPlayerState(roomId, x, y, vx, vy, anim, isDead, curses, isHidden);
    }
  }, [isHost, roomId]);

  const handleToggleReady = () => {
    if (!roomId || isSoloMode) return;
    const newReady = !myReady;
    setMyReady(newReady);
    gameWebSocket.sendReady(roomId, newReady);
  };

  const handleStartGame = () => {
    if (!isHost) return;
    // [PERFORMANCE] 렌더링 없이 최신 상태 조회
    const { isAllReady, players } = useGameStore.getState();

    if (isSoloMode) {
      startGame();
    } else {
      if (!isAllReady() && players.length > 1) {
        alert('모든 플레이어가 Ready 상태여야 시작할 수 있습니다.');
        return;
      }
      gameWebSocket.sendStartGame(roomId);
    }
  };

  const handleSelectStage = (stageNum: number) => {
    const isUnlocked = stageNum === 1 || clearedStages.includes(`MULTI_${stageNum - 1}`);
    if (isUnlocked) {
      selectStage(getMultiStageId(stageNum));
      if (isHost && roomId && 'selectStage' in gameWebSocket) {
        (gameWebSocket as any).selectStage(roomId, stageNum);
      }
    }
  };

  const handleClearStage = (stageId: string) => {
    const stageNum = parseInt(stageId.replace(/^(MULTI_|SOLO_)/, ''), 10) || 1;
    clearStage(stageId);
    if (isHost && roomId && 'clearStageSync' in gameWebSocket) {
      (gameWebSocket as any).clearStageSync(roomId, stageNum);
    }
  };

  const { showToast } = useToastStore();

  const handleCopyRoomId = useCallback(async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      showToast(`방 코드(${roomId})가 복사되었습니다!`, 'success');
    } catch (err) {
      console.error('복사 실패:', err);
      showToast('복사 실패', 'error');
    }
  }, [roomId, showToast]);

  const addTestPlayer = () => {
    const currentPlayers = useGameStore.getState().players;
    if (currentPlayers.length < MAX_PLAYERS) {
      addPlayer({
        id: `test-player-${Date.now()}`,
        nickname: `Player${currentPlayers.length + 1}`,
        isHost: false
      });
    }
  };

  // ========== 렌더링 ==========

  // 솔로 모드 플레이
  if (isSoloMode && isGameStarted && currentStage !== null) {
    return (
      <SoloPlayView
        nickname={nickname}
        currentStage={currentStage}
        curseState={curseState}
        isListening={isListening}
        onLeave={leaveGame}
      />
    );
  }

  // 멀티플레이 스테이지 플레이
  if (isGameStarted && currentStage !== null) {
    return (
      <StagePlayView
        roomId={roomId}
        currentStage={currentStage}
        pausedBy={pausedBy}
        isSoloMode={isSoloMode}
        curseState={curseState}
        isListening={isListening}
        onSendState={handleSendState}
        onCopyRoomId={handleCopyRoomId}
        onClearStage={handleClearStage}
      />
    );
  }

  // 스테이지 선택
  if (isGameStarted && currentStage === null) {
    return (
      <div className={styles.gameContainer}>
        <PauseOverlay pausedBy={pausedBy} />
        <CameraArea />
        <StageSelectScreen
          roomId={roomId}
          clearedStages={clearedStages}
          isHost={isHost}
          onSelectStage={handleSelectStage}
          onClearStage={handleClearStage}
        />
      </div>
    );
  }

  // 대기실
  return (
    <WaitingRoom
      roomId={roomId}
      isHost={isHost}
      isSoloMode={isSoloMode}
      pausedBy={pausedBy}
      myReady={myReady}
      onSendState={handleSendState}
      onCopyRoomId={handleCopyRoomId}
      onLeave={leaveGame}
      onToggleReady={handleToggleReady}
      onStartGame={handleStartGame}
      onAddTestPlayer={addTestPlayer}
    />
  );
}