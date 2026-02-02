import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../../../store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import type { GameMessage } from '../../../socket/GameWebSocket';
import JoinGameModal from '../../../components/JoinGameModal/JoinGameModal';
import SettingsModal from '../../../components/SettingsModal/SettingsModal';
import AudioController from '../../../components/common/AudioController';
import styles from './LobbyPage.module.css';

export default function LobbyPage() {
  const {
    nickname,
    roomId,
    joinGame,
    leaveGame
  } = useGameStore();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // [NEW] URL 쿼리 파라미터로 모달 상태 제어
  const showSettings = searchParams.get('settings') === 'true';

  // [NEW] 뒤로가기로 로비 진입 시 게임 상태 정리
  useEffect(() => {
    if (roomId) {
      leaveGame();
      gameWebSocket.disconnect();
    }
  }, []);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // 방 만들기 (WebSocket CREATE 메시지 전송)
  const handleHost = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setJoinError('');

    try {
      if (gameWebSocket.isConnected()) {
        gameWebSocket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      gameWebSocket.setUser(nickname);
      await gameWebSocket.connect();

      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ROOM_CREATED') {
          const roomCode = message.content || '';
          joinGame(roomCode, true);
          navigate('/game');
        }
      });

      gameWebSocket.onError((error: string) => {
        setJoinError(error);
        setIsConnecting(false);
      });

      gameWebSocket.createRoom();

    } catch (error) {
      console.error('방 생성 실패:', error);
      setJoinError('서버 연결 실패. (토큰 만료?)');
      gameWebSocket.disconnect();
      setIsConnecting(false);
    }
  };

  const handleSoloPlay = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setJoinError('');

    try {
      if (gameWebSocket.isConnected()) {
        gameWebSocket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      gameWebSocket.setUser(nickname);
      await gameWebSocket.connect();

      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ROOM_CREATED') {
          const roomCode = message.content || '';

          useGameStore.getState().joinGame(roomCode, true);
          useGameStore.setState({
            isSoloMode: true,
            isGameStarted: true,
            currentStage: 'SOLO_1',
          });

          navigate('/game');
          setIsConnecting(false);
        }
      });

      gameWebSocket.onError((error: string) => {
        setJoinError(error);
        setIsConnecting(false);
      });

      gameWebSocket.createRoom();

    } catch (error) {
      console.error('솔로 모드 시작 실패:', error);
      setJoinError('서버 연결 실패 (게임 서버 확인 필요)');
      gameWebSocket.disconnect();
      setIsConnecting(false);
    }
  };

  // 설정 열기/닫기 핸들러
  const openSettings = () => setSearchParams({ settings: 'true' });
  const closeSettings = () => {
    setSearchParams({}); // 쿼리 파라미터 제거 -> 모달 닫힘
  };

  return (
    <div className={styles.container}>
      <AudioController />
      {/* 배경 이미지 */}
      <img
        className={styles.bgImage}
        src="/assets/backgrounds/main_page.png"
        alt="메아리의 숲"
      />

      {/* 오른쪽 상단 버튼들 */}
      <div className={styles.topRightButtons}>
        <button
          className={styles.soloButton}
          onClick={handleSoloPlay}
          disabled={isConnecting}
        >
          🧪 혼자하기
        </button>
      </div>

      {/* [NEW] 메인 타이틀 (MainPage와 동일) */}
      <div className={styles.titleWrapper}>
        <h1 className={styles.mainTitle}>메아리의 숲</h1>
        <h2 className={styles.subTitle}>Echo Forest</h2>
      </div>

      {/* 메뉴 (검정 보드 위치) */}
      {!showSettings && !showJoinModal && (
        <div className={styles.menuWrapper}>
          <div className={styles.menuItems}>
            <button
              className={styles.menuButton}
              onClick={handleHost}
              disabled={isConnecting}
            >
              <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
              방 만들기
            </button>
            <button
              className={styles.menuButton}
              onClick={() => setShowJoinModal(true)}
              disabled={isConnecting}
            >
              <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
              방 참여하기
            </button>
            <button
              className={styles.menuButton}
              onClick={openSettings}
            >
              <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
              설정
            </button>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {joinError && <div className={styles.errorToast}>{joinError}</div>}

      {/* Modals */}
      {showJoinModal && (
        <JoinGameModal
          nickname={nickname}
          onClose={() => setShowJoinModal(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={closeSettings}
        />
      )}
    </div>
  );
}