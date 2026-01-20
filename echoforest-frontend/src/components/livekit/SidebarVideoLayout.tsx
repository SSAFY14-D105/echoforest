import { useTracks, VideoTrack, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import styles from './SidebarVideoLayout.module.css';

// 플레이어별 색상 테마
const PLAYER_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

/**
 * 사이드바 형태의 화상 레이아웃 (Map 진행 중 사용)
 * - 세로로 4명의 얼굴이 작게 표시됨
 * - LiveKitProvider 내부에서 사용해야 함
 * 
 * @example
 * ```tsx
 * <LiveKitProvider roomId="room_1" username="철수">
 *   <SidebarVideoLayout />
 * </LiveKitProvider>
 * ```
 */
export function SidebarVideoLayout() {
    const participants = useParticipants();
    const tracks = useTracks([Track.Source.Camera]);

    // 4개 슬롯
    const slots = [0, 1, 2, 3];

    return (
        <div className={styles.sidebarContainer}>
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
                                    P{index + 1}
                                </div>
                            </>
                        ) : (
                            <div className={styles.emptySlot}>
                                <span className={styles.playerNum}>P{index + 1}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default SidebarVideoLayout;
