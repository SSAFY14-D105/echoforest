import { create } from 'zustand';

export interface Player {
    id: string;
    nickname: string;
    isHost: boolean;
    x?: number;      // WebSocket 좌표 동기화용
    y?: number;      // WebSocket 좌표 동기화용
    vx?: number;     // X축 속도
    vy?: number;     // Y축 속도
    width?: number;  // 플레이어 너비 (저주로 변할 수 있음)
    height?: number; // 플레이어 높이 (저주로 변할 수 있음)
    hp?: number;     // 체력
    isDead?: boolean; // 사망 여부
    curses?: string[]; // 적용된 저주 목록
}


interface GameState {
    nickname: string;
    roomId: string;
    isHost: boolean;
    players: Player[];
    readyPlayers: string[];  // Ready 상태인 플레이어 닉네임 목록
    isGameStarted: boolean;
    isSoloMode: boolean; // 혼자하기 모드
    currentStage: number | null; // null = 스테이지 선택 화면, 1~3 = 해당 스테이지 플레이 중
    clearedStages: number[]; // 클리어한 스테이지 목록
    onMoveCallback: ((x: number, y: number) => void) | null;  // 로컬 플레이어 이동 콜백

    // 액션(함수)들
    setNickname: (name: string) => void;
    joinGame: (roomId: string, isHost: boolean) => void;
    leaveGame: () => void;
    addPlayer: (player: Player) => void;
    setPlayers: (players: Player[]) => void;  // 전체 플레이어 설정
    syncPlayersFromServer: (serverPlayers: { id: string; x: number; y: number; vx?: number; vy?: number; width?: number; height?: number; hp?: number; isDead?: boolean; curses?: string[] }[]) => void;  // UPDATE 메시지용
    removePlayerByNickname: (nickname: string) => void;  // WebSocket LEAVE 처리용
    updatePlayerPosition: (nickname: string, x: number, y: number) => void;  // 위치 업데이트용
    // Ready 상태 관리
    setPlayerReady: (nickname: string, isReady: boolean) => void;
    clearReadyPlayers: () => void;
    isAllReady: () => boolean;
    startGame: () => void;
    startGameFromServer: (stage: number) => void;  // 서버에서 게임 시작 알림 받음
    startSoloGame: () => void; // 혼자하기 모드 시작
    selectStage: (stage: number) => void;
    setCurrentStageFromServer: (stage: number) => void;  // 서버에서 스테이지 변경 알림 받음
    clearStage: (stage: number) => void;
    backToStageSelect: () => void;
    setOnMoveCallback: (callback: ((x: number, y: number) => void) | null) => void;
    broadcastMove: (x: number, y: number) => void;  // 로컬 플레이어 이동 브로드캐스트
}

