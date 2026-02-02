import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

interface SplashScreenProps {
    onFinished: () => void;
}

export default function SplashScreen({ onFinished }: SplashScreenProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        // 1. 최소 노출 시간 (너무 빨리 사라지면 깜빡임처럼 보임)
        const minTimePromise = new Promise(resolve => setTimeout(resolve, 2000));

        // 2. 무거운 배경 이미지 프리로딩
        const imagePromise = new Promise((resolve) => {
            const img = new Image();
            img.src = '/assets/backgrounds/main_page.jpg';
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true); // 에러나도 진행은 해야함
        });

        // 두 가지 조건(시간 + 로딩)이 모두 충족되면 종료
        Promise.all([minTimePromise, imagePromise]).then(() => {
            setIsFadingOut(true);
            // 페이드 아웃 애니메이션 시간(0.5s) 후 완전히 제거
            setTimeout(() => {
                setIsVisible(false);
                onFinished();
            }, 500);
        });
    }, [onFinished]);

    if (!isVisible) return null;

    return (
        <div className={`${styles.container} ${isFadingOut ? styles.fadeOut : ''}`}>
            <img
                src="/assets/ui/leaf.png"
                alt="안개 너머 숨겨진 메아리의 숲을 찾아 헤매는 중..."
                className={styles.leafLoader}
            />
            <div className={styles.loadingText}>안개 너머 숨겨진 메아리의 숲을 찾아 헤매는 중...</div>
        </div>
    );
}
