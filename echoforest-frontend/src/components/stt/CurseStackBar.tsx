// 스택 표시 UI
import styles from './CurseStackBar.module.css';

interface CurseStackBarProps {
    stack: number;           // 0~10
    maxStack?: number;
    cursedPlayers?: string[];  // [변경] 다중 저주 지원
    isListening?: boolean;
}

/**
 * 저주 스택 바
 * 
 * 게임 화면 상단에 표시되는 저주 스택 UI.
 * 스택에 따라 색상이 변화합니다.
 */
export default function CurseStackBar({
    stack,
    maxStack = 10,
    cursedPlayers = [],
    isListening = false,
}: CurseStackBarProps) {
    const percentage = Math.min((stack / maxStack) * 100, 100);

    // 색상 결정 (스택 레벨에 따라)
    const getColor = () => {
        if (stack >= 8) return '#ff4444';  // 빨강 (위험)
        if (stack >= 5) return '#ffaa00';  // 주황 (경고)
        return '#667eea';                   // 파랑 (안전)
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.icon}>🔮</span>
                <span className={styles.label}>저주 스택</span>
                <span className={styles.value}>{stack}/{maxStack}</span>
                {isListening && (
                    <span className={styles.listeningBadge}>
                        🎤 듣는 중
                    </span>
                )}
            </div>

            <div className={styles.barContainer}>
                <div
                    className={styles.barFill}
                    style={{
                        width: `${percentage}%`,
                        backgroundColor: getColor(),
                    }}
                />
                {/* 스택 마커 */}
                {[...Array(maxStack)].map((_, i) => (
                    <div
                        key={i}
                        className={styles.marker}
                        style={{ left: `${((i + 1) / maxStack) * 100}%` }}
                    />
                ))}
            </div>

            {/* 저주 상태 표시 (다중 저주 지원) */}
            {cursedPlayers.length > 0 && (
                <div className={styles.cursedAlert}>
                    💀 {cursedPlayers.join(', ')}님 저주 중!
                </div>
            )}

            {/* 위험 경고 */}
            {stack >= 8 && cursedPlayers.length === 0 && (
                <div className={styles.dangerAlert}>
                    ⚠️ 저주 발동 임박!
                </div>
            )}
        </div>
    );
}
