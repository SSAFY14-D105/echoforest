// WebSocket 통신 
/**
 * 게임 WebSocket 클라이언트 (싱글톤)
 * 백엔드 GameMessageDto와 동일한 형식 사용
 * 
 * - 로비에서 연결 후 GamePage로 이동해도 연결 유지
 * - getInstance()로 전역 인스턴스 접근
 */
import { API_BASE_URL } from '../config.ts';

// 백엔드와 동일한 메시지 타입 (GameWebSocketHandler 기준)
export type MessageType =
    | 'CREATE'        // Client→Server: 방 생성
    | 'ROOM_CREATED'  // Server→Client: 방 생성 완료 (content에 방 코드)
    | 'JOIN'          // 양방향: 방 참가 요청/알림
    | 'LEAVE'         // Server→Others: 플레이어 퇴장 알림
    | 'MOVE'          // Client→Server: 입력 전송 (content에 입력 타입)
    | 'UPDATE'        // Server→All: 전체 플레이어 상태 (20 TPS)
    | 'PING'          // Client→Server: Keep-alive
    | 'PONG'          // Server→Client: Keep-alive 응답
    | 'ERROR'         // Server→Client: 에러 메시지
    // Ready/Start/Stage 관련 (새로 추가)
    | 'READY'         // Client→Server: Ready 상태 변경 (content: "true"/"false")
    | 'START_GAME'    // Client→Server: 게임 시작 (방장만)
    | 'NEXT_STAGE'    // Client→Server: 다음 스테이지 (방장만)
    | 'READY_STATUS'  // Server→All: Ready 상태 브로드캐스트 (username, content: "true"/"false")
    | 'GAME_START'    // Server→All: 게임 시작 (content: 스테이지 번호)
    | 'STAGE_CHANGE'  // Server→All: 스테이지 변경 (content: 스테이지 번호)
    | 'STAGE_SELECT'  // Client<->Server: 스테이지 선택 (stage: 번호)
    | 'STAGE_CLEAR'   // Client<->Server: 스테이지 클리어 (stage: 번호)
    | 'PLAYER_LEFT'   // Server→Others: 플레이어 퇴장
    | 'ROOM_CLOSED'   // Server→All: 방 폭파 (방장 퇴장)
    | 'KICKED'        // Server→Client: 강제 퇴장됨
    // STT 저주 시스템 (추가)
    | 'SPEECH_BATCH'      // Client→Server: 발화 배치 전송 (content: texts JSON)
    | 'STACK_UPDATED'     // Server→All: 스택 변경 (stack, delta, reason)
    | 'CURSE_TRIGGERED'   // Server→All: 저주 발동 (cursedPlayerId, mapId)
    | 'CURSE_RELEASE'     // Client→Server: 저주 해제 요청 (content: 긍정어)
    | 'CURSE_RELEASED'    // Server→All: 저주 해제됨 (releasedPlayerId, word)
    // Map Object Sync (Hybrid Authority)
    | 'GIMMICK_UPDATE'    // Host -> Server -> Clients: 자동 기믹 위치 동기화
    | 'BLOCK_UPDATE'      // Interactor -> Server -> Clients: 박스 위치 동기화
    | 'BLOCK_UPDATE'      // Interactor -> Server -> Clients: 박스 위치 동기화
    // Global Reset
    | 'GAME_RESET'        // Client<->Server: 게임 리셋 (협동 실패)
    // Pause/Resume (Stability)
    | 'PAUSE_GAME'    // Client->Server: 일시정지 요청
    | 'RESUME_GAME'   // Client->Server: 재개 요청
    | 'GAME_PAUSED'   // Server->All: 게임 일시정지 알림 (content: username)
    | 'GAME_RESUMED'; // Server->All: 게임 재개 알림 (content: username)

// ... (Interface declarations remain same) ...



// UPDATE 메시지에서 오는 플레이어 상태
export interface ServerPlayerState {
    id: string;          // username
    x: number;
    y: number;
    vx: number;
    vy: number;
    anim?: string;       // 애니메이션 상태 (jump, walk, idle)
    width: number;
    height: number;
    hp: number;
    isDead: boolean;
    isAfk?: boolean;     // AFK 상태
    curses: string[];
    serverTick?: number;
}

export interface GameMessage {
    type: MessageType;
    roomId?: string;
    username?: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    anim?: string;
    content?: string;  // 시스템 메시지, 입력 타입, UPDATE 플레이어 데이터
    stage?: number;    // 스테이지 번호 (SELECT, CLEAR 등에서 사용)
    // STT 저주 시스템 필드 (추가)
    texts?: string[];           // SPEECH_BATCH용
    word?: string;              // CURSE_RELEASE용
    stack?: number;             // STACK_UPDATED용
    delta?: number;             // 스택 변화량
    reason?: string;            // 스택 변화 이유
    cursedPlayerId?: string;    // CURSE_TRIGGERED용
    releasedPlayerId?: string;  // CURSE_RELEASED용
    mapId?: number;             // 저주 효과 맵 ID
    isDead?: boolean;           // 플레이어 상태 동기화용
    curses?: string[];          // 플레이어 상태 동기화용
}

