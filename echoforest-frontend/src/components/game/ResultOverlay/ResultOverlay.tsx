import { useState, useEffect } from 'react';
import { getRoomGeneratedImages, sendFinishEmail, ImageResponseDto, PlayerGameStats } from '../../../apis/imageApi';
import GameStatisticsView from './GameStatisticsView';
import { API_BASE_URL } from '../../../config';
import styles from './ResultOverlay.module.css';

interface ResultOverlayProps {
    roomId: string; // roomId (equals roomCode in this context?)
    onClose: () => void;
}

export default function ResultOverlay({ roomId, onClose }: ResultOverlayProps) {
    const [images, setImages] = useState<ImageResponseDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingEmail, setSendingEmail] = useState(false);
    // const [emailSent, setEmailSent] = useState(false); // Removed in favor of stats view
    const [gameStats, setGameStats] = useState<PlayerGameStats[] | null>(null);
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        loadImages();
    }, [roomId]);

    const loadImages = async () => {
        try {
            const data = await getRoomGeneratedImages(roomId);

            // [FIX] 중복 제거 및 정렬 로직 (최신순 데이터를 스테이지별로 유니크하게 필터링)
            const uniqueMap = new Map<string, ImageResponseDto>();
            data.forEach(img => {
                const key = img.stageNumber ? `stage-${img.stageNumber}` : `img-${img.imageId}`;
                // data는 최신순(DESC)으로 오므로, 첫 번째로 만나는 것이 가장 최신
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, img);
                }
            });

            const uniqueImages = Array.from(uniqueMap.values());
            // 스테이지 번호 오름차순 정렬 (1 -> 2 -> 3 -> 4)
            uniqueImages.sort((a, b) => (a.stageNumber || 0) - (b.stageNumber || 0));

            setImages(uniqueImages);
        } catch (error) {
            console.error('Failed to load result images:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        setSendingEmail(true);
        try {
            const response = await sendFinishEmail(roomId);
            // setEmailSent(true); 
            // 통계 데이터가 있으면 통계 화면으로 전환
            if (response.stats) {
                setGameStats(response.stats);
                setShowStats(true);
            } else {
                // 통계가 없으면 3초 후 종료 (기존 로직 Fallback)
                alert('이메일이 발송되었습니다. (통계 없음)');
                setTimeout(() => {
                    onClose();
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to send email:', error);
            alert('이메일 발송에 실패했습니다.');
        } finally {
            setSendingEmail(false);
        }
    };

    if (showStats && gameStats) {
        return <GameStatisticsView stats={gameStats} onReturnToLobby={onClose} />;
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <h2 className={styles.title}>🎉 모험 완료! 🎉</h2>
                <p className={styles.subtitle}>메아리의 숲에서의 추억들</p>

                {loading ? (
                    <div className={styles.loading}>이미지 불러오는 중...</div>
                ) : (
                    <div className={styles.grid}>
                        {images.length === 0 ? (
                            <p>생성된 추억 이미지가 없습니다.</p>
                        ) : (
                            images.map((img) => (
                                <div key={img.imageId} className={styles.imageCard}>
                                    <img
                                        src={`${API_BASE_URL}/images/download/${img.imageId}`}
                                        alt={`Result ${img.stageNumber}`}
                                        className={styles.image}
                                    />
                                    <span className={styles.stageLabel}>
                                        {img.stageNumber ? `Stage ${img.stageNumber}` : 'Event'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                <div className={styles.actions}>
                    <button
                        className={styles.finishBtn}
                        onClick={handleFinish}
                        disabled={sendingEmail || loading}
                    >
                        {sendingEmail ? '이메일 전송 및 통계 확인 중...' : '이메일로 받기 & 결과 보기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
