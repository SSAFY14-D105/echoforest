import { useGameStore } from './store/useGameStore';
import LoginPage from './pages/LoginPage/LoginPage';
import LobbyPage from './pages/lobby/LobbyPage';
import GamePage from './pages/game/GamePage';

export default function App() {
  // 전역 상태(Store)에서 nickname, roomId 가져오기
  const { nickname, roomId, setNickname } = useGameStore();

  // ========== 🚧 임시 개발 모드: 로비 페이지로 바로 진입 ==========
  // TODO: 백엔드 연동 후 아래 코드를 주석 처리하거나 삭제하세요!
  // if (!nickname) {
  //   setNickname('DevUser'); // 임시 닉네임 설정
  // }
  // ============================================================

  // 1. 닉네임이 없으면 -> 로그인 페이지
  if (!nickname) {
    return <LoginPage onLogin={(id) => setNickname(id)} />;
  }

  // 2. 닉네임은 있지만 방 번호가 없으면 -> 로비 화면
  if (!roomId) {
    return <LobbyPage />;
  }

  // 3. 방 번호가 있으면 -> 게임 화면
  return <GamePage />;
}