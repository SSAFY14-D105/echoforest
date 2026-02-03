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
}

export const useGameStore = create<GameState>((set, get) => ({
    nickname: localStorage.getItem('nickname') || '',
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
    isEndingMission: false,
    hasMediaPermission: false,

    // 볼륨 초기값: 70% (4명)
    playerVolumes: [70, 70, 70, 70],

    setHasMediaPermission: (granted: boolean) => set({ hasMediaPermission: granted }),
    setPlayerVolume: (index, volume) => set((state) => {
        const newVolumes = [...state.playerVolumes];
        // 인덱스 안전장치 (최대 4명)
        if (index >= 0 && index < 4) {
            newVolumes[index] = volume;
        }
        return { playerVolumes: newVolumes };
    }),
    setGamePaused: (nickname) => set({ pausedBy: nickname }),
    setEndingMission: (active) => set({ isEndingMission: active }),

    setNickname: (name) => {
        localStorage.setItem('nickname', name); // [FIX] 닉네임 영구 저장
        set({ nickname: name });
    },
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
    leaveGame: () => {
        // [FIX] 게임 퇴장 시 정리 작업
        const currentRoomId = get().roomId;

        // WebSocket 퇴장 메시지 전송
        import('../socket/GameWebSocket').then(({ gameWebSocket }) => {
            if (currentRoomId && gameWebSocket.isConnected()) {
                gameWebSocket.sendLeave(currentRoomId);
            }
        }).catch((/* e */) => { /* console.warn(e) */ });

        // LiveKit 연결 해제
        import('../socket/LiveKitService').then(({ liveKitService }) => {
            liveKitService.disconnect();
        }).catch((/* e */) => { /* console.warn(e) */ });

        set({ roomId: '', isHost: false, players: [], isGameStarted: false, isSoloMode: false, currentStage: null });
    },
    addPlayer: (player) => set((state) => ({
        players: state.players.some(p => p.id === player.id)
            ? state.players
            : [...state.players, player]
    })),
    setPlayers: (players) => set({ players }),
    syncPlayersFromServer: (serverPlayers) => set((state) => {

        // 서버에서 받은 플레이어 상태를 기존 목록과 병합


        // [FIX] 서버 데이터를 전적으로 신뢰하여 동기화
        // 클라이언트 임의 정렬이 아닌, 서버가 보낸 colorIndex(Slot Index)를 기준/정렬 키로 사용
        const nextPlayers: Player[] = serverPlayers.map((serverPlayer) => {
            const serverId = serverPlayer.id || serverPlayer.username || "unknown";
            const existingPlayer = state.players.find(p => p.nickname === serverId);

            // [CRITICAL] 서버에서 할당된 colorIndex와 isHost 정보를 사용
            // 기존에는 배열 인덱스(index)를 사용했으나, 네트워크 순서 보장이 안 될 경우를 대비해 명시적 필드 사용
            const colorIndex = serverPlayer.colorIndex ?? 0; // fallback 0
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

        // 3. 로컬 플레이어 식별
        const myNickname = state.nickname;
        if (myNickname) {
            const me = nextPlayers.find(p => p.nickname === myNickname);
            if (me) {
                me.isLocal = true;
            }
        }

        // 4. ColorIndex 기준으로 오름차순 정렬 (Slot 0, 1, 2, 3 순서 보장)
        // CameraArea 등에서 index를 사용하여 렌더링하므로 순서가 매우 중요함
        nextPlayers.sort((a, b) => (a.colorIndex || 0) - (b.colorIndex || 0));

        return { players: nextPlayers };
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
    selectStage: (stageId) => set({
        currentStage: stageId,
        isEndingMission: false // [FIX] 새 스테이지 시작 시 엔딩 미션 상태 초기화하여 루프 방지
    }),
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
    logout: async () => {
        // [FIX] 서버 세션 제거 요청 (실패해도 로컬 로그아웃은 진행)
        try {
            const { logout } = await import('../apis/authApi');
            await logout();
        } catch (e) {
            // console.warn("로그아웃 API 호출 실패:", e);
        }

        // 1. localStorage 정리
        localStorage.removeItem('token');
        localStorage.removeItem('loginId');
        localStorage.removeItem('nickname');

        // 2. WebSocket 연결 종료 및 싱글톤 초기화
        // 순환 참조 방지를 위해 동적 import 사용 가능하지만, GameWebSocket은 이미 싱글톤 export 중
        // 여기서는 GameWebSocket 클래스의 static 메서드 호출
        try {
            const { GameWebSocket } = await import('../socket/GameWebSocket');
            GameWebSocket.resetInstance();
        } catch (e) {
            // console.warn("WebSocket 초기화 실패:", e);
        }

        // 3. 상태 초기화
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