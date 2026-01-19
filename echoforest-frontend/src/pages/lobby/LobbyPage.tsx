import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './LobbyPage.module.css';

export default function LobbyPage() {
  const { nickname, setNickname, joinGame, startSoloGame } = useGameStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [micVolume, setMicVolume] = useState(50);

  // 방 만들기 (6자리 랜덤 코드)
  const handleHost = () => {
    const newRoomCode = Math.floor(100000 + Math.random() * 900000).toString();
    joinGame(newRoomCode, true);
  };

  // 혼자하기 (테스트 모드)
  const handleSoloPlay = () => {
    startSoloGame();
  };

  // 방 참가하기
  const handleJoinSubmit = () => {
    setJoinError('');

    if (!/^\d{6}$/.test(roomCodeInput)) {
      setJoinError('6자리 숫자 코드를 입력해주세요.');
      return;
    }

    // 백엔드 API로 방 존재 여부 확인
    // TODO: 실제 API 연동 시 수정 필요
    // 임시: 랜덤으로 방이 없다고 가정 (테스트용)
    const roomExists = false; // 실제로는 백엔드 API 호출 결과

    if (!roomExists) {
      setJoinError('해당하는 방을 찾을 수 없습니다.');
      return;
    }

    // 방이 존재하면 참가 (isHost = false)
    joinGame(roomCodeInput, false);
  };

  const openJoinModal = () => {
    setRoomCodeInput('');
    setJoinError('');
    setShowJoinModal(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.lobbyCard}>
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>{nickname.charAt(0).toUpperCase()}</div>
            <span className={styles.username}>{nickname}</span>
          </div>
          <button className={styles.settingsIcon} onClick={() => setShowSettings(true)}>
            ⚙️
          </button>
        </div>

        {/* 타이틀 */}
        <h1 className={styles.title}>게임 로비</h1>
        <p className={styles.subtitle}>방을 만들거나 참가하세요</p>

        {/* 액션 버튼들 */}
        <div className={styles.actions}>
          <button className={`${styles.actionBtn} ${styles.hostBtn}`} onClick={handleHost}>
            <span className={styles.btnIcon}>👑</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>방 만들기</div>
              <div className={styles.btnDesc}>새로운 게임 시작</div>
            </div>
          </button>

          <button className={`${styles.actionBtn} ${styles.joinBtn}`} onClick={openJoinModal}>
            <span className={styles.btnIcon}>🚪</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>방 참가하기</div>
              <div className={styles.btnDesc}>코드로 입장</div>
            </div>
          </button>

          {/* 혼자하기 버튼 */}
          <button className={`${styles.actionBtn} ${styles.soloBtn}`} onClick={handleSoloPlay}>
            <span className={styles.btnIcon}>🧪</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>혼자하기</div>
              <div className={styles.btnDesc}>테스트 모드</div>
            </div>
          </button>
        </div>

        {/* 참가 모달 */}
        {showJoinModal && (
          <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3>방 코드 입력</h3>
              <p className={styles.modalDesc}>6자리 숫자 코드를 입력하세요</p>

              <input
                className={styles.codeInput}
                placeholder="000000"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
              />

              {joinError && <p className={styles.error}>{joinError}</p>}

              <div className={styles.modalActions}>
                <button className={styles.btnSecondary} onClick={() => setShowJoinModal(false)}>
                  취소
                </button>
                <button className={styles.btnPrimary} onClick={handleJoinSubmit}>
                  입장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 설정 모달 */}
        {showSettings && (
          <div className={styles.modalOverlay} onClick={() => setShowSettings(false)}>
            <div className={`${styles.modal} ${styles.settingsModal}`} onClick={(e) => e.stopPropagation()}>
              <h3>설정</h3>

              {/* 닉네임 변경 */}
              <div className={styles.settingSection}>
                <label className={styles.settingLabel}>닉네임</label>
                <input
                  className={styles.input}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임 입력"
                />
              </div>

              {/* 마이크 볼륨 */}
              <div className={styles.settingSection}>
                <label className={styles.settingLabel}>마이크 볼륨</label>
                <div className={styles.volumeControl}>
                  <span>🎤</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={micVolume}
                    onChange={(e) => setMicVolume(Number(e.target.value))}
                    className={styles.slider}
                  />
                  <span className={styles.volumeValue}>{micVolume}%</span>
                </div>
              </div>

              {/* 카메라 미리보기 */}
              <div className={styles.settingSection}>
                <label className={styles.settingLabel}>카메라</label>
                <div className={styles.cameraPreview}>
                  <p>📹 카메라 미리보기</p>
                  <span className={styles.cameraNote}>(백엔드 연동 후 활성화)</span>
                </div>
              </div>

              <button className={styles.btnPrimary} onClick={() => setShowSettings(false)} style={{ width: '100%', marginTop: '20px' }}>
                완료
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}