import { create } from 'zustand';

interface GameState {
    nickname: string;
    roomId: string;
    isHost: boolean;

    // 액션(함수)들
    setNickname: (name: string) => void;
    joinGame: (roomId: string, isHost: boolean) => void;
    leaveGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    nickname: '',
    roomId: '',
    isHost: false,

    setNickname: (name) => set({ nickname: name }),
    joinGame: (roomId, isHost) => set({ roomId, isHost }),
    leaveGame: () => set({ roomId: '', isHost: false }),
}));