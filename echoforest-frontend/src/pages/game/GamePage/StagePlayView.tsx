/**
 * StagePlayView - 멀티플레이 스테이지 플레이 화면
 */

import PhaserGame from '../../../phaser/PhaserGame';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import FloatingButton from '../../../components/stt/FloatingButton';
import CurseStackBar from '../../../components/stt/CurseStackBar';
import styles from './GamePage.module.css';

interface StagePlayViewProps {
    roomId: string;
    currentStage: string;
    pausedBy: string | null;
    isSoloMode: boolean;
    curseState: {
        stack: number;
        cursedPlayer: string | null;
    };
    isListening: boolean;
    boosterActive: boolean;
    setBoosterMode: (active: boolean) => void;
    onSendState: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[]) => void;
    onCopyRoomId: () => void;
    onClearStage: (stageId: string) => void;
}

export default function StagePlayView({
    roomId,
    currentStage,
    pausedBy,
    isSoloMode,
    curseState,
    isListening,
    boosterActive,
    setBoosterMode,
    onSendState,
    onCopyRoomId,
    onClearStage,
}: StagePlayViewProps) {
    const stageNum = currentStage.replace('MULTI_', '');

    return (
        <div className={styles.gameContainer}>
            <PauseOverlay pausedBy={pausedBy} />
            <div className={`pixel-box ${styles.canvasWrapper}`}>
                <PhaserGame
                    startScene={`Stage${stageNum}Scene`}
                    onSendState={onSendState}
                    isSoloMode={isSoloMode}
                />
                <div className={styles.gameInfo}>
                    🎮 Stage {stageNum} 진행 중 | Room: <span className={styles.roomId}>{roomId}</span>
                    <button className={styles.copyBtn} onClick={onCopyRoomId} title="방 코드 복사">📋</button>
                </div>
                <button
                    className={styles.testClearBtn}
                    onClick={() => onClearStage(currentStage)}
                >
                    🏆 테스트: 스테이지 클리어
                </button>
                <CurseStackBar
                    stack={curseState.stack}
                    cursedPlayer={curseState.cursedPlayer}
                    isListening={isListening}
                />
            </div>
            <CameraArea />
            <FloatingButton
                onPress={() => setBoosterMode(true)}
                onRelease={() => setTimeout(() => setBoosterMode(false), 500)}
                isActive={boosterActive}
            />
        </div>
    );
}
