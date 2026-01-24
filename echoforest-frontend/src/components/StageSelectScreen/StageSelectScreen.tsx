import styles from './StageSelectScreen.module.css';

interface StageSelectScreenProps {
    roomId: string;
    clearedStages: string[];
    isHost: boolean;
    onSelectStage: (stageNum: number) => void;
    onClearStage: (stageId: string) => void;
}

const TOTAL_STAGES = 3;

export default function StageSelectScreen({
    roomId,
    clearedStages,
    isHost,
    onSelectStage,
    onClearStage
}: StageSelectScreenProps) {

    const isStageUnlocked = (stageNum: number): boolean => {
        if (stageNum === 1) return true;
        return clearedStages.includes(`MULTI_${stageNum - 1}`);
    };

    return (
        <div className={styles.stageSelectArea}>
            <div className={styles.stageSelectHeader}>
                <h2>🗺️ 스테이지 선택</h2>
                <p>Room: <span className={styles.roomId}>{roomId}</span></p>
            </div>

            <div className={styles.stageGrid}>
                {Array.from({ length: TOTAL_STAGES }).map((_, index) => {
                    const stageNum = index + 1;
                    const isUnlocked = isStageUnlocked(stageNum);
                    const isCleared = clearedStages.includes(`MULTI_${stageNum}`);

                    return (
                        <button
                            key={stageNum}
                            className={`${styles.stageCard} ${isUnlocked ? styles.unlocked : styles.locked} ${isCleared ? styles.cleared : ''}`}
                            onClick={() => onSelectStage(stageNum)}
                            disabled={!isUnlocked || !isHost}
                        >
                            <div className={styles.stageIcon}>
                                {isUnlocked ? (isCleared ? '⭐' : `${stageNum}`) : '🔒'}
                            </div>
                            <div className={styles.stageLabel}>Stage {stageNum}</div>
                            <div className={styles.stageStatus}>
                                {isCleared ? '클리어!' : isUnlocked ? (isHost ? '도전 가능' : '호스트 대기') : '잠김'}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Test Buttons - Host Only */}
            {isHost && (
                <div className={styles.testButtons}>
                    <button
                        className={styles.testBtn}
                        onClick={() => onClearStage('MULTI_1')}
                        disabled={clearedStages.includes('MULTI_1')}
                    >
                        🧪 Stage 1 클리어 처리
                    </button>
                    <button
                        className={styles.testBtn}
                        onClick={() => onClearStage('MULTI_2')}
                        disabled={!clearedStages.includes('MULTI_1') || clearedStages.includes('MULTI_2')}
                    >
                        🧪 Stage 2 클리어 처리
                    </button>
                </div>
            )}
        </div>
    );
}
