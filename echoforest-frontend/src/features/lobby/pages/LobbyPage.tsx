import { useState } from 'react';
import { useGameStore } from '../../game/store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import type { GameMessage } from '../../../socket/GameWebSocket';
import JoinGameModal from '../components/JoinGameModal';
import SettingsModal from '../components/SettingsModal';
import styles from './LobbyPage.module.css';

export default function LobbyPage() {
  const {
    nickname,
    joinGame, startSoloGame
  } = useGameStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // 방 만들기 (WebSocket CREATE 메시지 전송) - 싱글톤 사용
  const handleHost = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setJoinError('');

    try {
      // 1. 기존 연결 확실히 끊기
      if (gameWebSocket.isConnected()) {
        console.log('🔌 로비: 기존 연결 정리 중...');
        gameWebSocket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 2. 재연결 시도
      console.log('🔌 로비: 웹소켓 연결 시도...');
      gameWebSocket.setUser(nickname);
      await gameWebSocket.connect();

      // 3. 메시지 핸들러 재설정
      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ROOM_CREATED') {
          const roomCode = message.content || '';
          console.log('✅ 방 생성됨:', roomCode);
          joinGame(roomCode, true);
        }
      });

      gameWebSocket.onError((error: string) => {
        setJoinError(error);
        setIsConnecting(false);
      });

      // 4. CREATE 전송
      gameWebSocket.createRoom();

    } catch (error) {
      console.error('방 생성 실패:', error);
      setJoinError('서버 연결 실패. (토큰 만료?)');
      gameWebSocket.disconnect();
      setIsConnecting(false);
    }
  };

  const handleSoloPlay = () => {
    startSoloGame();
  };

  return (
    <div className={styles.container}>
      <div className={styles.lobbyCard}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>{nickname.charAt(0).toUpperCase()}</div>
            <span className={styles.username}>{nickname}</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.settingsIcon} title="설정" onClick={() => setShowSettings(true)}>
              <img
                src="/assets/ui/settings.png"
                alt="Settings"
                style={{ width: '24px', height: '24px', objectFit: 'contain', mixBlendMode: 'multiply' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerText = '⚙️';
                }}
              />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className={styles.titleSection}>
          <h1 className={styles.title}>🌲 에코 포레스트</h1>
          <p className={styles.subtitle}>친구들과 함께 숲을 탐험하세요!</p>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button className={`${styles.actionBtn} ${styles.hostBtn}`} onClick={handleHost} disabled={isConnecting}>
            <span className={styles.btnIcon}>🏠</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>방 만들기</div>
              <div className={styles.btnDesc}>새로운 게임 세션을 시작합니다</div>
            </div>
          </button>

          <button className={`${styles.actionBtn} ${styles.joinBtn}`} onClick={() => setShowJoinModal(true)} disabled={isConnecting}>
            <span className={styles.btnIcon}>🚪</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>방 참가하기</div>
              <div className={styles.btnDesc}>초대 코드로 친구의 방에 입장합니다</div>
            </div>
          </button>

          <button className={`${styles.actionBtn} ${styles.soloBtn}`} onClick={handleSoloPlay}>
            <span className={styles.btnIcon}>🧪</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>혼자하기</div>
              <div className={styles.btnDesc}>테스트 모드</div>
            </div>
          </button>
        </div>

        {/* Error display */}
        {joinError && <p className={styles.errorMessage}>{joinError}</p>}
      </div>

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