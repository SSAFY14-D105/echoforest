import { useEffect, useState } from 'react';
import { useGameStore } from './features/game/store/useGameStore';
import LoginPage from './features/auth/pages/LoginPage/LoginPage';
import LobbyPage from './features/lobby/pages/LobbyPage';
import GamePage from './features/game/pages/GamePage';

export default function App() {
  const { nickname, roomId, setNickname } = useGameStore();
  const [isInitializing, setIsInitializing] = useState(true); // 초기화 상태 추가

  // 세션 복구 로직
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedNickname = localStorage.getItem('nickname');

    if (token && storedNickname && !nickname) {
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