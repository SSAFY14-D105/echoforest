/**
 * WaitingRoom - 대기실 화면
 */

import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../../store/useGameStore';
import { liveKitService } from '../../../socket/LiveKitService';
import type { ParticipantInfo } from '../../../socket/LiveKitService';
import PhaserGame from '../../../phaser/PhaserGame';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import AudioController from '../../../components/common/AudioController';
import styles from './WaitingRoom.module.css';



interface WaitingRoomProps {
    roomId: string;
    isHost: boolean;
    isSoloMode: boolean;
    pausedBy: string | null;
    myReady: boolean;
    onSendState: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden?: boolean) => void;
    onCopyRoomId: () => void;
    onLeave: () => void;
    onToggleReady: () => void;
    onStartGame: () => void;
    onAddTestPlayer: () => void;
}

export default function WaitingRoom({
    roomId,
    isHost,
    isSoloMode,
    pausedBy,
    myReady,
    onSendState,
    onCopyRoomId,
    onToggleReady,
    onStartGame,
    onLeave,
}: WaitingRoomProps) {
    const { nickname, players, readyPlayers } = useGameStore(useShallow(state => ({
        nickname: state.nickname,
        players: state.players,
        readyPlayers: state.readyPlayers
    })));
    // check allReady inside component
    const { isAllReady } = useGameStore.getState();
    const allReady = isAllReady();

    // LiveKit 참가자 정보 (WaitingRoom에서 관리하여 CameraArea에 전달)
    const [participantInfos, setParticipantInfos] = useState<ParticipantInfo[]>([]);
    const [isLiveKitConnected, setIsLiveKitConnected] = useState(false);

    // LiveKit 연결 (WaitingRoom 마운트 시 한 번만 실행)
    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;

        // 참가자 변경 구독 (먼저 등록해야 연결 완료 시 바로 업데이트 받음)
        const unsubscribeParticipants = liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });

        // [FIX] 연결 상태 구독 (다중 구독 지원)
        const unsubscribeConnected = liveKitService.onConnected(() => {
            // console.log('WaitingRoom: LiveKit Connected');
            setIsLiveKitConnected(true);
        });

        const unsubscribeDisconnected = liveKitService.onDisconnected(() => {
            // console.log('WaitingRoom: LiveKit Disconnected');
            setIsLiveKitConnected(false);
        });

        // 이미 연결되어 있으면 현재 상태 즉시 반영
        if (liveKitService.isConnected) {
            setIsLiveKitConnected(true);
        } else {
            // 아직 연결되지 않았으면 연결 시도
            const connectLiveKit = async () => {
                try {
                    await liveKitService.connect(roomId, nickname);
                    // 성공 시 onConnected 콜백이 호출됨
                } catch (error) {
                    console.error('LiveKit connection failed:', error);
                }
            };
            connectLiveKit();
        }

        return () => {
            unsubscribeParticipants();
            unsubscribeConnected();
            unsubscribeDisconnected();
            // 연결 해제는 GamePage에서 처리 (WaitingRoom이 언마운트되도 게임으로 전환될 수 있음)
        };
    }, [roomId, nickname, isSoloMode]);

    // [NEW] 나가기 버튼 핸들러
    const handleLeave = () => {
        const message = isHost
            ? '방장이 나가면 방이 사라집니다. 정말 나가시겠습니까?'
            : '정말 대기실을 나가시겠습니까?';

        if (window.confirm(message)) {
            onLeave();
        }
    };

    return (
        <div className={styles.waitingRoomContainer}>
            <PauseOverlay pausedBy={pausedBy} />

            {/* 상단 영역: 카메라 2개 + 정보 패널 + 카메라 2개 */}
            <div className={styles.topSection}>
                {/* 왼쪽 카메라 2개 */}
                <CameraArea
                    startSlot={0}
                    endSlot={2}
                    participantInfos={participantInfos}
                    isLiveKitConnected={isLiveKitConnected}
                />

                {/* 정보 패널 */}
                <div className={styles.infoPanel}>
                    <div
                        className={styles.roomInfo}
                        onClick={onCopyRoomId}
                        title="클릭하여 방 코드 복사"
                    >
                        🎮 대기실 | Room: <span className={styles.roomId}>{roomId}</span>
                    </div>



                    {isHost ? (
                        <button
                            className={`${styles.actionBtn} ${(!isSoloMode && players.length > 1 && !allReady) || !isLiveKitConnected ? '' : styles.readyActive}`}
                            onClick={onStartGame}
                            disabled={(!isSoloMode && players.length > 1 && !allReady) || !isLiveKitConnected}
                        >
                            {!isLiveKitConnected ? '연결 중...' : (!isSoloMode && players.length > 1 && !allReady ? '준비 대기중...' : '게임 시작')}
                        </button>
                    ) : (
                        <button
                            className={`${styles.actionBtn} ${myReady ? styles.readyActive : ''}`}
                            onClick={onToggleReady}
                            disabled={!isLiveKitConnected}
                            style={{ opacity: !isLiveKitConnected ? 0.6 : 1, cursor: !isLiveKitConnected ? 'not-allowed' : 'pointer' }}
                        >
                            {!isLiveKitConnected ? '연결 중...' : (myReady ? '준비 완료!' : '준비')}
                        </button>
                    )}

                    {!isSoloMode && players.length > 1 && (
                        <div className={styles.readyStatus}>
                            Ready: {readyPlayers.length}/{players.filter(p => !p.isHost).length - 1}
                            {allReady && <span className={styles.allReadyText}>✓ 전원 준비완료!</span>}
                        </div>
                    )}
                </div>

                {/* 오른쪽 카메라 2개 */}
                <CameraArea
                    startSlot={2}
                    endSlot={4}
                    participantInfos={participantInfos}
                    isLiveKitConnected={isLiveKitConnected}
                />
            </div>

            {/* 하단 게임 영역 */}
            <div className={styles.gameSection}>
                {/* [NEW] 나가기 버튼 */}
                <button
                    className={styles.gameLeaveButton}
                    onClick={handleLeave}
                >
                    ← 숲 입구로 나가기
                </button>

                <AudioController className={styles.gameAudioController} />
                <PhaserGame
                    startScene="LobbyScene"
                    onSendState={onSendState}
                    isSoloMode={isSoloMode}
                />
            </div>
        </div>
    );
}
