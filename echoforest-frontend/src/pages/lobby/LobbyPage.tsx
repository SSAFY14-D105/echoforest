import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { gameWebSocket } from '../../socket/GameWebSocket';
import type { GameMessage } from '../../socket/GameWebSocket';
import styles from './LobbyPage.module.css';

export default function LobbyPage() {
  const {
    nickname, setNickname,
    joinGame, startSoloGame
  } = useGameStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [micVolume, setMicVolume] = useState(50);
  const [isConnecting, setIsConnecting] = useState(false);

  // 설정 모달용 임시 닉네임 (빈 문자열 방지)
  const [tempNickname, setTempNickname] = useState(nickname);

  // 방 만들기 (WebSocket CREATE 메시지 전송) - 싱글톤 사용
  const handleHost = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setJoinError('');

    try {
      // 싱글톤 WS에 유저 정보 설정
      gameWebSocket.setUser(nickname);

      // 메시지 핸들러 설정
      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ROOM_CREATED') {
          // 백엔드가 생성한 방 코드 사용
          const roomCode = message.content || '';
          console.log('✅ 방 생성됨:', roomCode);
          joinGame(roomCode, true);
        }
      });

      gameWebSocket.onError((error: string) => {
        setJoinError(error);
        setIsConnecting(false);
      });

      // WebSocket 연결 후 CREATE 메시지 전송
      await gameWebSocket.connect();
      gameWebSocket.createRoom();  // roomId 없이 보내면 백엔드가 생성

    } catch (error) {
      console.error('방 생성 실패:', error);
      setJoinError('서버 연결에 실패했습니다.');
      setIsConnecting(false);
    }
  };

  // 혼자하기 (테스트 모드)
  const handleSoloPlay = () => {
    startSoloGame();
  };

  // 방 참가하기 (WebSocket JOIN 메시지 전송) - 싱글톤 사용
  const handleJoinSubmit = async () => {
    setJoinError('');

    if (!/^[A-Za-z0-9]{6}$/.test(roomCodeInput)) {
      setJoinError('6자리 코드를 입력해주세요. (영문+숫자)');
      return;
    }

    if (isConnecting) return;
    setIsConnecting(true);

    try {
      // 싱글톤 WS에 유저 정보 설정
      gameWebSocket.setUser(nickname);

      let hasError = false;  // 에러 발생 여부 추적

      // 메시지 핸들러 - ERROR 응답 처리
      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ERROR') {
          hasError = true;
          // "Room not found" 에러를 한글로 변환
          const errorMsg = message.content?.includes('Room not found')
            ? '해당하는 방을 찾을 수 없습니다.'
            : message.content?.includes('Room is full')
              ? '방이 가득 찼습니다.'
              : message.content || '알 수 없는 오류';
          setJoinError(errorMsg);
          setIsConnecting(false);
          gameWebSocket.disconnect();
        }
      });

      gameWebSocket.onError((error: string) => {
        hasError = true;
        setJoinError(error);
        setIsConnecting(false);
      });

      // WebSocket 연결 후 JOIN 메시지 전송
      await gameWebSocket.connect();
      gameWebSocket.joinRoom(roomCodeInput.toUpperCase());

      // 에러 응답 대기 후 성공 판단 (에러 없으면 입장)
      setTimeout(() => {
        if (!hasError) {
          joinGame(roomCodeInput.toUpperCase(), false);
        }
      }, 500);

    } catch (error) {
      console.error('방 참가 실패:', error);
      setJoinError('서버 연결에 실패했습니다.');
      setIsConnecting(false);
    }
  };

  const openJoinModal = () => {
    setRoomCodeInput('');
    setJoinError('');
    setShowJoinModal(true);
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
          <button className={styles.settingsIcon} onClick={() => {
            setTempNickname(nickname);
            setShowSettings(true);
          }}>
            ⚙️
          </button>
        </div>

        {/* Title */}
        <div className={styles.titleSection}>
          <h1 className={styles.title}>🌲 에코 포레스트</h1>
          <p className={styles.subtitle}>친구들과 함께 숲을 탐험하세요!</p>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button className={styles.hostBtn} onClick={handleHost} disabled={isConnecting}>
            <span className={styles.btnEmoji}>🏠</span>
            <span className={styles.btnText}>방 만들기</span>
          </button>
          <button className={styles.joinBtn} onClick={openJoinModal} disabled={isConnecting}>
            <span className={styles.btnEmoji}>🚪</span>
            <span className={styles.btnText}>방 참가하기</span>
          </button>
          <button className={styles.soloBtn} onClick={handleSoloPlay}>
            <span className={styles.btnEmoji}>🧪</span>
            <span className={styles.btnText}>혼자하기(테스트)</span>
          </button>
        </div>

        {/* Error display */}
        {joinError && <p className={styles.errorMessage}>{joinError}</p>}
      </div>

      {/* 방 코드 입력 모달 */}
      {showJoinModal && (
        <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>방 코드 입력</h2>
            <input
              type="text"
              maxLength={6}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="6자리 코드"
              className={styles.codeInput}
              autoFocus
            />
            {joinError && <p className={styles.modalError}>{joinError}</p>}
            <div className={styles.modalActions}>
              <button onClick={() => setShowJoinModal(false)} className={styles.cancelBtn}>취소</button>
              <button
                onClick={handleJoinSubmit}
                className={styles.confirmBtn}
                disabled={isConnecting}
              >
                {isConnecting ? '연결 중...' : '입장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div className={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ 설정</h2>

            {/* 1. 닉네임 변경 */}
            <div className={styles.settingsSection}>
              <label className={styles.settingsLabel}>닉네임</label>
              <input
                type="text"
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                placeholder="닉네임 입력"
                className={styles.nicknameInput}
                maxLength={12}
              />
            </div>

            {/* 2. 카메라 프리뷰 자리 */}
            <div className={styles.settingsSection}>
              <label className={styles.settingsLabel}>카메라 미리보기</label>
              <div className={styles.cameraPreview}>
                <span className={styles.cameraPlaceholder}>📹 카메라 미리보기</span>
              </div>
            </div>

            {/* 3. 마이크 볼륨 */}
            <div className={styles.settingsSection}>
              <label className={styles.settingsLabel}>마이크 볼륨</label>
              <div className={styles.volumeContainer}>
                <div className={styles.volumeBarContainer}>
                  <div
                    className={styles.volumeBar}
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={micVolume}
                  onChange={(e) => setMicVolume(Number(e.target.value))}
                  className={styles.volumeSlider}
                />
                <span className={styles.volumeValue}>{micVolume}%</span>
              </div>
            </div>

            {/* 모달 액션 */}
            <div className={styles.modalActions}>
              <button onClick={() => setShowSettings(false)} className={styles.cancelBtn}>취소</button>
              <button
                onClick={() => {
                  if (tempNickname.trim()) {
                    setNickname(tempNickname.trim());
                  }
                  setShowSettings(false);
                }}
                className={styles.confirmBtn}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}