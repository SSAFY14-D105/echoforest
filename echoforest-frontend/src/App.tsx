import { useEffect, useState } from 'react';
import { useGameStore } from './store/useGameStore';
import LoginPage from './pages/auth/LoginPage/LoginPage';
import LobbyPage from './pages/lobby/LobbyPage/LobbyPage.tsx';
import GamePage from './pages/game/GamePage/GamePage.tsx';
import { isTokenExpired } from './utils/authUtils';

export default function App() {
  const { nickname, roomId, setNickname } = useGameStore();
  const [isInitializing, setIsInitializing] = useState(true); // 초기화 상태 추가

  // 세션 복구 로직
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedNickname = localStorage.getItem('nickname');

    // [변경] 토큰 만료 체크
    if (token && isTokenExpired(token)) {
      console.warn('[App] Token expired. Logging out.');
      useGameStore.getState().logout(); // 스토어의 로그아웃 액션 호출 (localStorage 정리)
    } else if (token && storedNickname && !nickname) {
      console.log('[App] Session restored:', storedNickname);
      setNickname(storedNickname);
    }
    setIsInitializing(false);
  }, []); // 마운트 시 1회 실행

  // 초기화 중이면 아무것도 렌더링하지 않음 (또는 로딩 스피너)
  if (isInitializing) {
    return <div style={{ width: '100vw', height: '100vh', backgroundColor: '#2d2d2d' }} />;
  }

  // 1. 닉네임이 없으면 -> 로그인 페이지
  if (!nickname) {
    return <LoginPage onLogin={(id) => setNickname(id)} />;
  }

  if (!roomId) {
    return <LobbyPage />;
  }

  return <GamePage />;
}