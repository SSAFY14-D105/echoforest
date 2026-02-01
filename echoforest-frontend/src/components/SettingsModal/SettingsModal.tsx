import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { gameWebSocket } from '../../socket/GameWebSocket';
import { checkNickname, updateNickname } from '../../apis/authApi';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const { nickname, setNickname } = useGameStore();

    // 임시 상태
    const [tempNickname, setTempNickname] = useState(nickname);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [nicknameCheckStatus, setNicknameCheckStatus] = useState<'unchecked' | 'checking' | 'available' | 'duplicate'>('unchecked');

    // 닉네임 중복 확인 (debounce)
    useEffect(() => {
        // 현재 닉네임과 같으면 중복 체크 안 함 (변경 없음)
        if (tempNickname === nickname) {
            setNicknameCheckStatus('unchecked');
            return;
        }

        if (!tempNickname || tempNickname.length < 2) {
            setNicknameCheckStatus('unchecked');
            return;
        }

        setNicknameCheckStatus('checking');
        const timer = setTimeout(async () => {
            try {
                const res = await checkNickname(tempNickname);
                setNicknameCheckStatus(res.isDuplicate ? 'duplicate' : 'available');
            } catch {
                setNicknameCheckStatus('unchecked');
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [tempNickname, nickname]);

    const handleNicknameChange = async () => {
        const userId = Number(localStorage.getItem('userId'));
        if (!userId) {
            alert('인증 정보가 부족합니다. 다시 로그인해주세요.');
            return;
        }

        if (tempNickname.trim() && tempNickname.trim() !== nickname && nicknameCheckStatus === 'available') {
            setIsSaving(true);
            try {
                await updateNickname(userId, tempNickname.trim());
                setNickname(tempNickname.trim());
                localStorage.setItem('nickname', tempNickname.trim());
                setSaveMessage('✅ 저장됨!');
            } catch (error) {
                console.error('닉네임 변경 실패:', error);
                setSaveMessage('❌ 변경 실패');
            } finally {
                setTimeout(() => {
                    setIsSaving(false);
                    setSaveMessage('');
                }, 2000);
            }
        }
    };

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

    const handleMemoriesClick = () => {
        alert('추억 돌아보기 페이지는 준비 중입니다! 🌲');
    };

    return (
        <div className={styles.container}>
            {/* 배경 이미지 */}
            <img
                className={styles.bgImage}
                src="/assets/backgrounds/main_page.jpg"
                alt="메아리의 숲"
            />

            {/* 뒤로가기 버튼 */}
            <button className={styles.backButton} onClick={onClose}>
                ← 뒤로가기
            </button>

            {/* 메인 컨텐츠 (보드 스타일) */}
            <div className={styles.boardWrapper}>
                <div className={styles.boardContent}>

                    {/* 닉네임 변경 */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                            <span>닉네임 변경</span>
                        </div>
                        <div className={styles.nicknameColumn}>
                            <div className={styles.nicknameRow}>
                                <input
                                    type="text"
                                    value={tempNickname}
                                    onChange={(e) => setTempNickname(e.target.value)}
                                    placeholder="닉네임 입력"
                                    className={styles.nicknameInput}
                                    maxLength={12}
                                />
                                <button
                                    className={styles.confirmButton}
                                    onClick={handleNicknameChange}
                                    disabled={isSaving || !tempNickname.trim() || tempNickname === nickname || nicknameCheckStatus !== 'available'}
                                >
                                    {saveMessage || '확인'}
                                </button>
                            </div>

                            {/* 중복 확인 메시지 */}
                            {tempNickname !== nickname && tempNickname.length >= 2 && (
                                <p className={`${styles.checkStatus} ${nicknameCheckStatus === 'checking' ? styles.checking :
                                    nicknameCheckStatus === 'available' ? styles.available :
                                        nicknameCheckStatus === 'duplicate' ? styles.duplicate : ''
                                    }`}>
                                    {nicknameCheckStatus === 'checking' && '⏳ 확인 중...'}
                                    {nicknameCheckStatus === 'available' && '✅ 사용 가능한 닉네임입니다'}
                                    {nicknameCheckStatus === 'duplicate' && '❌ 이미 사용 중인 닉네임입니다'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 추억 돌아보기 */}
                    <div className={styles.section}>
                        <button className={styles.menuButton} onClick={handleMemoriesClick}>
                            <img className={styles.leafIcon} src="/assets/ui/leaf.png" alt="" />
                            추억 돌아보기
                        </button>
                    </div>

                    {/* 로그아웃 (추억 돌아보기와 동일한 스타일) */}
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
