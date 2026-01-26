import styles from './PauseOverlay.module.css';

interface PauseOverlayProps {
    pausedBy: string | null; // 일시정지 유발자 닉네임
}

export default function PauseOverlay({ pausedBy }: PauseOverlayProps) {
    if (!pausedBy) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.icon}>⏸️</div>
                <h2>게임 일시정지</h2>
                <p>
                    <span className={styles.username}>{pausedBy}</span>님이<br />
                    잠시 자리를 비웠습니다.
                </p>
                <div className={styles.spinner}></div>
                <p className={styles.subText}>플레이어가 돌아오면 자동으로 재개됩니다.</p>
            </div>
        </div>
    );
}
