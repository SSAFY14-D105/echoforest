import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../store/useGameStore';
import styles from './PermissionCheckPage.module.css';

export default function PermissionCheckPage() {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { setHasMediaPermission, nickname } = useGameStore();

    // 닉네임 없으면 로그인으로 쫓아냄
    useEffect(() => {
        if (!nickname) {
            navigate('/', { replace: true });
        }
    }, [nickname, navigate]);

    // [New] 페이지 진입 시 이미 권한이 있으면 바로 통과
    useEffect(() => {
        const checkExistingPermission = async () => {
            try {
                // 1. Permissions API 확인
                if (navigator.permissions && navigator.permissions.query) {
                    const cameraStatus = await navigator.permissions.query({ name: 'camera' as any });
                    const micStatus = await navigator.permissions.query({ name: 'microphone' as any });

                    if (cameraStatus.state === 'granted' && micStatus.state === 'granted') {
                        console.log('[PermissionCheck] Already granted. Redirecting to Lobby...');
                        setHasMediaPermission(true);
                        navigate('/lobby', { replace: true });
                        return;
                    }
                }

                // 2. (Optional) getUserMedia로 조용히 확인 (이미 허용했다면 prompt 없이 성공)
                // 단, 거부 상태면 에러나므로 try-catch 필수. 
                // 여기서는 prompt가 뜰 위험이 있어 Permissions API만 우선 신뢰
            } catch (e) {
                console.warn('[PermissionCheck] Auto-check failed:', e);
            }
        };

        checkExistingPermission();
    }, [navigate, setHasMediaPermission]);

    const requestPermission = async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('[PermissionCheck] Requesting getUserMedia...');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            // 성공 시 스트림 바로 해제 (브라우저는 권한 허용 상태를 기억함)
            stream.getTracks().forEach(track => track.stop());

            console.log('[PermissionCheck] Permission granted!');
            setHasMediaPermission(true);
            navigate('/lobby', { replace: true });

        } catch (err: any) {
            console.error('[PermissionCheck] Permission denied:', err);
            let msg = '권한 획득에 실패했습니다.\n';

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg += '브라우저 설정에서 카메라/마이크 권한을 허용해주세요.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                msg += '카메라 또는 마이크 장치를 찾을 수 없습니다.';
            } else {
                msg += err.message || '알 수 없는 오류가 발생했습니다.';
            }

            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* 배경 이미지 */}
            <img
                src="/assets/backgrounds/login_page.png"
                alt="Background"
                className={styles.bgImage}
            />

            {/* 어두운 오버레이 */}
            <div className={styles.overlay} />

            {/* 권한 안내 화살표 (왼쪽 상단 고정) */}
            <div className={styles.arrowWrapper}>
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 17L17 7M17 7H8M17 7V16" stroke="#FF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            {/* 가이드 이미지 (화살표 옆) */}
            <img
                src="/assets/ui/check_image.png"
                alt="Permission Guide"
                className={styles.guideImage}
            />
            {/* 안내 문구 (이미지 아래에 작게) */}
            <p className={styles.guideText}>
                여기서 마이크와 카메라 권한을 수정해주세요!
            </p>

            <div className={styles.contentWrapper}>
                <div className={styles.card}>
                    <p className={styles.description}>
                        혹시 <strong>'차단'</strong>을 누르셨나요?<br />
                        위 안내에 따라 권한을 <strong>'허용'</strong>으로 바꿔주세요.
                    </p>

                    {error && (
                        <div className={styles.errorBox}>
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        className={styles.btn}
                        onClick={requestPermission}
                        disabled={isLoading}
                    >
                        {isLoading ? '확인 중...' : '🌲 숲으로 들어가기 !'}
                    </button>

                    {isLoading && <p className={styles.loading}>장치를 확인하고 있습니다...</p>}
                </div>
            </div>
        </div>
    );
}
