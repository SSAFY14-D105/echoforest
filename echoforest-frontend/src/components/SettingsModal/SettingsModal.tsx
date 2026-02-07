import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { gameWebSocket } from '../../socket/GameWebSocket';
import MemoriesModal from '../MemoriesModal/MemoriesModal';
import MyInfoModal from '../MyInfoModal/MyInfoModal';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const { setNickname } = useGameStore();

    const [showMemories, setShowMemories] = useState(false);
    const [showMyInfo, setShowMyInfo] = useState(false);

    const handleLogout = () => {
        if (window.confirm('정말 로그아웃 하시겠습니까?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('loginId');
            localStorage.removeItem('nickname');
            setNickname('');
            gameWebSocket.disconnect();
            onClose();
        }
    };

    if (showMemories) {
        return <MemoriesModal onClose={() => setShowMemories(false)} />;
    }

    if (showMyInfo) {
        return <MyInfoModal onClose={() => setShowMyInfo(false)} />;
    }

    return (
        <div className={styles.container}>
            {/* 배경 이미지 */}
            <img
                className={styles.bgImage}
                src="/assets/backgrounds/main_page.png"
                alt="메아리의 숲"
            />

            {/* 뒤로가기 버튼 */}
            <button className={styles.backButton} onClick={onClose}>
                ← 뒤로가기
            </button>

            {/* 메인 컨텐츠 (보드 스타일) */}
            <div className={styles.boardWrapper}>
                <div className={styles.boardContent}>

                    {/* 내 정보 */}
                    <div className={styles.section}>
                        <button className={styles.menuButton} onClick={() => setShowMyInfo(true)}>
                            <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                            내 정보
                        </button>
                    </div>

                    {/* 추억 돌아보기 */}
                    <div className={styles.section}>
                        <button className={styles.menuButton} onClick={() => setShowMemories(true)}>
                            <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                            추억 돌아보기
                        </button>
                    </div>

                    {/* 로그아웃 */}
                    <div className={styles.section}>
                        <button className={styles.menuButton} onClick={handleLogout}>
                            <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                            로그아웃
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
