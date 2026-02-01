import { useState } from 'react';
import styles from './MainPage.module.css';
import LoginPage from '../LoginPage/LoginPage';
import SignupPage from '../SignupPage/SignupPage';

type AuthMode = 'main' | 'login' | 'signup';

interface Props {
    onLogin: (nickname: string) => void;
}

export default function MainPage({ onLogin }: Props) {
    const [mode, setMode] = useState<AuthMode>('main');

    if (mode === 'login') {
        return (
            <LoginPage
                onLoginSuccess={onLogin}
                onBack={() => setMode('main')}
            />
        );
    }

    if (mode === 'signup') {
        return (
            <SignupPage
                onSignupSuccess={() => setMode('login')}
                onBack={() => setMode('main')}
            />
        );
    }

    // 메인 랜딩 페이지
    return (
        <div className={styles.container}>
            {/* 배경 이미지 */}
            <img
                className={styles.bgImage}
                src="/assets/backgrounds/main_page.png"
                alt="메아리의 숲"
            />

            {/* 타이틀 래퍼 (절대 위치 고정) */}
            <div className={styles.titleWrapper}>
                <h1 className={styles.mainTitle}>메아리의 숲</h1>
                <h2 className={styles.subTitle}>Echo Forest</h2>
            </div>

            {/* 로그인/회원가입 메뉴 (배경의 검은 부분 중앙) */}
            <div className={styles.menuWrapper}>
                <div className={styles.menuItems}>
                    <button
                        className={styles.menuButton}
                        onClick={() => setMode('login')}
                    >
                        <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                        로그인
                    </button>
                    <button
                        className={styles.menuButton}
                        onClick={() => setMode('signup')}
                    >
                        <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                        회원가입
                    </button>
                </div>
            </div>
        </div>
    );
}
