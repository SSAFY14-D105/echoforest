/**
 * 게임 WebSocket 클라이언트
 * 백엔드 GameMessageDto와 동일한 형식 사용
 */

// 백엔드와 동일한 메시지 타입
export interface GameMessage {
    type: 'CREATE' | 'JOIN' | 'MOVE' | 'PING' | 'PONG' | 'ERROR' | 'ROOM_CREATED' | 'LEAVE';
    roomId?: string;
    username?: string;
    x?: number;
    y?: number;
    anim?: string;
    content?: string;  // 시스템 메시지 (방 코드, 에러 메시지 등)
}

type MessageHandler = (message: GameMessage) => void;

export class GameWebSocket {
    private ws: WebSocket | null = null;
    private username: string;
    private token: string;
    private onMessageHandler: MessageHandler | null = null;
    private onConnectHandler: (() => void) | null = null;
    private onErrorHandler: ((error: string) => void) | null = null;
    private onCloseHandler: (() => void) | null = null;

    constructor(username: string) {
        this.username = username;
        this.token = localStorage.getItem('token') || '';
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
                        console.log('📩 수신:', message);

                        // 에러 메시지 처리
                        if (message.type === 'ERROR') {
                            this.onErrorHandler?.(message.content || '알 수 없는 오류');
                            return;
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
            console.log('📤 전송:', message);
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
}
