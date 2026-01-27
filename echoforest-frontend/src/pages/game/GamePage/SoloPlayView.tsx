/**
 * SoloPlayView - 솔로 모드 플레이 화면
 */

import PhaserGame from '../../../phaser/PhaserGame';
import FloatingButton from '../../../components/stt/FloatingButton';
import CurseStackBar from '../../../components/stt/CurseStackBar';
import styles from './GamePage.module.css';

interface SoloPlayViewProps {
    nickname: string;
    currentStage: string;
    curseState: {
        stack: number;
        cursedPlayer: string | null;
    };
    isListening: boolean;
    boosterActive: boolean;
    setBoosterMode: (active: boolean) => void;
    onLeave: () => void;
}

export default function SoloPlayView({
    nickname,
    currentStage,
    curseState,
    isListening,
    boosterActive,
    setBoosterMode,
    onLeave,
}: SoloPlayViewProps) {
    const sceneKey = currentStage.replace('SOLO_', 'Solo') + 'Scene';
    const stageNum = currentStage.replace('SOLO_', '');

    return (
        <div className={styles.gameContainer}>
            <div className={`pixel-box ${styles.canvasWrapper}`} style={{ marginBottom: 0, flex: 1 }}>
                <PhaserGame startScene={sceneKey} />
                <div className={styles.gameInfo}>
                    🧪 혼자하기 {stageNum} 모드 | {nickname}
                </div>
                <button className={styles.backToLobbyBtn} onClick={onLeave}>
                    ← 로비로 돌아가기
                </button>
                <CurseStackBar
                    stack={curseState.stack}
                    cursedPlayer={curseState.cursedPlayer}
                    isListening={isListening}
                />
            </div>
            <FloatingButton
                onPress={() => setBoosterMode(true)}
                onRelease={() => setTimeout(() => setBoosterMode(false), 500)}
                isActive={boosterActive}
            />
        </div>
    );
}
