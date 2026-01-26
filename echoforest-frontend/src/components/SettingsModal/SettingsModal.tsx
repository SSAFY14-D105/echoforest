import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { gameWebSocket } from '../../socket/GameWebSocket';
import { createLocalTracks, LocalVideoTrack } from 'livekit-client';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const { nickname, setNickname } = useGameStore();

    // 임시 상태
    const [tempNickname, setTempNickname] = useState(nickname);
    const [micVolume, setMicVolume] = useState(50);

    // 카메라 프리뷰 상태
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // 카메라 프리뷰 시작
    useEffect(() => {
        let mounted = true;

        const startCamera = async () => {
            try {
                const tracks = await createLocalTracks({
                    audio: false,
                    video: true,
                });

                const vidTrack = tracks.find(t => t.kind === 'video') as LocalVideoTrack;

                if (mounted && vidTrack) {
                    setVideoTrack(vidTrack);
                    if (videoRef.current) {
                        vidTrack.attach(videoRef.current);
                    }
                } else {
                    tracks.forEach(t => t.stop());
                }
            } catch (error) {
                console.error('Failed to get local tracks:', error);
                if (mounted) {
                    setCameraError('카메라를 찾을 수 없거나 권한이 없습니다.');
                }
            }
        };

        startCamera();

        return () => {
            mounted = false;
            if (videoTrack) {
                videoTrack.stop();
            }
        };
    }, []);

    // Cleanup tracks on unmount
    useEffect(() => {
        return () => {
            videoTrack?.stop();
        };
    }, [videoTrack]);

    const handleSave = () => {
        if (tempNickname.trim()) {
            setNickname(tempNickname.trim());
        }
        onClose();
    };

    const handleLogout = () => {
        if (window.confirm('정말 로그아웃 하시겠습니까?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('loginId');
            localStorage.removeItem('nickname');
            setNickname(''); // Store 초기화 -> App.tsx에서 로그인 페이지로 전환됨
            gameWebSocket.disconnect(); // 소켓 연결 끊기
            onClose();
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3>⚙️ 설정</h3>

                {/* 1. 닉네임 변경 */}
                <div className={styles.settingSection}>
                    <label className={styles.settingLabel}>닉네임</label>
                    <input
                        type="text"
                        value={tempNickname}
                        onChange={(e) => setTempNickname(e.target.value)}
                        placeholder="닉네임 입력"
                        className={styles.input}
                        maxLength={12}
                    />
                </div>

                {/* 2. 카메라 프리뷰 */}
                <div className={styles.settingSection}>
                    <label className={styles.settingLabel}>카메라 미리보기</label>
                    <div className={styles.cameraPreview}>
                        {cameraError ? (
                            <div className={styles.cameraError}>{cameraError}</div>
                        ) : (
                            <div className={styles.videoContainer}>
                                <video ref={videoRef} className={styles.previewVideo} autoPlay muted playsInline />
                            </div>
                        )}
                        {!videoTrack && !cameraError && <p>카메라 연결 중...</p>}
                    </div>
                </div>

                {/* 3. 마이크 볼륨 */}
                <div className={styles.settingSection}>
                    <label className={styles.settingLabel}>마이크 볼륨</label>
                    <div className={styles.volumeControl}>
                        <span>🎙️</span>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={micVolume}
                            onChange={(e) => setMicVolume(Number(e.target.value))}
                            className={styles.slider}
                        />
                        <span className={styles.volumeValue}>{micVolume}%</span>
                    </div>
                </div>

                {/* 모달 액션 */}
                <div className={styles.modalActions}>
                    <button onClick={onClose} className={styles.btnSecondary}>취소</button>
                    <button onClick={handleSave} className={styles.btnPrimary}>저장</button>
                </div>

                {/* 로그아웃 버튼 */}
                <div className={styles.logoutSection}>
                    <button className={styles.logoutBtn} onClick={handleLogout}>
                        로그아웃
                    </button>
                </div>
            </div>
        </div>
    );
}
