import { useState, useCallback } from 'react';
import styles from './FloatingButton.module.css';

interface FloatingButtonProps {
    onPress: () => void;
    onRelease: () => void;
    isActive?: boolean;
    disabled?: boolean;
}

/**
 * 플로팅 부스터 버튼
 * 
 * 게임 화면 우측 하단에 고정되는 원형 버튼.
 * 길게 누르면 부스터 모드 활성화 (긍정어 인식).
 */
export default function FloatingButton({
    onPress,
    onRelease,
    isActive = false,
    disabled = false,
}: FloatingButtonProps) {
    const [isPressed, setIsPressed] = useState(false);

    const handlePressStart = useCallback(() => {
        if (disabled) return;
        setIsPressed(true);
        onPress();
    }, [disabled, onPress]);

    const handlePressEnd = useCallback(() => {
        if (disabled) return;
        setIsPressed(false);
        onRelease();
    }, [disabled, onRelease]);

    return (
        <div className={styles.container}>
            <button
                className={`
                    ${styles.button}
                    ${isPressed ? styles.pressed : ''}
                    ${isActive ? styles.active : ''}
                    ${disabled ? styles.disabled : ''}
                `}
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                disabled={disabled}
            >
                <span className={styles.icon}>
                    {isActive ? '💖' : isPressed ? '🎤' : '💬'}
                </span>
                <span className={styles.label}>
                    {isActive ? '발동!' : isPressed ? '듣는 중...' : '꾹 누르기'}
                </span>
            </button>

            {/* 펄스 애니메이션 링 */}
            {isPressed && !isActive && (
                <>
                    <div className={styles.pulseRing} />
                    <div className={styles.pulseRing} style={{ animationDelay: '0.5s' }} />
                </>
            )}

            {/* 활성화 파티클 */}
            {isActive && (
                <div className={styles.particles}>
                    {[...Array(6)].map((_, i) => (
                        <span
                            key={i}
                            className={styles.particle}
                            style={{
                                '--angle': `${i * 60}deg`,
                                '--delay': `${i * 0.1}s`
                            } as React.CSSProperties}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
