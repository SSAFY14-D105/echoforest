import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { getMyImages, sendImagesToEmail } from '../../apis/imageApi';
import type { ImageResponseDto } from '../../apis/imageApi';
import { API_BASE_URL } from '../../config';
import styles from './MemoriesModal.module.css';

interface MemoriesModalProps {
    onClose: () => void;
}

export default function MemoriesModal({ onClose }: MemoriesModalProps) {
    const { nickname } = useGameStore();
    const userId = Number(localStorage.getItem('userId'));

    const [images, setImages] = useState<ImageResponseDto[]>([]);
    const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
    // 이메일 입력 상태 제거
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState('');

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8; // 2행 * 4열

    useEffect(() => {
        loadImages();
    }, []);

    const loadImages = async () => {
        if (!userId) {
            setMessage('로그인이 필요합니다.');
            return;
        }

        setIsLoading(true);
        try {
            const data = await getMyImages(userId);
            setImages(data);
            if (data.length === 0) {
                setMessage('아직 저장된 추억이 없어요. 엔딩까지 플레이해보세요!');
            }
        } catch (error) {
            console.error('이미지 로딩 실패:', error);
            setMessage('추억을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleImageSelection = (imageId: number) => {
        setSelectedImageIds(prev => {
            if (prev.includes(imageId)) {
                return prev.filter(id => id !== imageId);
            } else {
                return [...prev, imageId];
            }
        });
    };

    const handleSendEmail = async () => {
        if (selectedImageIds.length === 0) {
            alert('보낼 사진을 선택해주세요.');
            return;
        }

        if (!confirm(`${selectedImageIds.length}장의 사진을 가입된 이메일로 보내시겠습니까?`)) {
            return;
        }

        setIsSending(true);
        try {
            await sendImagesToEmail(userId, selectedImageIds);
            alert(`성공적으로 사진을 보냈습니다! 메일함을 확인해주세요.`);
            setSelectedImageIds([]); // 선택 초기화
        } catch (error: any) {
            alert(`전송 실패: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };

    // 현재 페이지 데이터 계산
    const totalPages = Math.ceil(images.length / ITEMS_PER_PAGE);
    const displayedImages = images.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    // 페이지네이션 버튼 계산 (최대 5개 표시)
    const MAX_PAGE_BUTTONS = 5;
    const startPage = Math.floor((currentPage - 1) / MAX_PAGE_BUTTONS) * MAX_PAGE_BUTTONS + 1;
    const endPage = Math.min(startPage + MAX_PAGE_BUTTONS - 1, totalPages);
    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
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

            <div className={styles.boardWrapper}>
                <div className={styles.boardContent}>
                    <h2 className={styles.title}>
                        🌲 {nickname}님의 추억 앨범
                    </h2>

                    <div className={styles.gridContainer}>
                        {isLoading ? (
                            <div className={styles.emptyState}>로딩 중...</div>
                        ) : images.length === 0 ? (
                            <div className={styles.emptyState}>
                                {message ? (
                                    <div>{message}</div>
                                ) : (
                                    <>
                                        <div>아직 저장된 추억이 없어요.</div>
                                        <div>오르골을 돌려 엔딩까지 플레이해보세요!</div>
                                    </>
                                )}
                            </div>
                        ) : (
                            displayedImages.map((img) => (
                                <div
                                    key={img.imageId}
                                    className={`${styles.gridItem} ${selectedImageIds.includes(img.imageId) ? styles.selected : ''
                                        }`}
                                    onClick={() => toggleImageSelection(img.imageId)}
                                >
                                    <img
                                        src={`${API_BASE_URL}/images/download/${img.imageId}`}
                                        alt="memory"
                                        className={styles.image}
                                        loading="lazy"
                                    />
                                    <div className={`${styles.checkbox} ${selectedImageIds.includes(img.imageId) ? styles.checked : ''
                                        }`} />
                                </div>
                            ))
                        )}
                    </div>

                    {/* 페이지네이션 UI */}
                    {images.length > 0 && (
                        <div className={styles.pagination}>
                            <button
                                className={styles.pageButton}
                                disabled={currentPage === 1}
                                onClick={() => handlePageChange(currentPage - 1)}
                            >
                                &lt;
                            </button>
                            {pageNumbers.map((page) => (
                                <button
                                    key={page}
                                    className={`${styles.pageButton} ${currentPage === page ? styles.activePage : ''}`}
                                    onClick={() => handlePageChange(page)}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                className={styles.pageButton}
                                disabled={currentPage === totalPages}
                                onClick={() => handlePageChange(currentPage + 1)}
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                    <div className={styles.footer}>
                        <div className={styles.infoText}>
                            📸 선택한 사진들이 가입하신 이메일로 발송됩니다.
                        </div>
                        <button
                            className={styles.sendButton}
                            onClick={handleSendEmail}
                            disabled={isSending || selectedImageIds.length === 0 || isLoading}
                        >
                            {isSending ? '전송 중...' : `내 메일로 보내기 (${selectedImageIds.length})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
