/**
 * WaitingRoom - 대기실 화면
 */

import { useState, useEffect } from 'react';
import type { Player } from '../../../store/useGameStore';
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
    players: Player[];
    readyPlayers: string[];
    isHost: boolean;
    isSoloMode: boolean;
    pausedBy: string | null;
    myReady: boolean;
    allReady: boolean;
    onSendState: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden?: boolean) => void;
    onCopyRoomId: () => void;
    onLeave: () => void;
    onToggleReady: () => void;
    onStartGame: () => void;
    onAddTestPlayer: () => void;
}

export default function WaitingRoom({
    roomId,
    players,
    readyPlayers,
    isHost,
    isSoloMode,
    pausedBy,
    myReady,
    allReady,
    onSendState,
    onCopyRoomId,
    onToggleReady,
    onStartGame,
}: WaitingRoomProps) {
    const nickname = useGameStore(state => state.nickname);

    // LiveKit 참가자 정보 (WaitingRoom에서 관리하여 CameraArea에 전달)
    const [participantInfos, setParticipantInfos] = useState<ParticipantInfo[]>([]);
    const [isLiveKitConnected, setIsLiveKitConnected] = useState(false);

    // LiveKit 연결 (WaitingRoom 마운트 시 한 번만 실행)
    useEffect(() => {
        if (isSoloMode) return;
        if (!roomId || !nickname) return;

        // 참가자 변경 구독 (먼저 등록해야 연결 완료 시 바로 업데이트 받음)
        const unsubscribe = liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });

        // 이미 연결되어 있으면 현재 상태 즉시 반영
        if (liveKitService.isConnected) {
            setIsLiveKitConnected(true);
            // 이미 연결된 경우 현재 참가자 정보를 수동으로 트리거
            // (구독 콜백은 변경 시에만 호출되므로 초기값 필요)
        } else {
            // 아직 연결되지 않았으면 연결 시도
            const connectLiveKit = async () => {
                try {
                    await liveKitService.connect(roomId, nickname);
                    setIsLiveKitConnected(true);
                } catch (error) {
                    console.error('LiveKit connection failed:', error);
                }
            };
            connectLiveKit();
        }

        return () => {
            unsubscribe();
            // 연결 해제는 GamePage에서 처리 (WaitingRoom이 언마운트되도 게임으로 전환될 수 있음)
        };
    }, [roomId, nickname, isSoloMode]);

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
                            className={`${styles.actionBtn} ${(!isSoloMode && players.length > 1 && !allReady) ? '' : styles.readyActive}`}
                            onClick={onStartGame}
                            disabled={!isSoloMode && players.length > 1 && !allReady}
                        >
                            {!isSoloMode && players.length > 1 && !allReady ? '준비 대기중...' : '게임 시작'}
                        </button>
                    ) : (
                        <button
                            className={`${styles.actionBtn} ${myReady ? styles.readyActive : ''}`}
                            onClick={onToggleReady}
                        >
                            {myReady ? '준비 완료!' : '준비'}
                        </button>
                    )}

                    {!isSoloMode && players.length > 1 && (
                        <div className={styles.readyStatus}>
                            Ready: {readyPlayers.length}/{players.filter(p => !p.isHost).length}
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
