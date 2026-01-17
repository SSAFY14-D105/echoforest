// WebSocket 메시지 타입 정의
export interface WSMessage {
    type: 'JOIN' | 'MOVE' | 'LEAVE';
    playerId: string;
    x?: number;
    y?: number;
    anim?: string;
}

export class GameWebSocket {
    private ws: WebSocket | null = null;
    private roomId: string;
    private playerId: string;
    private onMessage: (message: WSMessage) => void;

    constructor(roomId: string, playerId: string, onMessage: (message: WSMessage) => void) {
        this.roomId = roomId;
        this.playerId = playerId;
        this.onMessage = onMessage;
    }

    connect() {
        try {
            // 백엔드 WebSocket 엔드포인트
            this.ws = new WebSocket(`ws://localhost:9001/ws/game?roomId=${this.roomId}&playerId=${this.playerId}`);

            this.ws.onopen = () => {
                console.log('WebSocket 연결됨');
                // JOIN 메시지 전송
                this.send({ type: 'JOIN', playerId: this.playerId });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WSMessage = JSON.parse(event.data);
                    this.onMessage(message);
                } catch (e) {
                    console.error('메시지 파싱 오류:', e);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket 오류:', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket 연결 종료');
            };
        } catch (e) {
            console.error('WebSocket 연결 실패:', e);
        }
    }

    send(message: WSMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    disconnect() {
        if (this.ws) {
            this.send({ type: 'LEAVE', playerId: this.playerId });
            this.ws.close();
            this.ws = null;
        }
    }
}
