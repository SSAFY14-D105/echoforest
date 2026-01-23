import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { Player } from '../../store/useGameStore';
import { gameWebSocket } from '../../socket/GameWebSocket';
import type { GameMessage, ServerPlayerState } from '../../socket/GameWebSocket';
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
    readyPlayers,
    isGameStarted,
    isSoloMode,
    currentStage,
    clearedStages,
    addPlayer,
    syncPlayersFromServer,
    removePlayerByNickname,
    setPlayerReady,
    startGame,
    startGameFromServer,
    selectStage,
    setCurrentStageFromServer,
    clearStage,
    leaveGame
  } = useGameStore();

  // LiveKit 상태
  const [isLiveKitConnecting, setIsLiveKitConnecting] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);

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
      id: nickname,  // nickname을 id로 사용 (서버와 일치)
      nickname: nickname,
      isHost: isHost,
      isLocal: true
    };
    addPlayer(myPlayer);
  }, [isSoloMode]);

  // LiveKit 연결 (방 입장 시)
  useEffect(() => {
    if (isSoloMode) return; // 솔로 모드는 LiveKit 사용 안 함
    if (!roomId || !nickname) return;
    if (isLiveKitConnecting || liveKitService.isConnected) return;

    const connectLiveKit = async () => {
      // [DIAGNOSIS] 파라미터 확인 로그
      console.log(`[LiveKit] Attempting connection. Room: ${roomId}, Nickname: ${nickname}, Solo: ${isSoloMode}`);

      if (!roomId || !nickname) {
        console.warn('[LiveKit] Missing required parameters. Aborting connection.');
        return;
      }

      setIsLiveKitConnecting(true);
      try {
        // 로컬 비디오 엘리먼트 설정
        liveKitService.setLocalVideoElement(localVideoRef.current);

        // userId는 localStorage에서 가져오기
        const userId = localStorage.getItem('loginId') || nickname;

        console.log(`[LiveKit] Calling connect() with UserID: ${userId}`);
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

  // PhaserGame으로 전달할 상태 전송 콜백 (useCallback으로 최적화)
  const handleSendState = useCallback((x: number, y: number, vx: number, vy: number, anim: string) => {
    if (roomId && !isSoloMode) {
      let finalAnim = anim;
      // Host P2P Broadcast: 애니메이션 태그에 현재 스테이지 정보 숨겨서 전송
      if (isHost && currentStage) {
        finalAnim = `${anim}|s:${currentStage}`;
      }
      gameWebSocket.sendPlayerState(roomId, x, y, vx, vy, finalAnim);
    }
  }, [roomId, isSoloMode, isHost, currentStage]);

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

  // WebSocket 메시지 핸들러 설정 (싱글톤 사용)
  useEffect(() => {
    if (isSoloMode) return; // 솔로 모드는 WebSocket 사용 안 함
    if (!roomId || !nickname) return;

    // 싱글톤 WS에 메시지 핸들러 설정
    gameWebSocket.onMessage((msg: GameMessage) => {
      // 진단을 위해 로그 일시 차단
      // if (msg.type !== 'MOVE') {
      //   console.log('📩 WebSocket 메시지:', msg);
      // }

      switch (msg.type) {
        case 'UPDATE':
          // 백엔드에서 20 TPS로 전송하는 전체 플레이어 상태
          if (msg.content) {
            try {
              const serverPlayers: ServerPlayerState[] = JSON.parse(msg.content);
              syncPlayersFromServer(serverPlayers);
            } catch (e) {
              console.error('UPDATE 메시지 파싱 오류:', e);
            }
          }
          break;

        case 'JOIN':
          // 다른 플레이어 입장
          if (msg.username && msg.username !== nickname) {
            const newPlayer: Player = {
              id: msg.username,  // nickname을 고유 ID로 사용 (서버와 일치)
              nickname: msg.username,
              isHost: false,     // 나중에 들어온 사람은 Host가 아님 (보수적 판단)
              x: msg.x,
              y: msg.y
            };
            addPlayer(newPlayer);
            console.log(`👋 ${msg.username} 입장`);
          }
          break;

        case 'MOVE':
          // P2P Stage Sync: Host가 보낸 스테이지 태그(|s:X) 감지
          // late joiner가 방장의 위치 패킷을 보고 스테이지를 따라가는 로직
          if (msg.anim && msg.anim.includes('|s:')) {
            const parts = msg.anim.split('|s:');
            if (parts.length > 1) {
              const hostStage = parseInt(parts[1], 10);
              // 현재 내 스테이지와 다르면 동기화 (단, 유효한 스테이지 번호일 때만)
              // useGameStore의 currentStage는 store에서 가져옴
              const { currentStage: myStage, isHost: amIHost } = useGameStore.getState();

              if (!amIHost && hostStage > 0 && myStage !== hostStage) {
                console.log(`🔄 P2P Sync: 방장 스테이지(${hostStage})로 이동합니다.`);
                startGameFromServer(hostStage); // 또는 setCurrentStageFromServer
              }
            }
          }
          break;

        case 'LEAVE':
        case 'PLAYER_LEFT':
          // 다른 플레이어 퇴장
          if (msg.username) {
            removePlayerByNickname(msg.username);
            console.log(`👋 ${msg.username} 퇴장`);
          }
          break;

        case 'READY_STATUS':
          // 플레이어 Ready 상태 변경
          if (msg.username) {
            const isReady = msg.content === 'true';
            setPlayerReady(msg.username, isReady);
            console.log(`✅ ${msg.username} Ready: ${isReady}`);
          }
          break;

        case 'GAME_START':
          // 게임 시작 (서버에서 브로드캐스트)
          {
            const stage = msg.content ? parseInt(msg.content, 10) : 1;
            startGameFromServer(stage);
            console.log(`🚀 게임 시작! 스테이지: ${stage}`);
          }
          break;

        case 'STAGE_CHANGE':
          // 스테이지 변경 (서버에서 브로드캐스트)
          {
            const stage = msg.content ? parseInt(msg.content, 10) : 1;
            setCurrentStageFromServer(stage);
            console.log(`🎯 스테이지 변경: ${stage}`);
          }
          break;

        case 'ROOM_CLOSED':
          // 방 폭파 (방장 퇴장)
          console.log('🚨 방장이 방을 나갔습니다.');
          leaveGame();
          alert('방장이 방을 나가 게임이 종료되었습니다.');
          break;

        case 'KICKED':
          // 강제 퇴장됨
          console.log('🚨 방에서 강제 퇴장되었습니다.');
          leaveGame();
          alert('방장에 의해 강제 퇴장되었습니다.');
          break;

        case 'ERROR':
          console.error('❌ WebSocket 에러:', msg.content);
          break;
      }
    });

    gameWebSocket.onError((error) => {
      console.error('❌ WebSocket 에러:', error);
    });

    // 이미 LobbyPage에서 연결되어 있으므로 재연결 불필요
    // 연결이 끊어진 경우에만 재연결
    if (!gameWebSocket.isConnected()) {
      console.log('🔌 GamePage: WebSocket 재연결 시도...');
      gameWebSocket.setUser(nickname);
      gameWebSocket.connect().catch(err => {
        console.error('WebSocket 재연결 실패:', err);
      });
    }

    // cleanup: 언마운트 시에도 싱글톤 연결은 유지 (leaveGame에서 정리)
  }, [roomId, nickname, isSoloMode, isHost]);



  // 전원 Ready 상태 확인 (방장 제외)
  const { isAllReady } = useGameStore.getState();
  const allReady = isAllReady();

  // 본인의 Ready 상태
  const [myReady, setMyReady] = useState(false);

  // Ready 버튼 핸들러 (비방장용)
  const handleToggleReady = () => {
    if (!roomId || isSoloMode) return;
    const newReady = !myReady;
    setMyReady(newReady);
    gameWebSocket.sendReady(roomId, newReady);
    console.log(`✅ Ready 상태 변경: ${newReady}`);
  };


  // 로컬 플레이어 이동 시 콜백 등록 (솔로 모드용 - 멀티는 키보드 이벤트 핸들러 사용)
  const { setOnMoveCallback } = useGameStore.getState();

  useEffect(() => {
    if (isSoloMode) return;

    // 멀티플레이에서는 키보드 이벤트 핸들러가 입력을 서버로 전송
    // 이 콜백은 솔로 모드 호환성을 위해 유지
    const sendMove = (x: number, y: number) => {
      // 멀티플레이에서는 별도 처리 없음 (키보드 이벤트로 처리)
      console.log('Move callback (unused in multiplayer):', x, y);
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

  // 게임 시작 핸들러 (호스트만)
  const handleStartGame = () => {
    if (!isHost) return;

    if (isSoloMode) {
      // 솔로 모드: 로컬에서 바로 시작
      startGame();
      console.log('🚀 솔로 게임 시작');
    } else {
      // 멀티플레이: 서버에 게임 시작 요청
      if (!allReady && players.length > 1) {
        alert('모든 플레이어가 Ready 상태여야 시작할 수 있습니다.');
        return;
      }
      gameWebSocket.sendStartGame(roomId);
      console.log('🚀 게임 시작 요청 전송');
    }
  };

  // 스테이지 잠금 해제 여부 확인
  const isStageUnlocked = (stageNum: number): boolean => {
    if (stageNum === 1) return true; // Stage 1은 항상 열림
    return clearedStages.includes(stageNum - 1); // 이전 스테이지 클리어 시 열림
  };

  // 스테이지 선택 핸들러
  // 현재 백엔드에 스테이지 선택 메시지가 없으므로 로컬에서만 처리
  const handleSelectStage = (stageNum: number) => {
    if (isStageUnlocked(stageNum)) {
      selectStage(stageNum);
      console.log(`🎯 스테이지 ${stageNum} 선택됨 (로컬)`);
    }
  };

  // 스테이지 클리어 핸들러
  // 현재 백엔드에 스테이지 클리어 메시지가 없으므로 로컬에서만 처리
  const handleClearStage = (stageNum: number) => {
    clearStage(stageNum);
    console.log(`🏆 스테이지 ${stageNum} 클리어됨 (로컬)`);
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
                  <video ref={localVideoRef} autoPlay muted playsInline className={styles.localVideo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className={styles.cameraOff}>📹</div>
                )}
                <span className={styles.playerLabel} style={{ position: 'absolute', bottom: 5, left: 5, color: 'white', fontSize: 10, background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: 4 }}>나</span>
              </div>
            ) : (
              <div className={styles.cameraContent}>
                {/* 원격 플레이어 비디오는 추가 작업 필요, 일단 이름 표시 */}
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
          <PhaserGame startScene="SoloScene" />
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
          <PhaserGame
            startScene={`Stage${currentStage}Scene`}
            onSendState={handleSendState}
            isSoloMode={isSoloMode}
          />
          <div className={styles.gameInfo}>
            🎮 Stage {currentStage} 진행 중 | Room: <span className={styles.roomId}>{roomId}</span>
          </div>
          {/* TODO: 스테이지 클리어 테스트 버튼 - 나중에 삭제 */}
          <button
            className={styles.testClearBtn}
            onClick={() => handleClearStage(currentStage)}
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
                  disabled={!isUnlocked || !isHost}
                >
                  <div className={styles.stageIcon}>
                    {isUnlocked ? (isCleared ? '⭐' : `${stageNum}`) : '🔒'}
                  </div>
                  <div className={styles.stageLabel}>Stage {stageNum}</div>
                  <div className={styles.stageStatus}>
                    {isCleared ? '클리어!' : isUnlocked ? (isHost ? '도전 가능' : '호스트 대기') : '잠김'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* TODO: 테스트용 스테이지 해금 버튼 - 나중에 삭제 */}
          {isHost && (
            <div className={styles.testButtons}>
              <button
                className={styles.testBtn}
                onClick={() => handleClearStage(1)}
                disabled={clearedStages.includes(1)}
              >
                🧪 Stage 1 클리어 처리
              </button>
              <button
                className={styles.testBtn}
                onClick={() => handleClearStage(2)}
                disabled={!clearedStages.includes(1) || clearedStages.includes(2)}
              >
                🧪 Stage 2 클리어 처리
              </button>
            </div>
          )}
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
        <PhaserGame
          startScene="LobbyScene"
          onSendState={handleSendState}
          isSoloMode={isSoloMode}
        />
        <div className={styles.gameInfo}>
          🎮 대기실 | Room: <span className={styles.roomId}>{roomId}</span> |
          👥 {players.length}/{MAX_PLAYERS}
        </div>
        {/* 로비로 돌아가기 버튼 (우상단) */}
        <button
          className={styles.backToLobbyBtn}
          onClick={() => {
            if (window.confirm('정말 대기방을 나가시겠습니까?')) {
              leaveGame();
            }
          }}
        >
          ← 나가기
        </button>
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

        {/* Ready 버튼 - 비방장만 표시 */}
        {!isSoloMode && !isHost && (
          <button
            className={`${styles.readyBtn} ${myReady ? styles.readyActive : ''}`}
            onClick={handleToggleReady}
          >
            {myReady ? '✅ Ready!' : '⏳ Ready'}
          </button>
        )}

        {/* Ready 상태 표시 (멀티플레이) */}
        {!isSoloMode && players.length > 1 && (
          <div className={styles.readyStatus}>
            Ready: {readyPlayers.length}/{players.filter(p => !p.isHost).length}
            {allReady && <span style={{ marginLeft: 8, color: '#4CAF50' }}>✓ 전원 준비완료!</span>}
          </div>
        )}

        {/* 게임 시작 버튼 - 호스트일 때만 */}
        {isHost && (
          <button
            className={styles.startGameBtn}
            onClick={handleStartGame}
            disabled={!isSoloMode && players.length > 1 && !allReady}
          >
            🚀 게임 시작!
          </button>
        )}

        {/* 대기 메시지 */}
        {players.length < 2 && !isSoloMode && (
          <span className={styles.waitingMessage}>
            다른 플레이어를 기다리는 중...
          </span>
        )}

        {/* 호스트 아닌 경우 대기 */}
        {!isHost && players.length >= 2 && (
          <span className={styles.waitingMessage}>
            호스트가 게임을 시작하길 기다리는 중...
          </span>
        )}
      </div>
    </div>
  );
}