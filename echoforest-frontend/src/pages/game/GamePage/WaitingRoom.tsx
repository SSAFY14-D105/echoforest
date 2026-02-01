/**
 * WaitingRoom - 대기실 화면
 */

import type { Player } from '../../../store/useGameStore';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import PhaserGame from '../../../phaser/PhaserGame';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import styles from './WaitingRoom.module.css';

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
    onSendState: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden?: boolean) => void;
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


    return (
        <div className={styles.waitingRoomContainer}>
            <PauseOverlay pausedBy={pausedBy} />

            {/* 상단 영역: 카메라 2개 + 정보 패널 + 카메라 2개 */}
            <div className={styles.topSection}>
                {/* 왼쪽 카메라 2개 */}
                <CameraArea startSlot={0} endSlot={2} />

                {/* 정보 패널 */}
                <div className={styles.infoPanel}>
                    <div className={styles.roomInfo}>
                        🎮 대기실 | Room: <span className={styles.roomId}>{roomId}</span>
                        <button className={styles.copyBtn} onClick={onCopyRoomId} title="방 코드 복사">📋</button>
                    </div>



                    {isHost ? (
                        <button
                            className={`${styles.actionBtn} ${(!isSoloMode && players.length > 1 && !allReady) ? '' : styles.readyActive}`}
                            onClick={onStartGame}
                            disabled={!isSoloMode && players.length > 1 && !allReady}
                        >
                            {!isSoloMode && players.length > 1 && !allReady ? '준비 대기중...' : '게임 시작'}
                        </button>
                    ) : (
                        <button
                            className={`${styles.actionBtn} ${myReady ? styles.readyActive : ''}`}
                            onClick={onToggleReady}
                        >
                            {myReady ? '준비 완료!' : '준비'}
                        </button>
                    )}

                    {!isSoloMode && players.length > 1 && (
                        <div className={styles.readyStatus}>
                            Ready: {readyPlayers.length}/{players.filter(p => !p.isHost).length}
                            {allReady && <span className={styles.allReadyText}>✓ 전원 준비완료!</span>}
                        </div>
                    )}
                </div>

                {/* 오른쪽 카메라 2개 */}
                <CameraArea startSlot={2} endSlot={4} />
            </div>

            {/* 하단 게임 영역 */}
            <div className={styles.gameSection}>
                <PhaserGame
                    startScene="LobbyScene"
                    onSendState={onSendState}
                    isSoloMode={isSoloMode}
                />
            </div>
        </div>
    );
}
