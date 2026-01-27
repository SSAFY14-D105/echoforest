/**
 * WaitingRoom - 대기실 화면
 */

import type { Player } from '../../../store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import PhaserGame from '../../../phaser/PhaserGame';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import styles from './GamePage.module.css';

const MAX_PLAYERS = 4;

interface WaitingRoomProps {
    roomId: string;
    players: Player[];
    readyPlayers: string[];
    isHost: boolean;
    isSoloMode: boolean;
    pausedBy: string | null;
    myReady: boolean;
    allReady: boolean;
    onSendState: (x: number, y: number, vx: number, vy: number, anim: string) => void;
    onCopyRoomId: () => void;
    onLeave: () => void;
    onToggleReady: () => void;
    onStartGame: () => void;
    onAddTestPlayer: () => void;
}

export default function WaitingRoom({
    roomId,
    players,
    readyPlayers,
    isHost,
    isSoloMode,
    pausedBy,
    myReady,
    allReady,
    onSendState,
    onCopyRoomId,
    onLeave,
    onToggleReady,
    onStartGame,
    onAddTestPlayer,
}: WaitingRoomProps) {
    const handleLeaveClick = () => {
        if (window.confirm('정말 대기방을 나가시겠습니까?')) {
            if (roomId && gameWebSocket.isConnected()) {
                gameWebSocket.sendLeave(roomId);
                gameWebSocket.disconnect();
            }
            onLeave();
        }
    };

    return (
        <div className={styles.gameContainer}>
            <PauseOverlay pausedBy={pausedBy} />
            <div className={`pixel-box ${styles.canvasWrapper}`}>
                <PhaserGame
                    startScene="LobbyScene"
                    onSendState={onSendState}
                    isSoloMode={isSoloMode}
                />
                <div className={styles.gameInfo}>
                    🎮 대기실 | Room: <span className={styles.roomId}>{roomId}</span>
                    <button className={styles.copyBtn} onClick={onCopyRoomId} title="방 코드 복사">📋</button>
                    | 👥 {players.length}/{MAX_PLAYERS}
                </div>
                <button className={styles.backToLobbyBtn} onClick={handleLeaveClick}>
                    ← 나가기
                </button>
            </div>

            <CameraArea />

            <div className={styles.bottomActions}>
                <button
                    className={styles.testBtn}
                    onClick={onAddTestPlayer}
                    disabled={players.length >= MAX_PLAYERS}
                >
                    🧪 테스트: 플레이어 추가 ({players.length}/{MAX_PLAYERS})
                </button>

                {!isSoloMode && !isHost && (
                    <button
                        className={`${styles.readyBtn} ${myReady ? styles.readyActive : ''}`}
                        onClick={onToggleReady}
                    >
                        {myReady ? '✅ Ready!' : '⏳ Ready'}
                    </button>
                )}

                {!isSoloMode && players.length > 1 && (
                    <div className={styles.readyStatus}>
                        Ready: {readyPlayers.length}/{players.filter(p => !p.isHost).length}
                        {allReady && <span style={{ marginLeft: 8, color: '#4CAF50' }}>✓ 전원 준비완료!</span>}
                    </div>
                )}

                {isHost && (
                    <button
                        className={styles.startGameBtn}
                        onClick={onStartGame}
                        disabled={!isSoloMode && players.length > 1 && !allReady}
                    >
                        🚀 게임 시작!
                    </button>
                )}

                {players.length < 2 && !isSoloMode && (
                    <span className={styles.waitingMessage}>
                        다른 플레이어를 기다리는 중...
                    </span>
                )}

                {!isHost && players.length >= 2 && (
                    <span className={styles.waitingMessage}>
                        호스트가 게임을 시작하길 기다리는 중...
                    </span>
                )}
            </div>
        </div>
    );
}
