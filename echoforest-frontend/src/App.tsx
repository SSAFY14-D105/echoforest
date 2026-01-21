import LiveKitTestPage from './pages/LiveKitTestPage';

// ========== 🚧 임시: LiveKit 테스트 모드 ==========
// TODO: 테스트 완료 후 원래 코드로 복원하세요!
export default function App() {
  return <LiveKitTestPage />;
}

/* ========== 원래 코드 (복원용) ==========
import { useGameStore } from './store/useGameStore';
import LoginPage from './pages/LoginPage/LoginPage';
import LobbyPage from './pages/lobby/LobbyPage';
import GamePage from './pages/game/GamePage';

export default function App() {
  const { nickname, roomId, setNickname } = useGameStore();

  if (!nickname) {
    return <LoginPage onLogin={(id) => setNickname(id)} />;
  }

  if (!roomId) {
    return <LobbyPage />;
  }

  return <GamePage />;
}
========================================== */