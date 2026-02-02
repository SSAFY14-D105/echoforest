import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useGameStore } from './store/useGameStore';
import MainPage from './pages/auth/MainPage/MainPage';
import LoginPage from './pages/auth/LoginPage/LoginPage';
import SignupPage from './pages/auth/SignupPage/SignupPage';
import PermissionCheckPage from './pages/auth/PermissionCheckPage/PermissionCheckPage'; // [NEW]
import LobbyPage from './pages/lobby/LobbyPage/LobbyPage.tsx';
import GamePage from './pages/game/GamePage/GamePage.tsx';
import { isTokenExpired } from './utils/authUtils';
import ToastContainer from './components/ToastContainer/ToastContainer';
import BackgroundMusic from './components/common/BackgroundMusic';
import AudioController from './components/common/AudioController';
import { useAudioStore } from './store/useAudioStore';

export default function App() {
  const { nickname, roomId, setNickname } = useGameStore();
  const { setTrack } = useAudioStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // Navigate hook for programmatic navigation if needed (though mostly declarative redirects here)
  const navigate = useNavigate();

  // 초기 BGM 설정
  useEffect(() => {
    setTrack('/assets/audio/bgm/bgm.mp3');
  }, []);

  // 세션 복구 로직
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedNickname = localStorage.getItem('nickname');

    if (token && isTokenExpired(token)) {
      console.warn('[App] Token expired. Logging out.');
      useGameStore.getState().logout();
    } else if (token && storedNickname && !nickname) {
      setNickname(storedNickname);
    }
    setIsInitializing(false);
  }, []);

  // [NEW] 실시간 권한 변경 감지 (브라우저 설정에서 권한 해제 시 즉시 대응)
  useEffect(() => {
    if (!nickname) return;

    const checkAndMonitor = async () => {
      try {
        // @ts-ignore - 'camera' and 'microphone' are valid in Chrome/Edge but TS checking can be strict
        const camQuery = await navigator.permissions.query({ name: 'camera' });
        // @ts-ignore
        const micQuery = await navigator.permissions.query({ name: 'microphone' });

        const handleStatusChange = () => {
          const camState = camQuery.state;
          const micState = micQuery.state;
          console.log(`[App] Permission changed - Camera: ${camState}, Mic: ${micState}`);

          // 둘 중 하나라도 허용되지 않으면 권한 박탈
          if (camState !== 'granted' || micState !== 'granted') {
            useGameStore.getState().setHasMediaPermission(false);
            // 라우팅은 App 렌더링 시 state 변경에 의해 자동으로 리다이렉트됨
          }
        };

        camQuery.onchange = handleStatusChange;
        micQuery.onchange = handleStatusChange;
      } catch (e) {
        console.warn('[App] Permission API error:', e);
      }
    };

    checkAndMonitor();
  }, [nickname]);

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

  return (
    <div className="app-container">
      <ToastContainer />
      <BackgroundMusic />
      <AudioController />

      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={
          nickname ? <Navigate to="/lobby" replace /> : <MainPage />
        } />
        <Route path="/login" element={
          nickname ? <Navigate to="/lobby" replace /> : (
            <LoginPage
              onLoginSuccess={(id) => setNickname(id)}
              onBack={() => navigate('/')}
            />
          )
        } />
        <Route path="/signup" element={
          nickname ? <Navigate to="/lobby" replace /> : (
            <SignupPage
              onSignupSuccess={() => navigate('/login')}
              onBack={() => navigate('/')}
            />
          )
        } />

        <Route path="/permission" element={
          !nickname ? <Navigate to="/" replace /> : <PermissionCheckPage />
        } />

        {/* Protected Routes */}
        <Route path="/lobby" element={
          !nickname ? <Navigate to="/" replace /> : (
            !useGameStore.getState().hasMediaPermission ? <Navigate to="/permission" replace /> : <LobbyPage />
          )
        } />
        <Route path="/game" element={
          !nickname ? <Navigate to="/" replace /> : (
            !roomId ? <Navigate to="/lobby" replace /> : (
              !useGameStore.getState().hasMediaPermission ? <Navigate to="/permission" replace /> : <GamePage />
            )
          )
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