export const useGameStore = create<GameState>((set, get) => ({
    nickname: '',
    roomId: '',
    isHost: false,
    players: [],
    readyPlayers: [],  // Ready 상태인 플레이어 닉네임 목록
    isGameStarted: false,
    isSoloMode: false,
    currentStage: null,
    clearedStages: [],
    onMoveCallback: null,

    setNickname: (name) => set({ nickname: name }),
    joinGame: (roomId, isHost) => {
        const { nickname } = get();
        const newPlayer: Player = {
            id: nickname,  // nickname을 id로 사용 (서버와 일치)
            nickname: nickname,
            isHost: isHost
        };
        set({
            roomId,
            isHost,
            players: [newPlayer],
            readyPlayers: [],  // 방 입장 시 Ready 상태 초기화
            isSoloMode: false
        });
    },
    leaveGame: () => set({ roomId: '', isHost: false, players: [], isGameStarted: false, isSoloMode: false, currentStage: null }),
    addPlayer: (player) => set((state) => ({
        players: state.players.some(p => p.id === player.id)
            ? state.players
            : [...state.players, player]
    })),
    setPlayers: (players) => set({ players }),
    syncPlayersFromServer: (serverPlayers) => set((state) => {
        // 서버에서 받은 플레이어 상태를 기존 목록과 병합
        // 백엔드의 sp.id = username (닉네임과 동일)

        // 1. 기존 플레이어들의 순서와 isHost 정보 보존
        const existingByNickname = new Map(state.players.map(p => [p.nickname, p]));

        // 2. 서버에 있는 플레이어만 업데이트 (기존 플레이어 우선, 새 플레이어 추가)
        const serverNicknames = new Set(serverPlayers.map(sp => sp.id));

        // 3. 기존 플레이어 중 서버에도 있는 것들 업데이트
        const updatedExisting = state.players
            .filter(p => serverNicknames.has(p.nickname))
            .map(existingPlayer => {
                const serverData = serverPlayers.find(sp => sp.id === existingPlayer.nickname);
                if (serverData) {
                    return {
                        ...existingPlayer,  // isHost, id 등 기존 정보 유지
                        x: serverData.x,
                        y: serverData.y,
                        vx: serverData.vx,
                        vy: serverData.vy,
                        width: serverData.width,
                        height: serverData.height,
                        hp: serverData.hp,
                        isDead: serverData.isDead,
                        curses: serverData.curses
                    };
                }
                return existingPlayer;
            });

        // 4. 서버에는 있지만 기존에 없는 새 플레이어 추가
        const newPlayers = serverPlayers
            .filter(sp => !existingByNickname.has(sp.id))
            .map(sp => ({
                id: sp.id,
                nickname: sp.id,
                isHost: false,  // 새로 들어온 사람은 무조건 isHost: false
                x: sp.x,
                y: sp.y,
                vx: sp.vx,
                vy: sp.vy,
                width: sp.width,
                height: sp.height,
                hp: sp.hp,
                isDead: sp.isDead,
                curses: sp.curses
            } as Player));

        // 5. 기존 순서 유지 + 새 플레이어는 뒤에 추가
        return { players: [...updatedExisting, ...newPlayers] };
    }),
    removePlayerByNickname: (nickname) => set((state) => ({
        players: state.players.filter(p => p.nickname !== nickname),
        readyPlayers: state.readyPlayers.filter(n => n !== nickname)  // Ready 목록에서도 제거
    })),
    updatePlayerPosition: (nickname, x, y) => set((state) => ({
        players: state.players.map(p =>
            p.nickname === nickname
                ? { ...p, x, y }
                : p
        )
    })),
    // Ready 상태 관리
    setPlayerReady: (nickname, isReady) => set((state) => ({
        readyPlayers: isReady
            ? state.readyPlayers.includes(nickname)
                ? state.readyPlayers
                : [...state.readyPlayers, nickname]
            : state.readyPlayers.filter(n => n !== nickname)
    })),
    clearReadyPlayers: () => set({ readyPlayers: [] }),
    isAllReady: () => {
        const { players, readyPlayers, nickname } = get();
        // 방장 제외한 모든 플레이어가 Ready 상태인지 확인
        const nonHostPlayers = players.filter(p => !p.isHost && p.nickname !== nickname);
        if (nonHostPlayers.length === 0) return false; // 혼자면 시작 불가
        return nonHostPlayers.every(p => readyPlayers.includes(p.nickname));
    },
    startGame: () => set({ isGameStarted: true, currentStage: null, readyPlayers: [] }),
    startGameFromServer: (stage) => set({
        isGameStarted: true,
        currentStage: stage,
        readyPlayers: []  // 게임 시작 시 Ready 상태 초기화
    }),
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
            readyPlayers: [],
            isGameStarted: true,
            currentStage: 1
        });
    },
    selectStage: (stage) => set({ currentStage: stage }),
    setCurrentStageFromServer: (stage) => set({ currentStage: stage }),
    clearStage: (stage) => set((state) => ({
        clearedStages: state.clearedStages.includes(stage)
            ? state.clearedStages
            : [...state.clearedStages, stage],
        currentStage: null
    })),
    backToStageSelect: () => set({ currentStage: null }),
    setOnMoveCallback: (callback) => set({ onMoveCallback: callback }),
    broadcastMove: (x: number, y: number) => {
        const { onMoveCallback } = get();
        if (onMoveCallback) {
            onMoveCallback(x, y);
        }
    }
}));