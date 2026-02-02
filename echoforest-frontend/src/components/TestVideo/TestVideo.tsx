import { VideoTrack, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import styles from '../pages/LiveKitTestPage.module.css';

export default function TestVideo() {
    // 카메라 소스의 모든 트랙(로컬 + 리모트)을 가져옵니다.
    const tracks = useTracks([Track.Source.Camera]);

    if (tracks.length === 0) {
        return <div className={styles.noVideo}>📷 카메라 로딩 중...</div>;
    }

    return (
        <div className={styles.videoGrid}>
            {tracks.map((track) => (
                <div key={track.participant.identity} className={styles.videoWrapper}>
                    <VideoTrack trackRef={track} className={styles.video} />
                    <div className={styles.nameTag}>
                        {track.participant.identity}
                        {track.participant.isLocal ? ' (나)' : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}
