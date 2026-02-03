import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useAudioStore = create<AudioState>()(
    persist(
        (set, get) => ({
            isPlaying: false,
            isMuted: false,
            volume: 0.5,
            currentTrack: null,

            play: () => set({ isPlaying: true }),
            pause: () => set({ isPlaying: false }),
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            setVolume: (volume) => set({ volume }),
            setTrack: (trackPath) => {
                const { currentTrack } = get();
                // 이미 같은 트랙이 설정되어 있다면 재생 상태를 건드리지 않음
                if (currentTrack === trackPath) {
                    return;
                }
                set({ currentTrack: trackPath, isPlaying: true });
            },
        }),
        {
            name: 'audio-storage', // localStorage key
            partialize: (state) => ({
                isMuted: state.isMuted,
                volume: state.volume,
                // isPlaying: state.isPlaying, // 재생 상태는 저장하지 않는 것이 좋을 수 있음 (자동 재생 정책 등) -> 사용자 요청은 상태 저장인듯 하니 저장
                isPlaying: false, // [DECISION] 앱 껐다 켰을 때 자동 재생은 부담스러울 수 있으므로 false로 초기화하되, BGM 끄기 상태(isMuted)는 유지
            }),
        }
    )
);