type MessageHandler = (message: GameMessage) => void;

class GameWebSocket {
    private static instance: GameWebSocket | null = null;

    private ws: WebSocket | null = null;
    private username: string = '';
    private token: string = '';
    private onMessageHandler: MessageHandler | null = null;
    private onConnectHandler: (() => void) | null = null;
    private onErrorHandler: ((error: string) => void) | null = null;
    private onCloseHandler: (() => void) | null = null;

    private constructor() {
        // private constructor for singleton
    }

    // 이벤트 리스너 맵 (MessageType -> Handler[])
    private listeners: Map<string, Array<(message: GameMessage) => void>> = new Map();

    /**
     * 특정 메시지 타입에 대한 리스너 등록
     */
    public on(type: MessageType, handler: (message: GameMessage) => void) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type)?.push(handler);
    }

    /**
     * 리스너 제거
     */
    public off(type: MessageType, handler: (message: GameMessage) => void) {
        const handlers = this.listeners.get(type);
        if (handlers) {
            this.listeners.set(type, handlers.filter(h => h !== handler));
        }
    }

    /**
     * 싱글톤 인스턴스 획득
     */
    static getInstance(): GameWebSocket {
        if (!GameWebSocket.instance) {
            GameWebSocket.instance = new GameWebSocket();
        }
        return GameWebSocket.instance;
    }

    /**
     * 유저 정보 설정 (연결 전에 호출)
     */
    setUser(username: string) {
        this.username = username;
        this.token = localStorage.getItem('token') || '';
    }

    getUsername(): string {
        return this.username;
    }

    // 콜백 설정 메서드들
    onMessage(handler: MessageHandler) {
        this.onMessageHandler = handler;
        return this;
    }

    onConnect(handler: () => void) {
        this.onConnectHandler = handler;
        return this;
    }

    onError(handler: (error: string) => void) {
        this.onErrorHandler = handler;
        return this;
    }

    onClose(handler: () => void) {
        this.onCloseHandler = handler;
        return this;
    }

    // WebSocket 연결
    connect(): Promise<void> {
        // 이미 연결되어 있으면 바로 resolve
        if (this.isConnected()) {
            console.log('✅ WebSocket 이미 연결됨');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                // JWT 토큰을 쿼리 파라미터로 전달 (백엔드 JwtHandshakeInterceptor 요구)
                const apiBase = API_BASE_URL;
                const wsBase = apiBase.replace('http', 'ws').replace('/api', '/ws/game');
                const wsUrl = `${wsBase}?token=${this.token}`;
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('✅ WebSocket 연결됨');
                    this.onConnectHandler?.();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: GameMessage = JSON.parse(event.data);
                        // UPDATE 메시지는 너무 빈번하므로 로그에서 제외
                        if (message.type !== 'UPDATE') {
                            // console.log('📩 수신:', message);
                        }

                        // 에러 메시지 처리
                        if (message.type === 'ERROR') {
                            this.onErrorHandler?.(message.content || '알 수 없는 오류');
                        }

                        // 1. 레거시 핸들러 실행
                        this.onMessageHandler?.(message);

                        // 2. 이벤트 리스너 실행
                        const listeners = this.listeners.get(message.type);
                        if (listeners) {
                            listeners.forEach(handler => handler(message));
                        }
                    } catch (e) {
                        console.error('메시지 파싱 오류:', e);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket 오류:', error);
                    this.onErrorHandler?.('WebSocket 연결 오류');
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log('WebSocket 연결 종료');
                    this.ws = null;
                    this.onCloseHandler?.();
                };

            } catch (e) {
                console.error('WebSocket 연결 실패:', e);
                reject(e);
            }
        });
    }

    // 메시지 전송
    send(message: GameMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (message.type !== 'MOVE') {
                console.log('📤 전송:', message);
            }
            this.ws.send(JSON.stringify(message));
        } else {
            // MOVE 메시지는 빈번하므로 연결 끊김 경고를 로그에 남기지 않음 (스팸 방지)
            if (message.type !== 'MOVE') {
                console.warn('WebSocket이 연결되지 않음. Message:', message.type);
            }
        }
    }

    // 방 생성 요청
    createRoom() {
        this.send({
            type: 'CREATE',
            username: this.username
        });
    }

    // 방 참가 요청
    joinRoom(roomId: string) {
        this.send({
            type: 'JOIN',
            roomId: roomId,
            username: this.username
        });
    }

    /**
     * 플레이어 상태 전송 (Client-Authoritative: 위치 기반)
     * @param roomId 방 ID
     * @param x X 좌표
     * @param y Y 좌표
     * @param vx X 속도
     * @param vy Y 속도
     * @param anim 애니메이션 키
     */
    sendPlayerState(roomId: string, x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[]) {
        if (!this.isConnected()) return;

        // [DEBUG] 전송 데이터 확인 (1초에 한 번 정도만 출력 추천하지만, 여기선 매번 출력은 부담되므로 샘플링하거나 일단 전체 출력)
        // console.log(`[SendState] Vel(${vx.toFixed(2)}, ${vy.toFixed(2)})`);

        const message: GameMessage = {
            type: 'MOVE', // 서버의 handleMove 매핑
            roomId: roomId,
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            anim: anim,
            content: '', // 필수 필드
            isDead: isDead,
            curses: curses
        };
        this.ws?.send(JSON.stringify(message));
    }

    /**
     * Ready 상태 변경 (비방장용)
     * @param roomId 방 ID
     * @param isReady Ready 여부
     */
    sendReady(roomId: string, isReady: boolean) {
        this.send({
            type: 'READY',
            roomId: roomId,
            username: this.username,
            content: String(isReady)
        });
    }

    /**
     * 게임 시작 요청 (방장만)
     * @param roomId 방 ID
     */
    sendStartGame(roomId: string) {
        this.send({
            type: 'START_GAME',
            roomId: roomId,
            username: this.username
        });
    }

    /**
     * 다음 스테이지 진행 (방장만)
     * @param roomId 방 ID
     */
    sendNextStage(roomId: string) {
        this.send({
            type: 'NEXT_STAGE',
            roomId: roomId,
            username: this.username
        });
    }

    /**
     * 스테이지 선택 알림 (방장 -> 서버 -> 모두)
     */
    selectStage(roomId: string, stageNum: number) {
        this.send({
            type: 'STAGE_SELECT',
            roomId: roomId,
            username: this.username,
            stage: stageNum
        });
    }

    /**
     * 스테이지 클리어 알림 (방장 -> 서버 -> 모두)
     */
    clearStageSync(roomId: string, stageNum: number) {
        this.send({
            type: 'STAGE_CLEAR',
            roomId: roomId,
            username: this.username,
            stage: stageNum
        });
    }

    /**
     * 방 퇴장 (로비로 이동)
     * @param roomId 방 ID
     */
    sendLeave(roomId: string) {
        this.send({
            type: 'LEAVE',
            roomId: roomId,
            username: this.username
        });
    }

    /**
     * 일시정지 요청
     */
    sendPauseRequest(roomId: string) {
        this.send({
            type: 'PAUSE_GAME',
            roomId: roomId,
            username: this.username
        });
    }

    /**
     * 재개 요청
     */
    sendResumeRequest(roomId: string) {
        this.send({
            type: 'RESUME_GAME',
            roomId: roomId,
            username: this.username
        });
    }

    /**
     * 발화 배치 분석 요청 (STT)
     */
    sendSpeechBatch(roomId: string, texts: string[]) {
        this.send({
            type: 'SPEECH_BATCH',
            roomId: roomId,
            username: this.username,
            texts: texts
        });
    }

    /**
     * 저주 해제 요청 (긍정어)
     */
    sendCurseRelease(roomId: string, positiveWord: string) {
        this.send({
            type: 'CURSE_RELEASE',
            roomId: roomId,
            username: this.username,
            word: positiveWord
        });
    }

    /**
     * 자동 기믹(엘리베이터 등) 동기화 - 호스트 전용
     * @param roomId 방 ID
     * @param data 기믹 상태 리스트 (JSON stringified)
     */
    sendGimmickUpdate(roomId: string, data: string) {
        this.send({
            type: 'GIMMICK_UPDATE',
            roomId: roomId,
            username: this.username,
            content: data
        });
    }

    /**
     * 미는 박스 동기화 - 인터랙터 전용
     * @param roomId 방 ID
     * @param data 박스 상태 리스트 (JSON stringified)
     */
    sendBlockUpdate(roomId: string, data: string) {
        this.send({
            type: 'BLOCK_UPDATE',
            roomId: roomId,
            username: this.username,
            content: data
        });
    }

    /**
     * 게임 리셋 요청 - 사망 시 등
     * @param roomId 방 ID
     */
    sendGameReset(roomId: string) {
        this.send({
            type: 'GAME_RESET',
            roomId: roomId,
            username: this.username
        });
    }

    // PING 전송 (Keep-alive)
    ping() {
        this.send({
            type: 'PING',
            content: String(Date.now())
        });
    }

    // 연결 종료
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    // 연결 상태 확인
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    // 인스턴스 완전 초기화 (로그아웃 시 등)
    static resetInstance() {
        if (GameWebSocket.instance) {
            GameWebSocket.instance.disconnect();
            GameWebSocket.instance = null;
        }
    }
}

// 싱글톤 인스턴스 export
export const gameWebSocket = GameWebSocket.getInstance();

// 타입만 export (하위 호환용)
export { GameWebSocket };
