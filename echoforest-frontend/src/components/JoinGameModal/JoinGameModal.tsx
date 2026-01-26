import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { gameWebSocket } from '../../socket/GameWebSocket';
import type { GameMessage } from '../../socket/GameWebSocket';
import { API_BASE_URL } from '../../config';
import styles from './JoinGameModal.module.css';

interface JoinGameModalProps {
    nickname: string;
    onClose: () => void;
}

export default function JoinGameModal({ nickname, onClose }: JoinGameModalProps) {
    const { joinGame } = useGameStore();

    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [joinError, setJoinError] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);

    // 방 참가하기 (WebSocket JOIN 메시지 전송)
    const handleJoinSubmit = async () => {
        setJoinError('');

        if (!/^[A-Za-z0-9]{6}$/.test(roomCodeInput)) {
            setJoinError('6자리 코드를 입력해주세요. (영문+숫자)');
            return;
        }

        if (isConnecting) return;
        setIsConnecting(true);

        const roomCode = roomCodeInput.toUpperCase();

        try {
            // 1. REST API로 방 정보 먼저 확인 (방 존재 여부 및 호스트 확인)
            const apiBase = API_BASE_URL;
            const response = await fetch(`${apiBase}/rooms/${roomCode}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('해당하는 방을 찾을 수 없습니다.');
                }
                throw new Error('방 정보를 가져오는 데 실패했습니다.');
            }

            const roomInfo = await response.json();
            console.log('📋 방 정보 조회 성공:', roomInfo);

            // 내가 호스트인지 확인 (닉네임 기준)
            const amIHost = roomInfo.hostId === nickname;

            // 2. WebSocket 연결 및 JOIN 메시지 전송
            gameWebSocket.setUser(nickname);

            let hasWSError = false;

            // 임시 메시지 핸들러 등록
            const messageHandler = (message: GameMessage) => {
                if (message.type === 'ERROR') {
                    hasWSError = true;
                    const errorMsg = message.content?.includes('Room is full')
                        ? '방이 가득 찼습니다.'
                        : message.content || '입장 중 오류가 발생했습니다.';
                    setJoinError(errorMsg);
                    setIsConnecting(false);
                    gameWebSocket.disconnect();
                }
            };

            // 임시 에러 핸들러 등록
            const errorHandler = (error: string) => {
                hasWSError = true;
                setJoinError(error);
                setIsConnecting(false);
            };

            gameWebSocket.onMessage(messageHandler);
            gameWebSocket.onError(errorHandler);

            await gameWebSocket.connect();
            gameWebSocket.joinRoom(roomCode);

            // 3. 잠시 후 게임 페이지로 이동 (에러가 없을 경우)
            setTimeout(() => {
                if (!hasWSError) {
                    console.log(`🚀 방 입장 성공: ${roomCode} (Host: ${amIHost}, Stage: ${roomInfo.currentStage})`);

                    // 핸들러 정리는 페이지 이동 후 GamePage에서 다시 설정되므로 자연스럽게 교체됨
                    // 하지만 명시적으로 정리해주는 것이 좋을 수 있음 (GameWebSocket 구조상 onMessage가 덮어씌워짐)

                    // API에서 받아온 현재 스테이지 정보를 store에 전달
                    joinGame(roomCode, amIHost, roomInfo.currentStage || 0);
                    onClose(); // 모달 닫기
                }
            }, 300);

        } catch (error: any) {
            console.error('방 참가 실패:', error);
            setJoinError(error.message || '서버 연결에 실패했습니다.');
            setIsConnecting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3>방 코드 입력</h3>
                <p className={styles.modalDesc}>공유받은 6자리 코드를 입력하세요</p>
                <input
                    type="text"
                    maxLength={6}
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className={styles.codeInput}
                    autoFocus
                    disabled={isConnecting}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinSubmit()}
                />
                {joinError && <p className={styles.error}>{joinError}</p>}
                <div className={styles.modalActions}>
                    <button
                        onClick={onClose}
                        className={styles.btnSecondary}
                        disabled={isConnecting}
                    >
                        취소
                    </button>
                    <button
                        onClick={handleJoinSubmit}
                        className={styles.btnPrimary}
                        disabled={isConnecting}
                    >
                        {isConnecting ? '연결 중...' : '입장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
