
import styles from './GameStatisticsView.module.css';
import { PlayerGameStats } from '../../../apis/imageApi';

interface GameStatisticsViewProps {
    stats: PlayerGameStats[];
    onReturnToLobby: () => void;
}

export default function GameStatisticsView({ stats, onReturnToLobby }: GameStatisticsViewProps) {
    // 랭킹 계산 (Optional)
    const maxKiss = Math.max(...stats.map(s => s.kissCount), 0);
    const maxCurse = Math.max(...stats.map(s => s.curseCount), 0);

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <h2 className={styles.title}>📊 오늘의 모험 통계 📊</h2>
                <p className={styles.subtitle}>누가 가장 아름다운 말을 했을까요?</p>

                <div className={styles.statsGrid}>
                    <div className={styles.headerRow}>
                        <div className={styles.colName}>플레이어</div>
                        <div className={styles.colStat}>😘 칭찬</div>
                        <div className={styles.colStat}>🤬 저주</div>
                    </div>
                    {stats.length === 0 ? (
                        <div className={styles.empty}>통계 데이터가 없습니다.</div>
                    ) : (
                        stats.map((player) => (
                            <div key={player.username} className={styles.row}>
                                <div className={styles.colName}>
                                    <span className={styles.name}>{player.username}</span>
                                    {player.kissCount === maxKiss && player.kissCount > 0 && (
                                        <span className={styles.badge} title="칭찬왕">👑</span>
                                    )}
                                    {player.curseCount === maxCurse && player.curseCount > 0 && (
                                        <span className={styles.badge} title="저주왕">😈</span>
                                    )}
                                </div>
                                <div className={`${styles.colStat} ${styles.positive}`}>
                                    {player.kissCount}회
                                </div>
                                <div className={`${styles.colStat} ${styles.negative}`}>
                                    {player.curseCount}회
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <button className={styles.lobbyBtn} onClick={onReturnToLobby}>
                    🏠 로비로 돌아가기
                </button>
            </div>
        </div>
    );
}
