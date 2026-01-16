import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore'; // Store
import { GameEngine } from '../../utils/game/GameEngine'; // 경로 변경됨!

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Store에서 데이터 가져오기
  const { nickname, roomId, isHost } = useGameStore();

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasRef.current);
      engineRef.current.start();
    }
    const resize = () => engineRef.current?.resize();
    window.addEventListener('resize', resize);
    setTimeout(resize, 100);
    return () => {
      engineRef.current?.stop();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', padding: '10px', background: '#e0e6ed' }}>

      {/* 상단: 게임 캔버스 */}
      <div className="pixel-box" style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '12px', marginBottom: '10px' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', top: 15, left: 15, padding: '8px 15px', background: 'rgba(255,255,255,0.9)', borderRadius: '8px', fontWeight: 'bold' }}>
          Room: <span style={{ color: '#e74c3c' }}>{roomId}</span> | {nickname} {isHost ? '👑' : ''}
        </div>
      </div>

      {/* 하단: 캠 송출 화면 */}
      <div style={{ height: '150px', display: 'flex', gap: '10px' }}>
        <div className="pixel-box" style={{ flex: 1, borderRadius: '12px', background: '#eee', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '3px solid var(--frog-green)' }}>
          P1 (나: {nickname})
        </div>
        {[2, 3, 4].map(num => (
          <div key={num} className="pixel-box" style={{ flex: 1, borderRadius: '12px', background: '#ddd', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.6 }}>
            P{num} (대기중...)
          </div>
        ))}
      </div>
    </div>
  );
}