/**
 * 게임 WebSocket 클라이언트 (싱글톤)
 * 백엔드 GameMessageDto와 동일한 형식 사용
 * 
 * - 로비에서 연결 후 GamePage로 이동해도 연결 유지
 * - getInstance()로 전역 인스턴스 접근
 */

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
    | 'PLAYER_LEFT'   // Server→Others: 플레이어 퇴장
    | 'ROOM_CLOSED'   // Server→All: 방 폭파 (방장 퇴장)
    | 'KICKED';       // Server→Client: 강제 퇴장됨

// UPDATE 메시지에서 오는 플레이어 상태
export interface ServerPlayerState {
    id: string;          // username
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    hp: number;
    isDead: boolean;
    curses: string[];
    serverTick?: number;
}

export interface GameMessage {
    type: MessageType;
    roomId?: string;
    username?: string;
    x?: number;
    y?: number;
    anim?: string;
    content?: string;  // 시스템 메시지, 입력 타입, UPDATE 플레이어 데이터
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
                const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://i14d105.p.ssafy.io/api';
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
                            console.log('📩 수신:', message);
                        }

                        // 에러 메시지 처리
                        if (message.type === 'ERROR') {
                            this.onErrorHandler?.(message.content || '알 수 없는 오류');
                        }

                        this.onMessageHandler?.(message);
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
            console.warn('WebSocket이 연결되지 않음');
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
     * 입력 전송 (백엔드 GameService.handleMove 형식)
     * @param roomId 방 ID
     * @param inputType 입력 타입: LEFT_DOWN, LEFT_UP, RIGHT_DOWN, RIGHT_UP, JUMP
     */
    sendInput(roomId: string, inputType: string) {
        this.send({
            type: 'MOVE',
            roomId: roomId,
            username: this.username,
            content: inputType  // 백엔드는 content 또는 anim 필드에서 inputType을 읽음
        });
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
