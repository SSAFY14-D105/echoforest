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
    colorIndex?: number; // 색상 인덱스 (서버 순서 기반 고정, 0=Green, 1=Blue...)
    isLocal?: boolean; // 로컬 플레이어 여부
    params?: any; // 추가 파라미터 보관 (서버 동기화 데이터 등)
}


interface GameState {
    nickname: string;
    roomId: string;
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

    // 액션(함수)들
    setNickname: (name: string) => void;
    setGamePaused: (username: string | null) => void; // 일시정지/재개 설정 (null=재개)
    joinGame: (roomId: string, isHost: boolean, initialStage?: number) => void;
    leaveGame: () => void;
    addPlayer: (player: Player) => void;
    setPlayers: (players: Player[]) => void;  // 전체 플레이어 설정
    // syncPlayersFromServer: 서버로부터 받은 플레이어 목록을 동기화 (정렬 후 색상 할당)
    syncPlayersFromServer: (serverPlayers: { id?: string; username?: string; x: number; y: number; vx?: number; vy?: number; width?: number; height?: number; hp?: number; isDead?: boolean; curses?: string[]; isHost?: boolean }[]) => void;
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
    pausedBy: null,

    setGamePaused: (nickname) => set({ pausedBy: nickname }),

    setNickname: (name) => set({ nickname: name }),
    joinGame: (roomId, isHost, initialStage = 0) => {
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
            isSoloMode: false,
            // 중간 난입 지원: 스테이지가 0보다 크면 게임 시작 상태로 설정
            isGameStarted: initialStage > 0,
            currentStage: initialStage > 0 ? `MULTI_${initialStage}` : null
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

        // Debug: 첫 번째 플레이어 데이터 샘플링 (너무 빈번하므로 가끔만)


        // [FIX] 서버 순서 신뢰 (Host=0 보장)
        // 클라이언트 정렬(알파벳) 제거 -> 방장 색상 탈취 버그 해결
        const sortedServerPlayers = [...serverPlayers];

        // 2. 플레이어 리스트 업데이트
        const nextPlayers: Player[] = sortedServerPlayers.map((serverPlayer, index) => {
            const serverId = serverPlayer.id || serverPlayer.username || "unknown";
            const existingPlayer = state.players.find(p => p.nickname === serverId);

            // colorIndex는 정렬된 순서(index)를 그대로 따름 (0: 초록, 1: 파랑...)
            // 0번 인덱스는 무조건 방장(호스트)으로 간주
            const colorIndex = index;
            const isHost = (index === 0);

            if (existingPlayer) {
                return {
                    ...existingPlayer,
                    id: existingPlayer.id || existingPlayer.nickname, // id 보장
                    x: serverPlayer.x,
                    y: serverPlayer.y,
                    params: serverPlayer,
                    colorIndex: colorIndex,
                    isHost: isHost
                };
            } else {
                return {
                    id: serverId, // 필수 필드 추가
                    nickname: serverId,
                    x: serverPlayer.x,
                    y: serverPlayer.y,
                    isHost: isHost,
                    isLocal: false,
                    colorIndex: colorIndex,
                    params: serverPlayer
                };
            }
        });

        // 3. 로컬 플레이어(내 캐릭터) 식별
        // 검증: nickname 일치 여부를 강력하게 확인
        const myNickname = state.nickname;
        if (myNickname) {
            const me = nextPlayers.find(p => p.nickname === myNickname);
            if (me) {
                me.isLocal = true;
            } else {
                // 내 닉네임이 서버 리스트에 없는 경우
                // if (Math.random() < 0.01) console.warn(`[Store] My player '${myNickname}' not found in server update!`);
            }
        }

        // 4. colorIndex 재계산 및 확정 (배열 인덱스 기준)
        const finalPlayers = nextPlayers.map((p, index) => ({
            ...p,
            colorIndex: index // 접속 순서(배열 순서)대로 색상 고정
        }));

        return { players: finalPlayers };
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
        currentStage: `MULTI_${stage}`,
        readyPlayers: []  // 게임 시작 시 Ready 상태 초기화
    }),
    startSoloGame: async () => {
        // 테스트용: 혼자서 멀티플레이 방 생성
        // WebSocket 연결 및 방 생성 로직은 LobbyPage에서 처리
        set({
            isSoloMode: true,  // 솔로 모드 플래그 유지 (UI 구분용)
            isHost: true,
        });
    },
    selectStage: (stageId) => set({ currentStage: stageId }),
    clearStage: (stageId) => set((state) => ({
        clearedStages: state.clearedStages.includes(stageId)
            ? state.clearedStages
            : [...state.clearedStages, stageId],
        currentStage: null // 스테이지 선택 화면으로 돌아감
    })),
    backToStageSelect: () => set({ currentStage: null }),
    setOnMoveCallback: (callback) => set({ onMoveCallback: callback }),
    broadcastMove: (x: number, y: number) => {
        const { onMoveCallback } = get();
        if (onMoveCallback) {
            onMoveCallback(x, y);
        }
    },
    logout: () => {
        // 1. localStorage 정리
        localStorage.removeItem('token');
        localStorage.removeItem('loginId');
        localStorage.removeItem('nickname');

        // 2. 상태 초기화 (nickname이 null이 되면 App.tsx에서 LoginPage로 전환됨)
        set({
            nickname: '',
            roomId: '',
            isHost: false,
            players: [],
            isGameStarted: false,
            isSoloMode: false,
            currentStage: null,
            pausedBy: null
        });
    }

}));