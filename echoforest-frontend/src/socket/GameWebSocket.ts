/**
 * 게임 WebSocket 클라이언트 (싱글톤)
 * 백엔드 GameMessageDto와 동일한 형식 사용
 * 
 * - 로비에서 연결 후 GamePage로 이동해도 연결 유지
 * - getInstance()로 전역 인스턴스 접근
 */

// 백엔드와 동일한 메시지 타입
export type MessageType =
    | 'CREATE'
    | 'JOIN'
    | 'MOVE'
    | 'LEAVE'
    | 'PING'
    | 'PONG'
    | 'ERROR'
    | 'ROOM_CREATED'
    | 'ROOM_STATE'    // 기존 플레이어 목록 전달
    | 'START'         // 게임 시작
    | 'STAGE_SELECT'  // 스테이지 선택
    | 'STAGE_CLEAR';  // 스테이지 클리어

// 플레이어 정보 (ROOM_STATE에서 사용)
export interface PlayerInfo {
    username: string;
    isHost: boolean;
    x?: number;
    y?: number;
}

export interface GameMessage {
    type: MessageType;
    roomId?: string;
    username?: string;
    x?: number;
    y?: number;
    anim?: string;
    content?: string;      // 시스템 메시지 (방 코드, 에러 메시지 등)
    players?: PlayerInfo[]; // ROOM_STATE: 기존 플레이어 목록
    stage?: number;        // STAGE_SELECT, STAGE_CLEAR: 스테이지 번호
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
                const wsUrl = `wss://i14d105.p.ssafy.io/ws/game?token=${this.token}`;
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('✅ WebSocket 연결됨');
                    this.onConnectHandler?.();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: GameMessage = JSON.parse(event.data);
                        // 'MOVE' 메시지는 너무 빈번하므로 로그에서 제외
                        if (message.type !== 'MOVE') {
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
    createRoom(roomId?: string) {
        this.send({
            type: 'CREATE',
            roomId: roomId,  // 없으면 백엔드가 생성
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

    // 이동 메시지 전송
    move(roomId: string, x: number, y: number, anim?: string) {
        this.send({
            type: 'MOVE',
            roomId: roomId,
            username: this.username,
            x: x,
            y: y,
            anim: anim
        });
    }

    // 게임 시작 요청 (호스트만)
    startGame(roomId: string) {
        this.send({
            type: 'START',
            roomId: roomId,
            username: this.username
        });
    }

    // 스테이지 선택 (호스트만)
    selectStage(roomId: string, stage: number) {
        this.send({
            type: 'STAGE_SELECT',
            roomId: roomId,
            username: this.username,
            stage: stage
        });
    }

    // 스테이지 클리어 브로드캐스트 (호스트만)
    clearStageSync(roomId: string, stage: number) {
        this.send({
            type: 'STAGE_CLEAR',
            roomId: roomId,
            username: this.username,
            stage: stage
        });
    }

    // 방 나가기
    leave(roomId: string) {
        this.send({
            type: 'LEAVE',
            roomId: roomId,
            username: this.username
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
