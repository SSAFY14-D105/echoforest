import { useState } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import type { GameMessage } from '../../../socket/GameWebSocket';
import JoinGameModal from '../../../components/JoinGameModal/JoinGameModal';
import SettingsModal from '../../../components/SettingsModal/SettingsModal';
import styles from './LobbyPage.module.css';

export default function LobbyPage() {
  const {
    nickname,
    joinGame
  } = useGameStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // 방 만들기 (WebSocket CREATE 메시지 전송)
  const handleHost = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setJoinError('');

    try {
      if (gameWebSocket.isConnected()) {
        // console.log('🔌 로비: 기존 연결 정리 중...');
        gameWebSocket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // console.log('🔌 로비: 웹소켓 연결 시도...');
      gameWebSocket.setUser(nickname);
      await gameWebSocket.connect();

      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ROOM_CREATED') {
          const roomCode = message.content || '';
          // console.log('✅ 방 생성됨:', roomCode);
          joinGame(roomCode, true);
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
        // console.log('🔌 솔로: 기존 연결 정리 중...');
        gameWebSocket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // console.log('🔌 솔로: 웹소켓 연결 시도...');
      gameWebSocket.setUser(nickname);
      await gameWebSocket.connect();
      // console.log('✅ 솔로: WebSocket 연결 완료');

      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ROOM_CREATED') {
          const roomCode = message.content || '';
          // console.log('✅ 솔로 테스트 방 생성됨:', roomCode);

          useGameStore.getState().joinGame(roomCode, true);
          useGameStore.setState({
            isSoloMode: true,
            isGameStarted: true,
            currentStage: 'SOLO_1',
          });

          setIsConnecting(false);
        }
      });

      gameWebSocket.onError((error: string) => {
        setJoinError(error);
        setIsConnecting(false);
      });

      gameWebSocket.createRoom();
      // console.log('🧪 솔로 모드: 테스트용 멀티플레이 방 생성 중...');

    } catch (error) {
      console.error('솔로 모드 시작 실패:', error);
      setJoinError('서버 연결 실패 (게임 서버 확인 필요)');
      gameWebSocket.disconnect();
      setIsConnecting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* 배경 이미지 */}
      <img
        className={styles.bgImage}
        src="/assets/backgrounds/main_page.jpg"
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

      {/* 타이틀 래퍼 (절대 위치 고정) */}
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
              onClick={() => setShowSettings(true)}
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
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}