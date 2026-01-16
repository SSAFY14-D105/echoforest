import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore'; // Store 불러오기
import styles from './LobbyPage.module.css';

export default function LobbyPage() {
  // Store에서 필요한 함수 꺼내오기
  const { nickname, setNickname, joinGame } = useGameStore();

  const [roomIdInput, setRoomIdInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // 1. 방 만들기
  const handleHost = () => {
    const newRoomId = Math.floor(Math.random() * 9000 + 1000).toString();
    joinGame(newRoomId, true); // 전역 상태 업데이트
  };

  // 2. 방 참가하기
  const handleJoin = () => {
    if (!/^\d{4}$/.test(roomIdInput)) return alert("4자리 숫자 코드를 입력해주세요!");
    joinGame(roomIdInput, false); // 전역 상태 업데이트
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.box} pixel-box`}>
        <div className={styles.topBar}>
          <span>내 닉네임: <b>{nickname}</b></span>
          <button className={styles.settingsBtn} onClick={() => setShowSettings(true)}>⚙️ 설정</button>
        </div>

        <h2 style={{ fontFamily: 'var(--font-kr)', margin: '10px 0' }}>게임 시작하기</h2>

        <button className={`${styles.btn} ${styles.hostBtn}`} onClick={handleHost}>
          👑 방 만들기 (Host)
        </button>

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <input
            className={styles.input}
            placeholder="숫자 코드 4자리"
            maxLength={4}
            value={roomIdInput}
            onChange={e => setRoomIdInput(e.target.value.replace(/[^0-9]/g, ''))}
            style={{ flex: 1 }}
          />
          <button className={`${styles.btn} ${styles.joinBtn}`} onClick={handleJoin}>
            입장
          </button>
        </div>

        {showSettings && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} pixel-box`}>
              <h3 style={{ fontFamily: 'var(--font-kr)', marginTop: 0 }}>설정</h3>
              <label>닉네임 변경</label>
              <input className={styles.input} value={nickname} onChange={e => setNickname(e.target.value)} />
              <button className={`${styles.btn} ${styles.backBtn}`} onClick={() => setShowSettings(false)} style={{ width: '100%' }}>
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}