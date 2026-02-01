import React from 'react';
import styles from './AudioController.module.css';
import { useAudioStore } from '../../store/useAudioStore';

export default function AudioController() {
    const { isMuted, volume, toggleMute, setVolume } = useAudioStore();

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    };

    return (
        <div className={styles.container}>
            <button
                className={styles.button}
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
            >
                <img
                    src="/assets/ui/bgm_icon.png"
                    alt="BGM"
                    className={styles.icon}
                    style={{ opacity: isMuted ? 0.5 : 1 }}
                />
            </button>
            <div className={styles.sliderWrapper}>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className={styles.slider}
                    style={{ '--volume': `${volume * 100}%` } as React.CSSProperties}
                    // @ts-ignore - 'orient' is a non-standard attribute supported by Firefox for vertical sliders
                    orient="vertical"
                />
            </div>
        </div>
    );
}
