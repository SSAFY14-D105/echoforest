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
    isHidden?: boolean; // 숨김 상태 (골인 등)
    isDisconnected?: boolean; // [NEW] 연결 끊김 상태

    curses?: string[]; // 적용된 저주 목록
    colorIndex?: number; // 색상 인덱스 (서버 순서 기반 고정, 0=Green, 1=Blue...)
    isLocal?: boolean; // 로컬 플레이어 여부
    params?: any; // 추가 파라미터 보관 (서버 동기화 데이터 등)
}


interface GameState {
    nickname: string;
    roomId: string;
    host: string | null; // [FIX] 호스트 여부 확인용
    isHost: boolean;
    players: Player[];
    readyPlayers: string[];  // Ready 상태인 플레이어 닉네임 목록
    isGameStarted: boolean;
    isSoloMode: boolean; // 혼자하기 모드
    currentStage: string | null; // null = 스테이지 선택 화면, 'SOLO_1', 'MULTI_1' 등 고유 ID
    clearedStages: string[]; // 클리어한 스테이지 ID 목록
    onMoveCallback: ((x: number, y: number, anim?: string) => void) | null;  // 로컬 플레이어 이동 콜백

    // 일시정지 상태 (멀티플레이용)
    pausedBy: string | null; // 일시정지 유발자, null이면 진행 중

    // 엔딩 미션 상태
    // 엔딩 미션 상태
    isEndingMission: boolean; // 엔딩 미션 중인지 여부

    // [NEW] 권한 확인 여부 (로그인 후 필수)
    hasMediaPermission: boolean;
    setHasMediaPermission: (granted: boolean) => void;

    // 볼륨 설정 (사용자별 볼륨, 0~100)
    playerVolumes: number[]; // [p1, p2, p3] assuming p0 is me (or mapped by slot)
    setPlayerVolume: (index: number, volume: number) => void;

    // 액션(함수)들
    setNickname: (name: string) => void;
    setGamePaused: (username: string | null) => void; // 일시정지/재개 설정 (null=재개)
    setEndingMission: (active: boolean) => void; // 엔딩 미션 상태 설정
    joinGame: (roomId: string, isHost: boolean, initialStage?: number) => void;
    leaveGame: () => void;
    addPlayer: (player: Player) => void;
    setPlayers: (players: Player[]) => void;  // 전체 플레이어 설정
    // syncPlayersFromServer: 서버로부터 받은 플레이어 목록을 동기화 (정렬 후 색상 할당)
    // syncPlayersFromServer: 서버로부터 받은 플레이어 목록을 동기화 (정렬 후 색상 할당)
    syncPlayersFromServer: (serverPlayers: { id?: string; username?: string; x: number; y: number; vx?: number; vy?: number; width?: number; height?: number; hp?: number; isDead?: boolean; isHidden?: boolean; isDisconnected?: boolean; curses?: string[]; isHost?: boolean; colorIndex?: number }[]) => void;
    removePlayerByNickname: (nickname: string) => void;  // WebSocket LEAVE 처리용
    updatePlayerPosition: (nickname: string, x: number, y: number) => void;  // 위치 업데이트용
    // Ready 상태 관리
    setPlayerReady: (nickname: string, isReady: boolean) => void;
    clearReadyPlayers: () => void;
    isAllReady: () => boolean;
    startGame: () => void;
    startGameFromServer: (stage: number) => void;  // 서버에서 게임 시작 알림 받음
    startSoloGame: () => void; // 혼자하기 모드 시작
    selectStage: (stageId: string) => void;
    clearStage: (stageId: string) => void;
    backToStageSelect: () => void;
    setOnMoveCallback: (callback: ((x: number, y: number, anim?: string) => void) | null) => void;
    broadcastMove: (x: number, y: number) => void;  // 로컬 플레이어 이동 브로드캐스트
    logout: () => void; // 로그아웃 액션
    restoreSession: () => void; // [NEW] 세션 복구 액션
}

// [NEW] 세션 저장 헬퍼
const saveSessionToStorage = (state: GameState) => {
    sessionStorage.setItem('game_session', JSON.stringify({
        nickname: state.nickname,
        roomId: state.roomId,
        isHost: state.isHost,
        isSoloMode: state.isSoloMode,
        isGameStarted: state.isGameStarted,
        currentStage: state.currentStage,
        clearedStages: state.clearedStages,
        isEndingMission: state.isEndingMission
    }));
};

