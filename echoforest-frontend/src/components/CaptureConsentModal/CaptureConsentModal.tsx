import styles from './CaptureConsentModal.module.css';

interface CaptureConsentModalProps {
    /** 모달 표시 여부 */
    isOpen: boolean;
    /** 동의 버튼 클릭 시 호출 */
    onAgree: () => void;
    /** 거부 버튼 클릭 시 호출 */
    onDecline: () => void;
}

/**
 * 캡처 동의 모달 컴포넌트
 * 
 * 게임 종료 후 카메라 화면 캡처 및 이미지 합성에 대한 사용자 동의를 받습니다.
 * 
 * @example
 * ```tsx
 * const [showConsent, setShowConsent] = useState(false);
 * 
 * <CaptureConsentModal
 *   isOpen={showConsent}
 *   onAgree={() => {
 *     // 동의 처리 후 캡처 진행
 *     handleCapture();
 *     setShowConsent(false);
 *   }}
 *   onDecline={() => {
 *     // 거부 시 캡처 없이 진행
 *     setShowConsent(false);
 *   }}
 * />
 * ```
 */
export default function CaptureConsentModal({
    isOpen,
    onAgree,
    onDecline
}: CaptureConsentModalProps) {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onDecline}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* 제목 */}
                <h2 className={styles.title}>촬영 및 이미지 합성 동의</h2>
                <p className={styles.subtitle}>게임 결과 화면을 만들기 위해 동의가 필요합니다</p>

                {/* 동의 내용 */}
                <div className={styles.consentBox}>
                    <div className={styles.consentItem}>
                        <p className={styles.consentText}>
                            <strong>촬영 목적:</strong> 게임 종료 시 카메라 화면을 캡처하여
                            게임 결과 리포트 이미지를 생성합니다.
                        </p>
                    </div>

                    <div className={styles.consentItem}>
                        <p className={styles.consentText}>
                            <strong>활용 범위:</strong> 캡처된 이미지는 본 게임 서비스 내
                            결과 화면 표시 목적으로만 사용되며, 외부로 공유되지 않습니다.
                        </p>
                    </div>

                    <div className={styles.consentItem}>
                        <p className={styles.consentText}>
                            <strong>보관 기간:</strong> 캡처된 이미지는 결과 화면 생성 후
                            즉시 삭제되며, 서버에 별도로 저장되지 않습니다.
                        </p>
                    </div>

                    <div className={styles.consentItem}>
                        <p className={styles.consentText}>
                            <strong>거부 권리:</strong> 동의하지 않으실 경우,
                            이미지 합성 없이 기본 결과 화면이 표시됩니다.
                        </p>
                    </div>
                </div>

                {/* 안내 메시지 */}
                <div style={{ textAlign: 'center' }}>
                    <div className={styles.notice}>
                        <p className={styles.noticeText}>
                            동의 후에도 언제든지 설정에서 철회하실 수 있습니다.
                        </p>
                    </div>
                </div>

                {/* 버튼 */}
                <div className={styles.buttonGroup}>
                    <button
                        className={`${styles.btn} ${styles.btnDecline}`}
                        onClick={onDecline}
                    >
                        동의하지 않음
                    </button>
                    <button
                        className={`${styles.btn} ${styles.btnAgree}`}
                        onClick={onAgree}
                    >
                        동의합니다
                    </button>
                </div>
            </div>
        </div>
    );
}
