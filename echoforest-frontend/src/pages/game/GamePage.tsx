import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { Player } from '../../store/useGameStore';
import PhaserGame from '../../components/game/PhaserGame';
import styles from './GamePage.module.css';

// 플레이어별 색상 테마
const PLAYER_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];
const MAX_PLAYERS = 4;
const TOTAL_STAGES = 3;

export default function GamePage() {
  const {
    nickname,
    roomId,
    isHost,
    players,
    isGameStarted,
    isSoloMode,
    currentStage,
    clearedStages,
    addPlayer,
    startGame,
    selectStage,
    clearStage,
    leaveGame
  } = useGameStore();

  const [micVolume, setMicVolume] = useState(70);
  const [cameraOn, setCameraOn] = useState(true);
  const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]);
  const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

  // 본인을 플레이어 목록에 추가 (방 입장 시)
  // 솔로 모드는 startSoloGame에서 이미 추가되므로 건너뜀
  useEffect(() => {
    if (isSoloMode) return; // 솔로 모드면 건너뛰기

    // 이미 플레이어가 있으면 중복 추가 방지
    const alreadyExists = players.some(p => p.nickname === nickname);
    if (alreadyExists) return;

    const myPlayer: Player = {
      id: `player-${Date.now()}`,
      nickname: nickname,
      isHost: isHost
    };
    addPlayer(myPlayer);
  }, [isSoloMode]);

  // 플레이어 수 확인
  const isGameReady = players.length >= MAX_PLAYERS;

  const handlePlayerVolumeChange = (playerIndex: number, volume: number) => {
    const newVolumes = [...playerVolumes];
    newVolumes[playerIndex] = volume;
    setPlayerVolumes(newVolumes);
  };

  const handleStartGame = () => {
    if (isHost && isGameReady) {
      startGame();
    }
  };

  // 스테이지 잠금 해제 여부 확인
  const isStageUnlocked = (stageNum: number): boolean => {
    if (stageNum === 1) return true; // Stage 1은 항상 열림
    return clearedStages.includes(stageNum - 1); // 이전 스테이지 클리어 시 열림
  };

  // 스테이지 선택 핸들러
  const handleSelectStage = (stageNum: number) => {
    if (isStageUnlocked(stageNum)) {
      selectStage(stageNum);
    }
  };

  // TODO: 백엔드 WebSocket 연동 후 삭제 - 테스트용 가상 플레이어 추가 함수 시작
  const addTestPlayer = () => {
    if (players.length < MAX_PLAYERS) {
      const testPlayer: Player = {
        id: `test-player-${Date.now()}`,
        nickname: `Player${players.length + 1}`,
        isHost: false
      };
      addPlayer(testPlayer);
    }
  };
  // TODO: 백엔드 WebSocket 연동 후 삭제 - 테스트용 가상 플레이어 추가 함수 끝

  // ========== 카메라 영역 컴포넌트 (항상 하단에 표시) ==========
  const CameraArea = () => (
    <div className={styles.cameraArea}>
      {Array.from({ length: MAX_PLAYERS }).map((_, index) => {
        const player = players[index];
        const isMe = player?.nickname === nickname;
        const isEmpty = !player;

        if (isEmpty) {
          return (
            <div
              key={index}
              className={`pixel-box ${styles.cameraBox} ${styles.waiting}`}
              style={{ borderColor: PLAYER_COLORS[index] }}
            >
              P{index + 1} (대기중...)
            </div>
          );
        }

        return (
          <div
            key={index}
            className={`pixel-box ${styles.cameraBox} ${styles.active}`}
            style={{ borderColor: PLAYER_COLORS[index] }}
          >
            <div className={isMe && cameraOn ? styles.cameraContent : styles.cameraOff}>
              {isMe && cameraOn ? `P${index + 1} (나: ${player.nickname})` :
                isMe ? '📹' : `P${index + 1}: ${player.nickname}`}
            </div>

            {/* 본인 컨트롤 버튼 */}
            {isMe && (
              <div className={styles.controls}>
                <div className={styles.controlBtn}>
                  <button
                    className={styles.btn}
                    onClick={() => setShowVolumeSlider(showVolumeSlider === index ? null : index)}
                  >
                    <div className={styles.micIcon}></div>
                  </button>
                  {showVolumeSlider === index && (
                    <div className={styles.volumeSliderContainer} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="range" min="0" max="100" value={micVolume}
                        onChange={(e) => setMicVolume(Number(e.target.value))}
                        className={styles.verticalSlider}
                      />
                      <span className={styles.volumeText}>{micVolume}%</span>
                    </div>
                  )}
                </div>
                <button className={styles.btn} onClick={() => setCameraOn(!cameraOn)}>
                  <div className={cameraOn ? styles.cameraIcon : styles.cameraOffIcon}></div>
                </button>
              </div>
            )}

            {/* 타인 스피커 버튼 */}
            {!isMe && (
              <div className={styles.controls}>
                <div className={styles.controlBtn}>
                  <button
                    className={styles.btn}
                    onClick={() => setShowVolumeSlider(showVolumeSlider === index ? null : index)}
                  >
                    <div className={styles.speakerIcon}></div>
                  </button>
                  {showVolumeSlider === index && (
                    <div className={styles.volumeSliderContainer} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="range" min="0" max="100" value={playerVolumes[index - 1] ?? 70}
                        onChange={(e) => handlePlayerVolumeChange(index - 1, Number(e.target.value))}
                        className={styles.verticalSlider}
                      />
                      <span className={styles.volumeText}>{playerVolumes[index - 1] ?? 70}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ========== 혼자하기 모드 화면 (카메라 없음, 로비 복귀 버튼) ==========
  if (isSoloMode && isGameStarted && currentStage !== null) {
    return (
      <div className={styles.gameContainer}>
        {/* 게임 캔버스 (전체 화면) */}
        <div className={`pixel-box ${styles.canvasWrapper}`} style={{ marginBottom: 0, flex: 1 }}>
          <PhaserGame />
          <div className={styles.gameInfo}>
            🧪 혼자하기 모드 | {nickname}
          </div>
          {/* 로비로 돌아가기 버튼 */}
          <button
            className={styles.backToLobbyBtn}
            onClick={leaveGame}
          >
            ← 로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ========== 스테이지 플레이 화면 (멀티플레이) ==========
  if (isGameStarted && currentStage !== null) {
    return (
      <div className={styles.gameContainer}>
        {/* 게임 캔버스 */}
        <div className={`pixel-box ${styles.canvasWrapper}`}>
          <PhaserGame />
          <div className={styles.gameInfo}>
            🎮 Stage {currentStage} 진행 중 | Room: <span className={styles.roomId}>{roomId}</span>
          </div>
          {/* TODO: 스테이지 클리어 테스트 버튼 - 나중에 삭제 */}
          <button
            className={styles.testClearBtn}
            onClick={() => clearStage(currentStage)}
          >
            🏆 테스트: 스테이지 클리어
          </button>
        </div>

        {/* 카메라 영역 (항상 표시) */}
        <CameraArea />
      </div>
    );
  }

  // ========== 스테이지 선택 화면 ==========
  if (isGameStarted && currentStage === null) {
    return (
      <div className={styles.gameContainer}>
        {/* 스테이지 선택 영역 */}
        <div className={styles.stageSelectArea}>
          <div className={styles.stageSelectHeader}>
            <h2>🗺️ 스테이지 선택</h2>
            <p>Room: <span className={styles.roomId}>{roomId}</span></p>
          </div>

          <div className={styles.stageGrid}>
            {Array.from({ length: TOTAL_STAGES }).map((_, index) => {
              const stageNum = index + 1;
              const isUnlocked = isStageUnlocked(stageNum);
              const isCleared = clearedStages.includes(stageNum);

              return (
                <button
                  key={stageNum}
                  className={`${styles.stageCard} ${isUnlocked ? styles.unlocked : styles.locked} ${isCleared ? styles.cleared : ''}`}
                  onClick={() => handleSelectStage(stageNum)}
                  disabled={!isUnlocked}
                >
                  <div className={styles.stageIcon}>
                    {isUnlocked ? (isCleared ? '⭐' : `${stageNum}`) : '🔒'}
                  </div>
                  <div className={styles.stageLabel}>Stage {stageNum}</div>
                  <div className={styles.stageStatus}>
                    {isCleared ? '클리어!' : isUnlocked ? '도전 가능' : '잠김'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* TODO: 테스트용 스테이지 해금 버튼 - 나중에 삭제 */}
          <div className={styles.testButtons}>
            <button
              className={styles.testBtn}
              onClick={() => clearStage(1)}
              disabled={clearedStages.includes(1)}
            >
              🧪 Stage 1 클리어 처리
            </button>
            <button
              className={styles.testBtn}
              onClick={() => clearStage(2)}
              disabled={!clearedStages.includes(1) || clearedStages.includes(2)}
            >
              🧪 Stage 2 클리어 처리
            </button>
          </div>
        </div>

        {/* 카메라 영역 (항상 표시) */}
        <CameraArea />
      </div>
    );
  }

  // ========== 대기실 화면 ==========
  return (
    <div className={styles.gameContainer}>
      {/* 게임 캔버스 (대기 화면) */}
      <div className={`pixel-box ${styles.canvasWrapper}`}>
        <PhaserGame />
        <div className={styles.gameInfo}>
          🎮 대기실 | Room: <span className={styles.roomId}>{roomId}</span> |
          👥 {players.length}/{MAX_PLAYERS}
        </div>
      </div>

      {/* 카메라 영역 */}
      <CameraArea />

      {/* 하단 버튼 영역 */}
      <div className={styles.bottomActions}>
        {/* TODO: 백엔드 WebSocket 연동 후 삭제 - 테스트용 버튼 시작 */}
        <button
          className={styles.testBtn}
          onClick={addTestPlayer}
          disabled={players.length >= MAX_PLAYERS}
        >
          🧪 테스트: 플레이어 추가 ({players.length}/{MAX_PLAYERS})
        </button>
        {/* TODO: 백엔드 WebSocket 연동 후 삭제 - 테스트용 버튼 끝 */}

        {/* 게임 시작 버튼 - 4명이 모이고 호스트일 때만 */}
        {isGameReady && isHost && (
          <button className={styles.startGameBtn} onClick={handleStartGame}>
            🚀 게임 시작!
          </button>
        )}

        {/* 대기 메시지 */}
        {!isGameReady && (
          <span className={styles.waitingMessage}>
            {MAX_PLAYERS - players.length}명 더 필요합니다...
          </span>
        )}

        {/* 호스트 아닌 경우 대기 */}
        {isGameReady && !isHost && (
          <span className={styles.waitingMessage}>
            호스트가 게임을 시작하길 기다리는 중...
          </span>
        )}
      </div>
    </div>
  );
}