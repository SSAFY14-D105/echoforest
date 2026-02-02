import { useState, useEffect } from 'react';
import { getRoomGeneratedImages, sendFinishEmail, ImageResponseDto } from '../../../apis/imageApi';
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
    const [emailSent, setEmailSent] = useState(false);

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
            await sendFinishEmail(roomId);
            setEmailSent(true);
            // 3초 후 닫기
            setTimeout(() => {
                onClose();
            }, 3000);
        } catch (error) {
            console.error('Failed to send email:', error);
            alert('이메일 발송에 실패했습니다.');
            setSendingEmail(false);
        }
    };

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
                    {emailSent ? (
                        <p className={styles.successMessage}>✅ 이메일이 발송되었습니다!</p>
                    ) : (
                        <button
                            className={styles.finishBtn}
                            onClick={handleFinish}
                            disabled={sendingEmail || loading}
                        >
                            {sendingEmail ? '이메일 전송 중...' : '이메일로 받기 & 종료'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
