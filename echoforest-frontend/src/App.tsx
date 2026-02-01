import { useEffect, useState } from 'react';
import { useGameStore } from './store/useGameStore';
import MainPage from './pages/auth/MainPage/MainPage';
import LobbyPage from './pages/lobby/LobbyPage/LobbyPage.tsx';
import GamePage from './pages/game/GamePage/GamePage.tsx';
import { isTokenExpired } from './utils/authUtils';
import ToastContainer from './components/ToastContainer/ToastContainer';
import BackgroundMusic from './components/common/BackgroundMusic'; // [NEW]
import AudioController from './components/common/AudioController'; // [NEW]
import { useAudioStore } from './store/useAudioStore'; // [NEW]

export default function App() {
  const { nickname, roomId, setNickname } = useGameStore();
  const { setTrack } = useAudioStore(); // [NEW]
  const [isInitializing, setIsInitializing] = useState(true); // 초기화 상태 추가

  // 초기 BGM 설정
  useEffect(() => {
    setTrack('/assets/audio/bgm/bgm.mp3');
  }, []);

  // 세션 복구 로직
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedNickname = localStorage.getItem('nickname');

    // [변경] 토큰 만료 체크
    if (token && isTokenExpired(token)) {
      console.warn('[App] Token expired. Logging out.');
      useGameStore.getState().logout(); // 스토어의 로그아웃 액션 호출 (localStorage 정리)
    } else if (token && storedNickname && !nickname) {
      // console.log('[App] Session restored:', storedNickname);
      setNickname(storedNickname);
    }
    setIsInitializing(false);
  }, []); // 마운트 시 1회 실행

  // 초기화 중이면 아무것도 렌더링하지 않음 (또는 로딩 스피너)
  if (isInitializing) {
    return (
      <div className="app-container">
        <ToastContainer />
        <BackgroundMusic />
        <AudioController />
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#2d2d2d' }} />
      </div>
    );
  }

  // 1. 닉네임이 없으면 -> 메인 페이지 (로그인/회원가입 선택)
  if (!nickname) {
    return (
      <div className="app-container">
        <ToastContainer />
        <BackgroundMusic />
        <AudioController />
        <MainPage onLogin={(id) => setNickname(id)} />
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="app-container">
        <ToastContainer />
        <BackgroundMusic />
        <AudioController />
        <LobbyPage />
      </div>
    );
  }

  return (
    <div className="app-container">
      <ToastContainer />
      <BackgroundMusic />
      <AudioController />
      <GamePage />
    </div>
  );
}
