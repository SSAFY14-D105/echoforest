import { create } from 'zustand';

interface AudioState {
    isPlaying: boolean;
    isMuted: boolean;
    volume: number; // 0.0 ~ 1.0
    currentTrack: string | null;

    // Actions
    play: () => void;
    pause: () => void;
    toggleMute: () => void;
    setVolume: (volume: number) => void;
    setTrack: (trackPath: string) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
    isPlaying: false,
    isMuted: false,
    volume: 0.5,
    currentTrack: null,

    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    setVolume: (volume) => set({ volume }),
    setTrack: (trackPath) => set({ currentTrack: trackPath, isPlaying: true }),
}));
