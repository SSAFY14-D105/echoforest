import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { Player } from '../../store/useGameStore';
import { GameWebSocket, type GameMessage } from '../../socket/GameWebSocket';
import { liveKitService } from '../../socket/LiveKitService';
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
    removePlayerByNickname,
    updatePlayerPosition,
    startGame,
    selectStage,
    clearStage,
    leaveGame
  } = useGameStore();

  const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]);
  const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

  // WebSocket 인스턴스
  const wsRef = useRef<GameWebSocket | null>(null);

  // LiveKit 상태
  const [isLiveKitConnecting, setIsLiveKitConnecting] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);

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

  // WebSocket 연결 및 메시지 처리
  useEffect(() => {
    if (isSoloMode) return; // 솔로 모드는 WebSocket 사용 안 함
    if (!roomId || !nickname) return;

    // WebSocket 인스턴스 생성 및 연결
    const ws = new GameWebSocket(nickname);
    wsRef.current = ws;

    ws.onMessage((msg: GameMessage) => {
      console.log('📩 WebSocket 메시지:', msg);

      switch (msg.type) {
        case 'JOIN':
          // 다른 플레이어 입장
          if (msg.username && msg.username !== nickname) {
            const newPlayer: Player = {
              id: `player-${Date.now()}-${msg.username}`,
              nickname: msg.username,
              isHost: false,
              x: msg.x,
              y: msg.y
            };
            addPlayer(newPlayer);
            console.log(`👋 ${msg.username} 입장`);
          }
          break;

        case 'MOVE':
          // 다른 플레이어 이동
          if (msg.username && msg.username !== nickname && msg.x !== undefined && msg.y !== undefined) {
            updatePlayerPosition(msg.username, msg.x, msg.y, msg.anim);
          }
          break;

        case 'LEAVE':
          // 다른 플레이어 퇴장
          if (msg.username) {
            removePlayerByNickname(msg.username);
            console.log(`👋 ${msg.username} 퇴장`);
          }
          break;

        case 'ERROR':
          console.error('❌ WebSocket 에러:', msg.content);
          break;
      }
    });

    ws.onConnect(() => {
      console.log('✅ WebSocket 연결됨 - 방 참가 메시지 전송');
    });

    ws.onError((error) => {
      console.error('❌ WebSocket 에러:', error);
    });

    ws.connect().catch(err => {
      console.error('WebSocket 연결 실패:', err);
    });

    // 컴포넌트 언마운트 시 연결 종료
    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [roomId, nickname, isSoloMode]);

  // LiveKit 연결 (방 입장 시)
  useEffect(() => {
    if (isSoloMode) return; // 솔로 모드는 LiveKit 사용 안 함
    if (!roomId || !nickname) return;
    if (isLiveKitConnecting || liveKitService.isConnected) return;

    const connectLiveKit = async () => {
      setIsLiveKitConnecting(true);
      try {
        // 로컬 비디오 엘리먼트 설정
        liveKitService.setLocalVideoElement(localVideoRef.current);

        // userId는 localStorage에서 가져오기
        const userId = localStorage.getItem('loginId') || nickname;

        console.log('🎥 LiveKit 연결 시도...');
        await liveKitService.connect(roomId, userId, nickname);

        // 초기 상태 동기화
        setIsMicEnabled(liveKitService.isMicEnabled);
        setIsCameraEnabled(liveKitService.isCameraEnabled);
      } catch (error) {
        console.error('LiveKit 연결 실패:', error);
      } finally {
        setIsLiveKitConnecting(false);
      }
    };

    connectLiveKit();

    return () => {
      liveKitService.disconnect();
    };
  }, [roomId, nickname, isSoloMode]);

  // 마이크 토글 핸들러
  const handleToggleMic = async () => {
    const newState = await liveKitService.toggleMic();
    setIsMicEnabled(newState);
  };

  // 카메라 토글 핸들러
  const handleToggleCamera = async () => {
    const newState = await liveKitService.toggleCamera();
    setIsCameraEnabled(newState);
  };

  // 플레이어 수 확인
  const isGameReady = players.length >= MAX_PLAYERS;

  // 로컬 플레이어 이동 시 WebSocket으로 MOVE 전송하는 콜백 등록
  const { setOnMoveCallback } = useGameStore.getState();

  useEffect(() => {
    if (isSoloMode) return;

    const sendMove = (x: number, y: number, anim?: string) => {
      if (wsRef.current && wsRef.current.isConnected() && roomId) {
        wsRef.current.move(roomId, x, y, anim);
      }
    };

    setOnMoveCallback(sendMove);

    return () => {
      setOnMoveCallback(null);
    };
  }, [roomId, isSoloMode]);

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
            {/* 비디오 영역 */}
            {isMe ? (
              <div className={styles.cameraContent}>
                {isCameraEnabled ? (
                  <video ref={localVideoRef} autoPlay muted playsInline className={styles.localVideo} />
                ) : (
                  <div className={styles.cameraOff}>📹 카메라 OFF</div>
                )}
                <span className={styles.playerLabel}>P{index + 1} (나)</span>
              </div>
            ) : (
              <div className={styles.cameraContent}>
                P{index + 1}: {player.nickname}
              </div>
            )}

            {/* 본인 컨트롤 버튼 */}
            {isMe && (
              <div className={styles.controls}>
                <div className={styles.controlBtn}>
                  <button
                    className={styles.btn}
                    onClick={handleToggleMic}
                  >
                    <div className={isMicEnabled ? styles.micIcon : styles.micOffIcon}></div>
                  </button>
                </div>
                <button className={styles.btn} onClick={handleToggleCamera}>
                  <div className={isCameraEnabled ? styles.cameraIcon : styles.cameraOffIcon}></div>
                </button>
              </div>
            )}

            {/* 다른 플레이어 볼륨 조절 */}
            {!isMe && (
              <div className={styles.controls}>
                <div className={styles.controlBtn}>
                  <button
                    className={styles.btn}
                    onClick={() => setShowVolumeSlider(showVolumeSlider === index ? null : index)}
                  >
                    <div className={styles.volumeIcon}></div>
                  </button>
                  {showVolumeSlider === index && (
                    <div className={styles.volumeSliderContainer} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="range" min="0" max="100" value={playerVolumes[index - 1] || 70}
                        onChange={(e) => handlePlayerVolumeChange(index - 1, Number(e.target.value))}
                        className={styles.verticalSlider}
                      />
                      <span className={styles.volumeText}>{playerVolumes[index - 1] || 70}%</span>
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

  // ========== 대기실 화면 (게임 시작 전) ==========
  const WaitingRoom = () => (
    <div className={styles.waitingRoom}>
      <div className={styles.waitingHeader}>
        <h2>🎮 Room: {roomId}</h2>
        <p>플레이어 {players.length}/{MAX_PLAYERS}</p>
      </div>

      <div className={styles.playerList}>
        {players.map((player, index) => (
          <div key={player.id} className={styles.playerItem} style={{ borderColor: PLAYER_COLORS[index] }}>
            <span className={styles.playerColor} style={{ backgroundColor: PLAYER_COLORS[index] }}></span>
            <span>{player.nickname}</span>
            {player.isHost && <span className={styles.hostBadge}>👑</span>}
          </div>
        ))}
      </div>

      {/* TODO: 백엔드 연동 후 삭제 - 테스트용 버튼 시작 */}
      <button
        className={styles.testBtn}
        onClick={addTestPlayer}
        disabled={players.length >= MAX_PLAYERS}
      >
        ➕ 테스트 플레이어 추가
      </button>
      {/* TODO: 백엔드 연동 후 삭제 - 테스트용 버튼 끝 */}

      {isHost ? (
        <button
          className={`${styles.startBtn} ${isGameReady ? styles.ready : ''}`}
          onClick={handleStartGame}
          disabled={!isGameReady}
        >
          {isGameReady ? '🚀 게임 시작' : `⏳ ${MAX_PLAYERS - players.length}명 더 필요`}
        </button>
      ) : (
        <p className={styles.waitingText}>호스트가 게임을 시작하기를 기다리는 중...</p>
      )}

      <button className={styles.leaveBtn} onClick={leaveGame}>
        🚪 로비로 돌아가기
      </button>
    </div>
  );

  // ========== 스테이지 선택 화면 ==========
  const StageSelect = () => (
    <div className={styles.stageSelectContainer}>
      <div className={styles.stageSelectHeader}>
        <h2>🗺️ Stage Select</h2>
        <p>함께 클리어할 스테이지를 선택하세요!</p>
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
              <div className={styles.stageNumber}>Stage {stageNum}</div>
              <div className={styles.stageStatus}>
                {isCleared && '✅ Cleared'}
                {!isCleared && isUnlocked && '🎮 Play'}
                {!isUnlocked && '🔒 Locked'}
              </div>
            </button>
          );
        })}
      </div>

      <button className={styles.leaveBtn} onClick={leaveGame}>
        🚪 로비로 돌아가기
      </button>
    </div>
  );

  // ========== 메인 게임 화면 (스테이지 플레이 중) ==========
  const GameView = () => (
    <div className={styles.gameContainer}>
      <div className={styles.gameHeader}>
        <span>Stage {currentStage}</span>
        <button className={styles.backBtn} onClick={() => selectStage(0)}>
          ← 스테이지 선택
        </button>
      </div>

      <div className={styles.gameCanvas}>
        <PhaserGame />
      </div>

      {/* 테스트용: 스테이지 클리어 버튼 */}
      <button className={styles.testClearBtn} onClick={() => clearStage(currentStage!)}>
        🎉 스테이지 클리어 (테스트)
      </button>
    </div>
  );

  // ========== 솔로 모드 / 멀티 모드 분기 ==========
  if (isSoloMode) {
    // 솔로 모드: 바로 게임 시작 (스테이지 선택 없이 Stage 1으로)
    return (
      <div className={styles.page}>
        <div className={styles.mainContent}>
          <div className={styles.gameContainer}>
            <div className={styles.gameHeader}>
              <span>🎮 Solo Mode - Stage {currentStage}</span>
              <button className={styles.backBtn} onClick={leaveGame}>
                ← 로비로 돌아가기
              </button>
            </div>
            <div className={styles.gameCanvas}>
              <PhaserGame />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== 멀티 모드: 대기실 / 스테이지 선택 / 게임 플레이 분기 ==========
  return (
    <div className={styles.page}>
      <div className={styles.mainContent}>
        {!isGameStarted && <WaitingRoom />}
        {isGameStarted && currentStage === null && <StageSelect />}
        {isGameStarted && currentStage !== null && <GameView />}
      </div>
      <CameraArea />
    </div>
  );
}