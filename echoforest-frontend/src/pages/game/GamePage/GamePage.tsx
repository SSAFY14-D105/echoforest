/**
 * GamePage - 게임 메인 페이지 (Container)
 * 
 * 리팩토링 완료:
 * - 커스텀 훅: useGameWebSocket, useSttProcessor, useGamePause
 * - View 컴포넌트: SoloPlayView, StagePlayView, WaitingRoom
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import type { Player } from '../../../store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import StageSelectScreen from '../../../components/StageSelectScreen/StageSelectScreen';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import styles from './GamePage.module.css';

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
  // === Store ===
  const {
    nickname,
    roomId,
    isHost,
    players,
    readyPlayers,
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
  } = useGameStore();

  // === Custom Hooks ===
  useGameWebSocket();
  useGamePause();

  const {
    isListening,
    boosterActive,
    curseState,
    setBoosterMode,
  } = useSttProcessor();

  // === Local State ===
  const [myReady, setMyReady] = useState(false);

  // === 유틸리티 함수 ===
  const getMultiStageId = (num: number): string => `MULTI_${num}`;

  // === 초기화 ===
  useEffect(() => {
    if (isSoloMode) return;
    const alreadyExists = players.some(p => p.nickname === nickname);
    if (alreadyExists) return;

    const myPlayer: Player = {
      id: nickname,
      nickname: nickname,
      isHost: isHost,
      isLocal: true
    };
    addPlayer(myPlayer);
  }, [isSoloMode]);

  // === 콜백 함수 ===
  const handleSendState = useCallback((x: number, y: number, vx: number, vy: number, anim: string) => {
    if (roomId && !isSoloMode) {
      let finalAnim = anim;
      if (isHost && currentStage) {
        finalAnim = `${anim}|s:${currentStage}`;
      }
      gameWebSocket.sendPlayerState(roomId, x, y, vx, vy, finalAnim);
    }
  }, [roomId, isSoloMode, isHost, currentStage]);

  const handleToggleReady = () => {
    if (!roomId || isSoloMode) return;
    const newReady = !myReady;
    setMyReady(newReady);
    gameWebSocket.sendReady(roomId, newReady);
  };

  const handleStartGame = () => {
    if (!isHost) return;
    const { isAllReady } = useGameStore.getState();

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

  const handleCopyRoomId = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      alert(`방 코드(${roomId})가 복사되었습니다!`);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  const addTestPlayer = () => {
    if (players.length < MAX_PLAYERS) {
      addPlayer({
        id: `test-player-${Date.now()}`,
        nickname: `Player${players.length + 1}`,
        isHost: false
      });
    }
  };

  // Ready 상태
  const { isAllReady } = useGameStore.getState();
  const allReady = isAllReady();

  // ========== 렌더링 ==========

  // 솔로 모드 플레이
  if (isSoloMode && isGameStarted && currentStage !== null) {
    return (
      <SoloPlayView
        nickname={nickname}
        currentStage={currentStage}
        curseState={curseState}
        isListening={isListening}
        boosterActive={boosterActive}
        setBoosterMode={setBoosterMode}
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
        boosterActive={boosterActive}
        setBoosterMode={setBoosterMode}
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
        <StageSelectScreen
          roomId={roomId}
          clearedStages={clearedStages}
          isHost={isHost}
          onSelectStage={handleSelectStage}
          onClearStage={handleClearStage}
        />
        <CameraArea />
      </div>
    );
  }

  // 대기실
  return (
    <WaitingRoom
      roomId={roomId}
      players={players}
      readyPlayers={readyPlayers}
      isHost={isHost}
      isSoloMode={isSoloMode}
      pausedBy={pausedBy}
      myReady={myReady}
      allReady={allReady}
      onSendState={handleSendState}
      onCopyRoomId={handleCopyRoomId}
      onLeave={leaveGame}
      onToggleReady={handleToggleReady}
      onStartGame={handleStartGame}
      onAddTestPlayer={addTestPlayer}
    />
  );
}