import { useTracks, VideoTrack, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import styles from './FourSplitLayout.module.css';

// 플레이어별 색상 테마
const PLAYER_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

interface FourSplitLayoutProps {
    /** 중앙에 표시할 오버레이 컴포넌트 (손가락 룰렛 등) */
    centerOverlay?: React.ReactNode;
}

/**
 * 4분할 화상 레이아웃 (인증샷 화면용)
 * - 2x2 그리드로 4명의 얼굴이 크게 표시됨
 * - 가운데에 오버레이 컴포넌트 배치 가능 (룰렛, 포즈 안내 등)
 * - LiveKitProvider 내부에서 사용해야 함
 * 
 * @example
 * ```tsx
 * <LiveKitProvider roomId="room_1" username="철수">
 *   <FourSplitLayout centerOverlay={<FingerRoulette />} />
 * </LiveKitProvider>
 * ```
 */
export function FourSplitLayout({ centerOverlay }: FourSplitLayoutProps) {
    const participants = useParticipants();
    const tracks = useTracks([Track.Source.Camera]);

    // 4개 슬롯
    const slots = [0, 1, 2, 3];

    return (
        <div className={styles.gridContainer}>
            {slots.map((index) => {
                const participant = participants[index];
                const track = tracks.find(
                    (t) => t.participant.identity === participant?.identity
                );

                return (
                    <div
                        key={index}
                        className={styles.videoSlot}
                        style={{ borderColor: PLAYER_COLORS[index] }}
                    >
                        {participant && track ? (
                            <>
                                <VideoTrack
                                    trackRef={track}
                                    className={styles.video}
                                />
                                <div className={styles.nameTag}>
                                    P{index + 1}: {participant.identity}
                                </div>
                            </>
                        ) : (
                            <div className={styles.emptySlot}>
                                <div className={styles.emptyIcon}>👤</div>
                                <span className={styles.playerNum}>P{index + 1}</span>
                                <span className={styles.waiting}>대기중...</span>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* 중앙 오버레이 (손가락 룰렛, 포즈 안내 등) */}
            {centerOverlay && (
                <div className={styles.centerOverlay}>
                    {centerOverlay}
                </div>
            )}
        </div>
    );
}

export default FourSplitLayout;