// [NEW] 스토어 초기화 시 동기적으로 세션 복원
const getInitialSessionState = () => {
    const storedNickname = localStorage.getItem('nickname');
    const stored = sessionStorage.getItem('game_session');

    if (stored && storedNickname) {
        try {
            const session = JSON.parse(stored);
            // 닉네임 유효성 체크
            if (session.nickname && session.nickname === storedNickname) {
                return {
                    roomId: session.roomId || '',
                    isHost: session.isHost || false,
                    isSoloMode: session.isSoloMode || false,
                    isGameStarted: session.isGameStarted || false,
                    currentStage: session.currentStage || null,
                    clearedStages: session.clearedStages || [],
                    isEndingMission: session.isEndingMission || false,
                    players: [{
                        id: session.nickname,
                        nickname: session.nickname,
                        isHost: session.isHost || false,
                        isLocal: true
                    }]
                };
            }
        } catch (e) {
            console.warn('[Store] Failed to parse session:', e);
        }
    }
    return null;
};

// 초기 세션 상태 (스토어 생성 전에 동기적으로 실행)
const initialSession = getInitialSessionState();

export const useGameStore = create<GameState>((set, get) => ({
    nickname: localStorage.getItem('nickname') || '',
    roomId: initialSession?.roomId || '',
    host: null, // [FIX] 초기값 null
    isHost: initialSession?.isHost || false,
    players: initialSession?.players || [],
    readyPlayers: [],  // Ready 상태인 플레이어 닉네임 목록
    isGameStarted: initialSession?.isGameStarted || false,
    isSoloMode: initialSession?.isSoloMode || false,
    currentStage: initialSession?.currentStage || null,
    clearedStages: initialSession?.clearedStages || [],
    onMoveCallback: null,
    pausedBy: null,
    isEndingMission: initialSession?.isEndingMission || false,
    hasMediaPermission: false,

    // 볼륨 초기값: 70% (4명)
    playerVolumes: [70, 70, 70, 70],

    // [NEW] 세션 복구 액션
    restoreSession: () => {
        const stored = sessionStorage.getItem('game_session');
        if (stored) {
            try {
                const session = JSON.parse(stored);
                // 닉네임 유효성 체크
                const currentNickname = localStorage.getItem('nickname');
                if (session.nickname && session.nickname === currentNickname) {
                    set({
                        roomId: session.roomId,
                        isHost: session.isHost,
                        isSoloMode: session.isSoloMode,
                        isGameStarted: session.isGameStarted,
                        currentStage: session.currentStage,
                        clearedStages: session.clearedStages || [],
                        isEndingMission: session.isEndingMission || false,
                        players: [{ // 최소한 본인은 복구
                            id: session.nickname,
                            nickname: session.nickname,
                            isHost: session.isHost,
                            isLocal: true
                        }]
                    });
                }
            } catch (e) {
                console.warn('[Store] Failed to restore session:', e);
            }
        }
    },

    setHasMediaPermission: (granted: boolean) => set({ hasMediaPermission: granted }),
    setPlayerVolume: (index, volume) => set((state) => {
        const newVolumes = [...state.playerVolumes];
        if (index >= 0 && index < 4) {
            newVolumes[index] = volume;
        }
        return { playerVolumes: newVolumes };
    }),
    setGamePaused: (nickname) => set({ pausedBy: nickname }),
    setEndingMission: (active) => {
        set({ isEndingMission: active });
        saveSessionToStorage(get());
    },

    setNickname: (name) => {
        localStorage.setItem('nickname', name);
        set({ nickname: name });
    },
    joinGame: (roomId, isHost, initialStage = 0) => {
        const { nickname } = get();
        const newPlayer: Player = {
            id: nickname,
            nickname: nickname,
            isHost: isHost
        };

        set({
            roomId,
            isHost,
            players: [newPlayer],
            readyPlayers: [],
            isSoloMode: false,
            isGameStarted: initialStage > 0,
            currentStage: initialStage > 0 ? `MULTI_${initialStage}` : null
        });
        saveSessionToStorage(get());
    },
    leaveGame: () => {
        const currentRoomId = get().roomId;

        import('../socket/GameWebSocket').then(({ gameWebSocket }) => {
            if (currentRoomId && gameWebSocket.isConnected()) {
                gameWebSocket.sendLeave(currentRoomId);
            }
        }).catch((/* e */) => { });

        import('../socket/LiveKitService').then(({ liveKitService }) => {
            liveKitService.disconnect();
        }).catch((/* e */) => { });

        sessionStorage.removeItem('game_session');
        set({
            roomId: '',
            isHost: false,
            players: [],
            isGameStarted: false,
            isSoloMode: false,
            currentStage: null,
            clearedStages: []
        });
    },
    addPlayer: (player) => set((state) => ({
        players: state.players.some(p => p.id === player.id)
            ? state.players
            : [...state.players, player]
    })),
    setPlayers: (players) => set({ players }),
    syncPlayersFromServer: (serverPlayers) => set((state) => {
        // [FIX] 서버 데이터를 전적으로 신뢰하여 동기화
        const nextPlayers: Player[] = serverPlayers.map((serverPlayer) => {
            const serverId = serverPlayer.id || serverPlayer.username || "unknown";
            const existingPlayer = state.players.find(p => p.nickname === serverId);

            const colorIndex = serverPlayer.colorIndex ?? 0;
            const isHost = serverPlayer.isHost ?? (colorIndex === 0);

            if (existingPlayer) {
                return {
                    ...existingPlayer,
                    id: existingPlayer.id || existingPlayer.nickname,
                    x: serverPlayer.x,
                    y: serverPlayer.y,
                    vx: serverPlayer.vx,
                    vy: serverPlayer.vy,
                    width: serverPlayer.width,
                    height: serverPlayer.height,
                    hp: serverPlayer.hp,
                    isDead: serverPlayer.isDead,
                    isHidden: serverPlayer.isHidden,
                    isDisconnected: serverPlayer.isDisconnected,
                    curses: serverPlayer.curses,
                    params: serverPlayer,
                    colorIndex: colorIndex,
                    isHost: isHost
                };
            } else {
                return {
                    id: serverId,
                    nickname: serverId,
                    x: serverPlayer.x,
                    y: serverPlayer.y,
                    vx: serverPlayer.vx,
                    vy: serverPlayer.vy,
                    width: serverPlayer.width,
                    height: serverPlayer.height,
                    hp: serverPlayer.hp,
                    isDead: serverPlayer.isDead,
                    isHidden: serverPlayer.isHidden,
                    isDisconnected: serverPlayer.isDisconnected,
                    curses: serverPlayer.curses,
                    isHost: isHost,
                    isLocal: false,
                    colorIndex: colorIndex,
                    params: serverPlayer
                };
            }
        });

        const myNickname = state.nickname;
        if (myNickname) {
            const me = nextPlayers.find(p => p.nickname === myNickname);
            if (me) {
                me.isLocal = true;
            }
        }

        nextPlayers.sort((a, b) => (a.colorIndex || 0) - (b.colorIndex || 0));

        return { players: nextPlayers };
    }),
    removePlayerByNickname: (nickname) => set((state) => ({
        players: state.players.filter(p => p.nickname !== nickname),
        readyPlayers: state.readyPlayers.filter(n => n !== nickname)
    })),
    updatePlayerPosition: (nickname, x, y) => set((state) => ({
        players: state.players.map(p =>
            p.nickname === nickname
                ? { ...p, x, y }
                : p
        )
    })),
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
        const nonHostPlayers = players.filter(p => !p.isHost && p.nickname !== nickname);
        if (nonHostPlayers.length === 0) return false;
        return nonHostPlayers.every(p => readyPlayers.includes(p.nickname));
    },
    startGame: () => {
        set({ isGameStarted: true, currentStage: null, readyPlayers: [] });
        saveSessionToStorage(get());
    },
    startGameFromServer: (stage) => {
        set({
            isGameStarted: true,
            currentStage: `MULTI_${stage}`,
            readyPlayers: []
        });
        saveSessionToStorage(get());
    },
    startSoloGame: async () => {
        set({
            isSoloMode: true,
            isHost: true,
        });
        // Solo mode doesn't need session save? Or maybe it does if we want refresh to work.
        // Let's safe-guard it.
        saveSessionToStorage(get());
    },
    selectStage: (stageId) => {
        set({
            currentStage: stageId,
            isEndingMission: false
        });
        saveSessionToStorage(get());
    },
    clearStage: (stageId) => {
        set((state) => ({
            clearedStages: state.clearedStages.includes(stageId)
                ? state.clearedStages
                : [...state.clearedStages, stageId],
            currentStage: null
        }));
        saveSessionToStorage(get());
    },
    backToStageSelect: () => {
        set({ currentStage: null });
        saveSessionToStorage(get());
    },
    setOnMoveCallback: (callback) => set({ onMoveCallback: callback }),
    broadcastMove: (x: number, y: number) => {
        const { onMoveCallback } = get();
        if (onMoveCallback) {
            onMoveCallback(x, y);
        }
    },
    logout: async () => {
        try {
            const { logout } = await import('../apis/authApi');
            await logout();
        } catch (e) { }

        localStorage.removeItem('token');
        localStorage.removeItem('loginId');
        localStorage.removeItem('nickname');
        sessionStorage.removeItem('game_session');

        try {
            const { GameWebSocket } = await import('../socket/GameWebSocket');
            GameWebSocket.resetInstance();
        } catch (e) { }

        set({
            nickname: '',
            roomId: '',
            isHost: false,
            players: [],
            isGameStarted: false,
            isSoloMode: false,
            currentStage: null,
            pausedBy: null,
            hasMediaPermission: false // [FIX] 로그아웃 시 권한 상태 초기화
        });
    }

}));