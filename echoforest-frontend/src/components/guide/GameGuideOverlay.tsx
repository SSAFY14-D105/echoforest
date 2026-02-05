import React, { useEffect } from 'react';
import styles from './GameGuideOverlay.module.css';

interface GameGuideOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function GameGuideOverlay({ isOpen, onClose }: GameGuideOverlayProps) {
    // ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlayOverlay} onClick={onClose}>
            <div className={styles.overlayContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>🎮 메아리의 숲 게임 가이드</h2>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.scrollArea}>
                    <div className={styles.section}>
                        <p className={styles.text}>
                            안녕하세요! 숲속의 탐험가가 되신 것을 환영합니다.<br />
                            동료들과 협력하여 저주를 풀고 숲을 탈출하세요!
                        </p>
                    </div>

                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>🕹️ 조작 방법</h3>
                        <ul className={styles.list}>
                            <li className={styles.listItem}><span className={styles.highlight}>이동</span>: 키보드 방향키 (←, →)</li>
                            <li className={styles.listItem}><span className={styles.highlight}>점프</span>: 스페이스바 (Space) 또는 위쪽 방향키 (↑)</li>
                            <li className={styles.listItem}><span className={styles.highlight}>상호작용</span>: 자동으로 이루어집니다 (발판 밟기, 열쇠 획득 등)</li>
                        </ul>
                    </div>

                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>🗣️ 핵심 규칙: "말하는 대로"</h3>
                        <p className={styles.text}>이 게임은 여러분의 목소리를 듣습니다. 팀원과의 소통이 가장 중요합니다!</p>

                        <div style={{ marginTop: '20px' }}>
                            <h4 style={{ color: '#ffb74d', marginBottom: '10px' }}>1. 💀 저주 시스템</h4>
                            <p className={styles.text}>
                                게임 중 플레이어에게 무작위로 <strong>저주</strong>가 걸릴 수 있습니다.<br />
                                저주 스택은 <strong>부정적인 말(비속어, 짜증 등)</strong>을 하면 쌓입니다.<br />
                                스택이 <strong>10</strong>이 되면 누군가에게 저주가 발동됩니다!
                            </p>
                            <p className={styles.text} style={{ opacity: 0.8, fontSize: '0.9em' }}>
                                * 저주에 걸리면 캐릭터가 커지거나, 작아지거나, 조작이 반대로 바뀌는 등 방해 요소가 발생합니다.
                            </p>
                        </div>

                        <div style={{ marginTop: '20px' }}>
                            <h4 style={{ color: '#aed581', marginBottom: '10px' }}>2. ✨ 저주 해제 방법</h4>
                            <p className={styles.text}>
                                저주를 풀려면 <strong>긍정적인 말</strong>을 해야 합니다.<br />
                                마이크에 대고 크고 정확하게 외치세요!
                            </p>
                            <p className={`${styles.text} ${styles.positive}`} style={{ textAlign: 'center', padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                                "사랑해!", "좋아해!", "뽀뽀!"
                            </p>
                            <p className={styles.text} style={{ textAlign: 'center', marginTop: '10px' }}>
                                긍정적인 에너지가 저주를 정화시켜 줍니다.
                            </p>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>🤝 협동 플레이 팁</h3>
                        <ul className={styles.list}>
                            <li className={styles.listItem}><span className={styles.highlight}>서로를 믿으세요</span>: 어떤 구간은 동료의 머리를 밟고 올라가야 할 수도 있습니다.</li>
                            <li className={styles.listItem}><span className={styles.highlight}>동시에 움직이세요</span>: 혼자서는 갈 수 없는 길이 많습니다. 하나 둘 셋, 구호에 맞춰 움직이세요.</li>
                            <li className={styles.listItem}><span className={styles.highlight}>마이크 체크</span>: 게임 시작 전, 서로의 목소리가 잘 들리는지 확인하세요.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.footer}>
                    모두 준비되셨나요? 숲의 저주를 풀고 무사히 탈출하시길 빕니다! 행운을 빕니다! 🍀
                </div>
            </div>
        </div>
    );
}
