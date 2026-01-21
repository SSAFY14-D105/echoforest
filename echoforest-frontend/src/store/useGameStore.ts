import { create } from 'zustand';

export interface Player {
    id: string;
    nickname: string;
    isHost: boolean;
    x?: number;      // WebSocket 좌표 동기화용
    y?: number;      // WebSocket 좌표 동기화용
    anim?: string;   // 애니메이션 상태
}

interface GameState {
    nickname: string;
    roomId: string;
    isHost: boolean;
    players: Player[];
    isGameStarted: boolean;
    isSoloMode: boolean; // 혼자하기 모드
    currentStage: number | null; // null = 스테이지 선택 화면, 1~3 = 해당 스테이지 플레이 중
    clearedStages: number[]; // 클리어한 스테이지 목록
    hasCaptureConsent: boolean; // 캡처 및 이미지 합성 동의 여부
    onMoveCallback: ((x: number, y: number, anim?: string) => void) | null;  // 로컬 플레이어 이동 콜백

    // 액션(함수)들
    setNickname: (name: string) => void;
    joinGame: (roomId: string, isHost: boolean) => void;
    leaveGame: () => void;
    addPlayer: (player: Player) => void;
    setPlayers: (players: Player[]) => void;  // ROOM_STATE용 전체 플레이어 설정
    removePlayerByNickname: (nickname: string) => void;  // WebSocket LEAVE 처리용
    updatePlayerPosition: (nickname: string, x: number, y: number, anim?: string) => void;  // WebSocket MOVE 처리용
    startGame: () => void;
    startSoloGame: () => void; // 혼자하기 모드 시작
    selectStage: (stage: number) => void;
    clearStage: (stage: number) => void;
    backToStageSelect: () => void;
    setHasCaptureConsent: (consent: boolean) => void;
    setOnMoveCallback: (callback: ((x: number, y: number, anim?: string) => void) | null) => void;
    broadcastMove: (x: number, y: number, anim?: string) => void;  // 로컬 플레이어 이동 브로드캐스트
}

export const useGameStore = create<GameState>((set, get) => ({
    nickname: '',
    roomId: '',
    isHost: false,
    players: [],
    isGameStarted: false,
    isSoloMode: false,
    currentStage: null,
    clearedStages: [],
    hasCaptureConsent: localStorage.getItem('captureConsent') === 'true',
    onMoveCallback: null,

    setNickname: (name) => set({ nickname: name }),
    joinGame: (roomId, isHost) => {
        const { nickname } = get();
        const newPlayer: Player = {
            id: `player-${Date.now()}`,
            nickname: nickname,
            isHost: isHost
        };
        set({
            roomId,
            isHost,
            players: [newPlayer],  // 방 입장 시 본인을 플레이어 목록에 추가
            isSoloMode: false
        });
    },
    leaveGame: () => set({ roomId: '', isHost: false, players: [], isGameStarted: false, isSoloMode: false, currentStage: null }),
    addPlayer: (player) => set((state) => ({
        players: state.players.some(p => p.id === player.id)
            ? state.players
            : [...state.players, player]
    })),
    setPlayers: (players) => set({ players }),  // ROOM_STATE용 전체 덮어쓰기
    removePlayerByNickname: (nickname) => set((state) => ({
        players: state.players.filter(p => p.nickname !== nickname)
    })),
    updatePlayerPosition: (nickname, x, y, anim) => set((state) => ({
        players: state.players.map(p =>
            p.nickname === nickname
                ? { ...p, x, y, anim: anim ?? p.anim }
                : p
        )
    })),
    startGame: () => set({ isGameStarted: true, currentStage: null }),
    startSoloGame: () => {
        const { nickname } = get();
        const soloRoomCode = `SOLO-${Math.floor(1000 + Math.random() * 9000)}`;
        const soloPlayer: Player = {
            id: `solo-player-${Date.now()}`,
            nickname: nickname || 'Solo Player',
            isHost: true
        };
        set({
            roomId: soloRoomCode,
            isHost: true,
            isSoloMode: true,
            players: [soloPlayer],
            isGameStarted: true,
            currentStage: 1 // 바로 맵으로 이동 (스테이지 선택 생략)
        });
    },
    selectStage: (stage) => set({ currentStage: stage }),
    clearStage: (stage) => set((state) => ({
        clearedStages: state.clearedStages.includes(stage)
            ? state.clearedStages
            : [...state.clearedStages, stage],
        currentStage: null // 스테이지 선택 화면으로 돌아감
    })),
    backToStageSelect: () => set({ currentStage: null }),
    setHasCaptureConsent: (consent) => {
        localStorage.setItem('captureConsent', String(consent));
        set({ hasCaptureConsent: consent });
    },
    setOnMoveCallback: (callback) => set({ onMoveCallback: callback }),
    broadcastMove: (x, y, anim) => {
        const { onMoveCallback } = get();
        if (onMoveCallback) {
            onMoveCallback(x, y, anim);
        }
    }
}));