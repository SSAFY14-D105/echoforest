import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { checkNickname, updateNickname, getMyInfo, MyInfoResponse } from '../../apis/authApi';
import styles from './MyInfoModal.module.css';

interface MyInfoModalProps {
    onClose: () => void;
}

export default function MyInfoModal({ onClose }: MyInfoModalProps) {
    const { nickname, setNickname } = useGameStore();
    const [myInfo, setMyInfo] = useState<MyInfoResponse | null>(null);
    const [tempNickname, setTempNickname] = useState(nickname);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [showEditPopup, setShowEditPopup] = useState(false);
    const [nicknameCheckStatus, setNicknameCheckStatus] = useState<'unchecked' | 'checking' | 'available' | 'duplicate'>('unchecked');

    // 마운트 시 내 정보 불러오기
    useEffect(() => {
        loadMyInfo();
    }, []);

    // 닉네임 중복 확인 (debounce)
    useEffect(() => {
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

    const loadMyInfo = async () => {
        try {
            const data = await getMyInfo();
            setMyInfo(data);
            setTempNickname(data.nickname);
        } catch (e) {
            console.error(e);
            alert('정보를 불러오는데 실패했습니다.');
            onClose();
        }
    };

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
                setSaveMessage('변경 완료!');
                loadMyInfo(); // 정보 갱신
                setTimeout(() => {
                    setShowEditPopup(false); // 팝업 닫기
                }, 1000);
            } catch (error) {
                console.error('닉네임 변경 실패:', error);
                setSaveMessage('변경 실패');
            } finally {
                setTimeout(() => {
                    setIsSaving(false);
                    setSaveMessage('');
                }, 2000);
            }
        }
    };

    if (!myInfo) {
        return (
            <div className={styles.container}>
                <div className={styles.board}>
                    <p style={{ marginTop: '200px' }}>로딩 중...</p>
                    <button className={styles.backButton} onClick={onClose}>← 뒤로가기</button>
                </div>
            </div>
        );
    }

    // 매너온도 계산 (최대 100도 기준, 36.5도 시작)
    const mannerPercent = Math.min(Math.max(myInfo.mannerScore, 0), 100);

    return (
        <div className={styles.container}>
            {/* 배경 이미지 (SettingsModal과 통일) */}
            <img
                className={styles.bgImage}
                src="/assets/backgrounds/main_page.png"
                alt="메아리의 숲"
            />

            <button className={styles.backButton} onClick={onClose}>
                ← 뒤로가기
            </button>

            <div className={styles.board}>
                <h2 className={styles.title}>내 정보</h2>

                <div className={styles.content}>
                    {/* 왼쪽 패널: 매너 점수 및 통계 */}
                    <div className={styles.leftPanel}>
                        <div className={styles.scoreContainer}>
                            <span className={styles.scoreLabel}>매너 점수</span>
                            <span className={styles.scoreValue}>{myInfo.mannerScore.toFixed(1)}°C</span>

                            {/* 프로그레스 바 */}
                            <div className={styles.progressBarBg}>
                                <div
                                    className={styles.progressBarFill}
                                    style={{ width: `${mannerPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className={styles.statsBox}>
                            <div className={styles.statItem}>
                                <span>💋 뽀뽀 횟수</span>
                                <strong>{myInfo.kissCount}</strong>
                            </div>
                            <div className={styles.statItem}>
                                <span>🤬 저주 횟수</span>
                                <strong>{myInfo.curseCount}</strong>
                            </div>
                        </div>
                    </div>

                    {/* 오른쪽 패널: 닉네임 변경 및 기타 */}
                    <div className={styles.rightPanel}>
                        {/* 사용자 정보 표시 */}
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>아이디 (ID)</span>
                            <span className={styles.infoValue}>{myInfo.username}</span>
                        </div>

                        {myInfo.email && (
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>이메일</span>
                                <span className={styles.infoValue}>{myInfo.email}</span>
                            </div>
                        )}

                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>닉네임</span>
                            <div className={styles.nicknameRow}>
                                <span className={styles.nicknameValue}>{myInfo.nickname}</span>
                                <button
                                    className={styles.editButton}
                                    onClick={() => {
                                        setTempNickname(myInfo.nickname);
                                        setNicknameCheckStatus('unchecked');
                                        setShowEditPopup(true);
                                    }}
                                    title="닉네임 변경"
                                >
                                    ✏️
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 닉네임 변경 팝업 */}
                {showEditPopup && (
                    <div className={styles.popupOverlay}>
                        <div className={styles.popupContent}>
                            <h3 className={styles.popupTitle}>닉네임 변경</h3>

                            <div className={styles.editForm}>
                                <div className={styles.inputWrapper}>
                                    <input
                                        className={styles.nicknameInput}
                                        type="text"
                                        value={tempNickname}
                                        onChange={(e) => setTempNickname(e.target.value)}
                                        maxLength={10}
                                        placeholder="새 닉네임"
                                    />
                                </div>
                                <p className={`${styles.statusMessage} ${nicknameCheckStatus !== 'unchecked' ? styles[nicknameCheckStatus] : ''}`}>
                                    {nicknameCheckStatus === 'checking' && '확인 중...'}
                                    {nicknameCheckStatus === 'available' && '사용 가능한 닉네임입니다.'}
                                    {nicknameCheckStatus === 'duplicate' && '이미 사용 중인 닉네임입니다.'}
                                </p>
                            </div>

                            <div className={styles.popupButtons}>
                                <button
                                    className={styles.inputButton}
                                    onClick={handleNicknameChange}
                                    disabled={isSaving || !tempNickname.trim() || tempNickname === nickname || nicknameCheckStatus !== 'available'}
                                >
                                    {saveMessage || '저장'}
                                </button>
                                <button
                                    className={styles.cancelButton}
                                    onClick={() => setShowEditPopup(false)}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
