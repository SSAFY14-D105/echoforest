import { useState, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { GameWebSocket } from '../../socket/GameWebSocket';
import type { GameMessage } from '../../socket/GameWebSocket';
import styles from './LobbyPage.module.css';

export default function LobbyPage() {
  const { nickname, setNickname, joinGame, startSoloGame } = useGameStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [micVolume, setMicVolume] = useState(50);
  const [isConnecting, setIsConnecting] = useState(false);

  // 설정 모달용 임시 닉네임 (빈 문자열 방지)
  const [tempNickname, setTempNickname] = useState(nickname);

  // WebSocket 인스턴스 참조
  const wsRef = useRef<GameWebSocket | null>(null);

  // 방 만들기 (WebSocket CREATE 메시지 전송)
  const handleHost = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setJoinError('');

    try {
      const ws = new GameWebSocket(nickname);
      wsRef.current = ws;

      // 메시지 핸들러 설정
      ws.onMessage((message: GameMessage) => {
        if (message.type === 'ROOM_CREATED') {
          // 백엔드가 생성한 방 코드 사용
          const roomCode = message.content || '';
          console.log('✅ 방 생성됨:', roomCode);
          joinGame(roomCode, true);
        }
      });

      ws.onError((error: string) => {
        setJoinError(error);
        setIsConnecting(false);
      });

      // WebSocket 연결 후 CREATE 메시지 전송
      await ws.connect();
      ws.createRoom();  // roomId 없이 보내면 백엔드가 생성

    } catch (error) {
      console.error('방 생성 실패:', error);
      setJoinError('서버 연결에 실패했습니다.');
      setIsConnecting(false);
    }
  };

  // 혼자하기 1
  const handleSoloPlay = () => {
    startSoloGame();
  };


  // 방 참가하기 (WebSocket JOIN 메시지 전송)
  const handleJoinSubmit = async () => {
    setJoinError('');

    if (!/^[A-Za-z0-9]{6}$/.test(roomCodeInput)) {
      setJoinError('6자리 코드를 입력해주세요. (영문+숫자)');
      return;
    }

    if (isConnecting) return;
    setIsConnecting(true);

    try {
      const ws = new GameWebSocket(nickname);
      wsRef.current = ws;

      let hasError = false;  // 에러 발생 여부 추적

      // 메시지 핸들러 - ERROR 응답 처리
      ws.onMessage((message: GameMessage) => {
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
          ws.disconnect();
        }
      });

      ws.onError((error: string) => {
        hasError = true;
        setJoinError(error);
        setIsConnecting(false);
      });

      // WebSocket 연결 후 JOIN 메시지 전송
      await ws.connect();
      ws.joinRoom(roomCodeInput.toUpperCase());

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
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>{nickname.charAt(0).toUpperCase()}</div>
            <span className={styles.username}>{nickname}</span>
          </div>
          <button className={styles.settingsIcon} onClick={() => {
            setTempNickname(nickname);  // 설정 열 때 현재 닉네임으로 초기화
            setShowSettings(true);
          }}>
            ⚙️
          </button>
        </div>

        {/* 타이틀 */}
        <h1 className={styles.title}>게임 로비</h1>
        <p className={styles.subtitle}>방을 만들거나 참가하세요</p>

        {/* 액션 버튼들 */}
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${styles.hostBtn}`}
            onClick={handleHost}
            disabled={isConnecting}
          >
            <span className={styles.btnIcon}>👑</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>{isConnecting ? '연결중...' : '방 만들기'}</div>
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
              <div className={styles.btnDesc}>스테이지 1부터 시작</div>
            </div>
          </button>
        </div>

        {/* 에러 메시지 표시 */}
        {joinError && <p className={styles.error}>{joinError}</p>}

        {/* 참가 모달 */}
        {showJoinModal && (
          <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3>방 코드 입력</h3>
              <p className={styles.modalDesc}>6자리 코드를 입력하세요 (영문+숫자)</p>

              <input
                className={styles.codeInput}
                placeholder="ABC123"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                autoFocus
              />

              {joinError && <p className={styles.error}>{joinError}</p>}

              <div className={styles.modalActions}>
                <button className={styles.btnSecondary} onClick={() => setShowJoinModal(false)}>
                  취소
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={handleJoinSubmit}
                  disabled={isConnecting}
                >
                  {isConnecting ? '연결중...' : '입장'}
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
                  value={tempNickname}
                  onChange={(e) => setTempNickname(e.target.value)}
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

              <button
                className={styles.btnPrimary}
                onClick={() => {
                  // 닉네임이 비어있지 않을 때만 저장
                  if (tempNickname.trim()) {
                    setNickname(tempNickname.trim());
                    localStorage.setItem('nickname', tempNickname.trim());
                  }
                  setShowSettings(false);
                }}
                style={{ width: '100%', marginTop: '20px' }}
              >
                완료
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}