import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import type { Player } from '../../../store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import type { GameMessage, ServerPlayerState } from '../../../socket/GameWebSocket';
import PhaserGame from '../../../phaser/PhaserGame';
import CameraArea from '../../../components/CameraArea/CameraArea';
import StageSelectScreen from '../../../components/StageSelectScreen/StageSelectScreen';
import styles from './GamePage.module.css';

const MAX_PLAYERS = 4;

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
    clearStage,
    leaveGame
  } = useGameStore();

  // --- 스테이지 ID 변환 유틸리티 ---
  // 내부용 ID ("MULTI_1") -> 통신용 번호 (1)
  const parseStageNum = (stageId: string | null): number => {
    if (!stageId) return 1;
    const num = parseInt(stageId.replace(/^(MULTI_|SOLO_)/, ''), 10);
    return isNaN(num) ? 1 : num;
  };

  // 통신용 번호 (1) -> 내부용 ID ("MULTI_1")
  const getMultiStageId = (num: number): string => `MULTI_${num}`;

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

  // WebSocket 메시지 핸들러 설정 (싱글톤 사용)
  useEffect(() => {
    if (isSoloMode) return; // 솔로 모드는 WebSocket 사용 안 함
    if (!roomId || !nickname) return;

    // 싱글톤 WS에 메시지 핸들러 설정
    gameWebSocket.onMessage((msg: GameMessage) => {
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
          if (msg.anim && msg.anim.includes('|s:')) {
            const parts = msg.anim.split('|s:');
            if (parts.length > 1) {
              const hostStage = parseInt(parts[1], 10);
              // 현재 내 스테이지와 다르면 동기화 (단, 유효한 스테이지 번호일 때만)
              const { currentStage: myStage, isHost: amIHost } = useGameStore.getState();

              if (!amIHost && hostStage > 0 && parseStageNum(myStage) !== hostStage) {
                console.log(`🔄 P2P Sync: 방장 스테이지(${hostStage})로 이동합니다.`);
                startGameFromServer(hostStage);
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
          // 스테이지 변경 (서버에서 브로드캐스트) - 이전 로직 호환성 유지
          {
            const stage = msg.content ? parseInt(msg.content, 10) : 1;
            selectStage(getMultiStageId(stage)); // useGameStore 수정으로 인해 string 변환됨
            console.log(`🎯 스테이지 변경 (레거시): ${stage}`);
          }
          break;
        case 'STAGE_SELECT':
          // 스테이지 선택 동기화 (호스트가 보낸 신호)
          if (!isHost && msg.stage !== undefined) {
            selectStage(getMultiStageId(msg.stage));
            console.log(`🎯 스테이지 ${msg.stage} 선택됨 (호스트로부터)`);
          }
          break;

        case 'STAGE_CLEAR':
          // 스테이지 클리어 동기화 (호스트가 보낸 신호)
          if (!isHost && msg.stage !== undefined) {
            clearStage(getMultiStageId(msg.stage));
            console.log(`🏆 스테이지 ${msg.stage} 클리어됨 (호스트로부터)`);
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

  // 스테이지 잠금 해제 여부 확인 (for select check)
  const isStageUnlocked = (stageNum: number): boolean => {
    if (stageNum === 1) return true;
    return clearedStages.includes(`MULTI_${stageNum - 1}`);
  };

  // 스테이지 선택 핸들러
  const handleSelectStage = (stageNum: number) => {
    if (isStageUnlocked(stageNum)) {
      selectStage(getMultiStageId(stageNum));
      // 다른 플레이어들에게 스테이지 선택 알림
      if (isHost && roomId) {
        if ('selectStage' in gameWebSocket) {
          (gameWebSocket as any).selectStage(roomId, stageNum);
        }
      }
    }
  };

  // 스테이지 클리어 핸들러 (호스트만, WebSocket 브로드캐스트)
  const handleClearStage = (stageNumOrId: number | string) => {
    const stageNum = typeof stageNumOrId === 'number'
      ? stageNumOrId
      : parseStageNum(stageNumOrId);

    const stageId = typeof stageNumOrId === 'string'
      ? stageNumOrId
      : getMultiStageId(stageNumOrId);

    clearStage(stageId);

    // 다른 플레이어들에게 클리어 알림
    if (isHost && roomId) {
      if ('clearStageSync' in gameWebSocket) {
        (gameWebSocket as any).clearStageSync(roomId, stageNum);
      }
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


  // ========== 혼자하기 모드 화면 (카메라 없음, 로비 복귀 버튼) ==========
  if (isSoloMode && isGameStarted && currentStage !== null) {
    const sceneKey = currentStage.replace('SOLO_', 'Solo') + 'Scene';

    return (
      <div className={styles.gameContainer}>
        {/* 게임 캔버스 (전체 화면 - 카메라 영역 없음) */}
        <div className={`pixel-box ${styles.canvasWrapper}`} style={{ marginBottom: 0, flex: 1 }}>
          <PhaserGame startScene={sceneKey} />
          <div className={styles.gameInfo}>
            🧪 혼자하기 {currentStage.replace('SOLO_', '')} 모드 | {nickname}
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
    const stageNum = currentStage.replace('MULTI_', '');

    return (
      <div className={styles.gameContainer}>
        {/* 게임 캔버스 */}
        <div className={`pixel-box ${styles.canvasWrapper}`}>
          <PhaserGame
            startScene={`Stage${stageNum}Scene`}
            onSendState={handleSendState}
            isSoloMode={isSoloMode}
          />
          <div className={styles.gameInfo}>
            🎮 Stage {stageNum} 진행 중 | Room: <span className={styles.roomId}>{roomId}</span>
          </div>
          {/* TODO: 스테이지 클리어 테스트 버튼 - 나중에 삭제 */}
          <button
            className={styles.testClearBtn}
            onClick={() => handleClearStage(currentStage)}
          >
            🏆 테스트: 스테이지 클리어
          </button>
        </div >

        {/* 카메라 영역 (항상 표시) */}
        <CameraArea />
      </div >
    );
  }

  // ========== 스테이지 선택 화면 (Modularized) ==========
  if (isGameStarted && currentStage === null) {
    return (
      <div className={styles.gameContainer}>
        {/* 스테이지 선택 영역 컴포넌트 */}
        <StageSelectScreen
          roomId={roomId}
          clearedStages={clearedStages}
          isHost={isHost}
          onSelectStage={handleSelectStage}
          onClearStage={handleClearStage}
        />

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
              // [FIX] 안전한 퇴장 처리
              if (roomId && gameWebSocket.isConnected()) {
                gameWebSocket.sendLeave(roomId);
                gameWebSocket.disconnect();
              }
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