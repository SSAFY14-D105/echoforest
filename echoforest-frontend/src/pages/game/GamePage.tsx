import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import PhaserGame from '../../game/PhaserGame';
import styles from './GamePage.module.css';

// 플레이어별 색상 테마
const PLAYER_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

export default function GamePage() {
  const { nickname, roomId, isHost } = useGameStore();

  const [micVolume, setMicVolume] = useState(70);
  const [cameraOn, setCameraOn] = useState(true);
  const [playerVolumes, setPlayerVolumes] = useState([70, 70, 70]); // P2, P3, P4
  const [showVolumeSlider, setShowVolumeSlider] = useState<number | null>(null);

  const handlePlayerVolumeChange = (playerIndex: number, volume: number) => {
    const newVolumes = [...playerVolumes];
    newVolumes[playerIndex] = volume;
    setPlayerVolumes(newVolumes);
  };

  return (
    <div className={styles.gameContainer}>
      {/* 게임 캔버스 */}
      <div className={`pixel-box ${styles.canvasWrapper}`}>
        <PhaserGame />
        <div className={styles.gameInfo}>
          Room: <span className={styles.roomId}>{roomId}</span> | {nickname} {isHost ? '👑' : ''}
        </div>
      </div>

      {/* 카메라 영역 */}
      <div className={styles.cameraArea}>
        {/* P1 - 본인 */}
        <div
          className={`pixel-box ${styles.cameraBox} ${styles.active}`}
          style={{ borderColor: PLAYER_COLORS[0] }}
        >
          <div className={cameraOn ? styles.cameraContent : styles.cameraOff}>
            {cameraOn ? `P1 (나: ${nickname})` : '📹'}
          </div>

          {/* 컨트롤 버튼 */}
          <div className={styles.controls}>
            {/* 마이크 버튼 */}
            <div className={styles.controlBtn}>
              <button
                className={styles.btn}
                onClick={() => setShowVolumeSlider(showVolumeSlider === 0 ? null : 0)}
              >
                <div className={styles.micIcon}></div>
              </button>
              {showVolumeSlider === 0 && (
                <div
                  className={styles.volumeSliderContainer}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={micVolume}
                    onChange={(e) => setMicVolume(Number(e.target.value))}
                    className={styles.verticalSlider}
                  />
                  <span className={styles.volumeText}>{micVolume}%</span>
                </div>
              )}
            </div>

            {/* 카메라 버튼 */}
            <button
              className={styles.btn}
              onClick={() => setCameraOn(!cameraOn)}
            >
              <div className={cameraOn ? styles.cameraIcon : styles.cameraOffIcon}></div>
            </button>
          </div>
        </div>

        {/* P2, P3, P4 - 타인 */}
        {[2, 3, 4].map((num, index) => (
          <div
            key={num}
            className={`pixel-box ${styles.cameraBox} ${styles.waiting}`}
            style={{ borderColor: PLAYER_COLORS[num - 1] }}
          >
            P{num} (대기중...)

            {/* 스피커 버튼 */}
            <div className={styles.controls}>
              <div className={styles.controlBtn}>
                <button
                  className={styles.btn}
                  onClick={() => setShowVolumeSlider(showVolumeSlider === num ? null : num)}
                >
                  <div className={styles.speakerIcon}></div>
                </button>
                {showVolumeSlider === num && (
                  <div
                    className={styles.volumeSliderContainer}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={playerVolumes[index]}
                      onChange={(e) => handlePlayerVolumeChange(index, Number(e.target.value))}
                      className={styles.verticalSlider}
                    />
                    <span className={styles.volumeText}>{playerVolumes[index]}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}