import { VideoTrack, useLocalParticipant, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import styles from '../pages/LiveKitTestPage.module.css';

export default function TestVideo() {
    const { localParticipant } = useLocalParticipant();
    const tracks = useTracks([Track.Source.Camera]);

    const myVideoTrack = tracks.find(
        (track) => track.participant.identity === localParticipant.identity
    );

    if (!myVideoTrack) {
        return <div className={styles.noVideo}>📷 카메라 로딩 중...</div>;
    }

    return (
        <div className={styles.videoWrapper}>
            <VideoTrack trackRef={myVideoTrack} className={styles.video} />
            <div className={styles.nameTag}>{localParticipant.identity}</div>
        </div>
    );
}
