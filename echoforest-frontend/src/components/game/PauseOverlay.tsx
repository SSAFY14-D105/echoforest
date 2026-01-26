import styles from './PauseOverlay.module.css';

interface PauseOverlayProps {
    pausedBy: string | null;
}

export default function PauseOverlay({ pausedBy }: PauseOverlayProps) {
    if (!pausedBy) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.messageBox}>
                <h2>⏸️ 게임 일시정지</h2>
                <p><strong>{pausedBy}</strong>님이 게임 화면을 벗어났습니다.</p>
                <p className={styles.subtext}>모든 플레이어가 복귀하면 자동으로 재개됩니다.</p>
            </div>
        </div>
    );
}
