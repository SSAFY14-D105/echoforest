import { useNavigate } from 'react-router-dom';
import AudioController from '../../../components/common/AudioController';
import styles from './MainPage.module.css';

export default function MainPage() {
    const navigate = useNavigate();

    // 메인 랜딩 페이지
    return (
        <div className={styles.container}>
            <AudioController />
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
                        onClick={() => navigate('/login')}
                    >
                        <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                        로그인
                    </button>
                    <button
                        className={styles.menuButton}
                        onClick={() => navigate('/signup')}
                    >
                        <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                        회원가입
                    </button>
                </div>
            </div>
        </div>
    );
}
