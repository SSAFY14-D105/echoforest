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

  // 로비 진입 시 웹소켓 상태 초기화 (강제 퇴장 후 재진입 시 꼬임 방지)
  // 단, 연결 자체를 끊으면 닉네임 유지가 안 될 수 있으므로, 에러 상태만 리셋하거나
  // 연결이 끊겨 있다면 재연결 준비를 함.
  // 여기서는 "방에 참가 중인 상태"가 아니라는 것을 확실히 하기 위해 leaveGame()을 호출했으므로,
  // 웹소켓 상의 roomId 등도 클리어해주는 것이 좋으나, WebSocket 클래스에는 그런 상태가 없음.
  // 대신, 확실한 연결을 위해 에러나 이전 상태를 정리함.
  // 주의: 페이지 로드 시마다 disconnect하면 너무 잦은 연결/해제로 부담될 수 있음.
  // 하지만 "에러 발생 후"라면 disconnect가 필요함.

  // 방 만들기 (WebSocket CREATE 메시지 전송) - 싱글톤 사용
  const handleHost = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setJoinError('');

    try {
      // 1. 기존 연결 확실히 끊기 (강제 퇴장 등 불안정 상태 정리)
      if (gameWebSocket.isConnected()) {
        console.log('🔌 로비: 기존 연결 정리 중...');
        gameWebSocket.disconnect();
        // 소켓이 완전히 닫힐 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 2. 재연결 시도
      console.log('🔌 로비: 웹소켓 연결 시도...');
      gameWebSocket.setUser(nickname);
      await gameWebSocket.connect();

      // 3. 메시지 핸들러 재설정
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

      // 4. CREATE 전송
      gameWebSocket.createRoom();

    } catch (error) {
      console.error('방 생성 실패:', error);
      // 토큰 만료 가능성 안내
      setJoinError('서버 연결 실패. (토큰 만료? 로그아웃 후 다시 시도해보세요)');
      gameWebSocket.disconnect();
      setIsConnecting(false);

      // Auto-recovery suggestion (Optional)
      if (window.confirm('서버 연결에 실패했습니다. 토큰이 만료되었을 수 있습니다. 로그아웃 하시겠습니까?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('nickname');
        localStorage.removeItem('loginId');
        window.location.reload(); // Force reload to go to Login Page
      }
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

    const roomCode = roomCodeInput.toUpperCase();

    try {
      // 1. REST API로 방 정보 먼저 확인 (방 존재 여부 및 호스트 확인)
      // 이 단계에서 "방을 찾을 수 없음"을 미리 걸러낼 수 있습니다.
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://i14d105.p.ssafy.io/api';
      const response = await fetch(`${apiBase}/rooms/${roomCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('해당하는 방을 찾을 수 없습니다.');
        }
        throw new Error('방 정보를 가져오는 데 실패했습니다.');
      }

      const roomInfo = await response.json();
      console.log('📋 방 정보 조회 성공:', roomInfo);

      // 내가 호스트인지 확인 (닉네임 기준)
      const amIHost = roomInfo.hostId === nickname;

      // 2. WebSocket 연결 및 JOIN 메시지 전송
      gameWebSocket.setUser(nickname);

      let hasWSError = false;

      gameWebSocket.onMessage((message: GameMessage) => {
        if (message.type === 'ERROR') {
          hasWSError = true;
          const errorMsg = message.content?.includes('Room is full')
            ? '방이 가득 찼습니다.'
            : message.content || '입장 중 오류가 발생했습니다.';
          setJoinError(errorMsg);
          setIsConnecting(false);
          gameWebSocket.disconnect();
        }
      });

      gameWebSocket.onError((error: string) => {
        hasWSError = true;
        setJoinError(error);
        setIsConnecting(false);
      });

      await gameWebSocket.connect();
      gameWebSocket.joinRoom(roomCode);

      // 3. 잠시 후 게임 페이지로 이동 (에러가 없을 경우)
      setTimeout(() => {
        if (!hasWSError) {
          console.log(`🚀 방 입장 성공: ${roomCode} (Host: ${amIHost}, Stage: ${roomInfo.currentStage})`);
          // API에서 받아온 현재 스테이지 정보를 store에 전달 (중간 난입 시 바로 해당 스테이지로 이동)
          joinGame(roomCode, amIHost, roomInfo.currentStage || 0);
        }
      }, 300);

    } catch (error: any) {
      console.error('방 참가 실패:', error);
      setJoinError(error.message || '서버 연결에 실패했습니다.');
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
          <div className={styles.headerActions}>
            <button className={styles.settingsIcon} title="설정" onClick={() => {
              setTempNickname(nickname);
              setShowSettings(true);
            }}>
              <img src="/assets/ui/settings.png" alt="Settings" style={{ width: '24px', height: '24px', objectFit: 'contain', mixBlendMode: 'multiply' }} onError={(e) => {
                // 이미지 로드 실패 시 텍스트로 폴백
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerText = '⚙️';
              }} />
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

          <button className={`${styles.actionBtn} ${styles.joinBtn}`} onClick={openJoinModal} disabled={isConnecting}>
            <span className={styles.btnIcon}>🚪</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>방 참가하기</div>
              <div className={styles.btnDesc}>초대 코드로 친구의 방에 입장합니다</div>
            </div>
          </button>

          <button className={`${styles.actionBtn} ${styles.soloBtn}`} onClick={handleSoloPlay}>
            <span className={styles.btnIcon}>🧪</span>
            <div className={styles.btnContent}>
              <div className={styles.btnTitle}>혼자하기(테스트)</div>
              <div className={styles.btnDesc}>스테이지 기믹을 혼자 연습해봅니다</div>
            </div>
          </button>
        </div>

        {/* Error display */}
        {joinError && <p className={styles.errorMessage}>{joinError}</p>}
      </div>

      {/* 방 코드 입력 모달 */}
      {showJoinModal && (
        <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>방 코드 입력</h3>
            <p className={styles.modalDesc}>공유받은 6자리 코드를 입력하세요</p>
            <input
              type="text"
              maxLength={6}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className={styles.codeInput}
              autoFocus
            />
            {joinError && <p className={styles.error}>{joinError}</p>}
            <div className={styles.modalActions}>
              <button onClick={() => setShowJoinModal(false)} className={styles.btnSecondary}>취소</button>
              <button
                onClick={handleJoinSubmit}
                className={styles.btnPrimary}
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
          <div className={`${styles.modal} ${styles.settingsModal}`} onClick={(e) => e.stopPropagation()}>
            <h3>⚙️ 설정</h3>

            {/* 1. 닉네임 변경 */}
            <div className={styles.settingSection}>
              <label className={styles.settingLabel}>닉네임</label>
              <input
                type="text"
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                placeholder="닉네임 입력"
                className={styles.input}
                maxLength={12}
              />
            </div>

            {/* 2. 카메라 프리뷰 자리 */}
            <div className={styles.settingSection}>
              <label className={styles.settingLabel}>카메라 미리보기</label>
              <div className={styles.cameraPreview}>
                <p>📹 카메라 미리보기</p>
                <span className={styles.cameraNote}>LiveKit 연동 시 활성화됩니다</span>
              </div>
            </div>


            {/* 4. 마이크 볼륨 */}
            <div className={styles.settingSection}>
              <label className={styles.settingLabel}>마이크 볼륨</label>
              <div className={styles.volumeControl}>
                <span>🎙️</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={micVolume}
                  onChange={(e) => setMicVolume(Number(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.volumeValue}>{micVolume}%</span>
              </div>
            </div>

            {/* 모달 액션 */}
            <div className={styles.modalActions}>
              <button onClick={() => setShowSettings(false)} className={styles.btnSecondary}>취소</button>
              <button
                onClick={() => {
                  if (tempNickname.trim()) {
                    setNickname(tempNickname.trim());
                  }
                  setShowSettings(false);
                }}
                className={styles.btnPrimary}
              >
                저장
              </button>
            </div>

            {/* 로그아웃 버튼 (작게 최하단에 배치) */}
            <div className={styles.logoutSection}>
              <button
                className={styles.logoutBtn}
                onClick={() => {
                  if (window.confirm('정말 로그아웃 하시겠습니까?')) {
                    // 로그아웃 처리
                    localStorage.removeItem('token');
                    localStorage.removeItem('loginId');
                    localStorage.removeItem('nickname');
                    setNickname(''); // Store 초기화 -> App.tsx에서 로그인 페이지로 전환됨
                    gameWebSocket.disconnect(); // 소켓 연결 끊기
                    setShowSettings(false);
                  }
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}