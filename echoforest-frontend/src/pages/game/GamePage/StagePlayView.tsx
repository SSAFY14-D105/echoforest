/**
 * StagePlayView - 멀티플레이 스테이지 플레이 화면
 */

import { useState, useRef, useEffect } from 'react';
import PhaserGame from '../../../phaser/PhaserGame';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import FloatingButton from '../../../components/stt/FloatingButton';
import CurseStackBar from '../../../components/stt/CurseStackBar';
import EndingMissionOverlay from '../../../components/game/EndingMissionOverlay/EndingMissionOverlay';
import { useGameStore } from '../../../store/useGameStore';
import { liveKitService } from '../../../socket/LiveKitService';
import type { ParticipantInfo } from '../../../socket/LiveKitService';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import { uploadAllEndingCaptures } from '../../../apis/imageApi';
import styles from './GamePage.module.css';

interface StagePlayViewProps {
    roomId: string;
    currentStage: string;
    pausedBy: string | null;
    isSoloMode: boolean;
    curseState: {
        stack: number;
        cursedPlayer: string | null;
    };
    isListening: boolean;
    boosterActive: boolean;
    setBoosterMode: (active: boolean) => void;
    onSendState: (x: number, y: number, vx: number, vy: number, anim: string, isDead: boolean, curses: string[], isHidden?: boolean) => void;
    onCopyRoomId: () => void;
    onClearStage: (stageId: string) => void;
}

export default function StagePlayView({
    roomId,
    currentStage,
    pausedBy,
    isSoloMode,
    curseState,
    isListening,
    boosterActive,
    setBoosterMode,
    onSendState,
    onCopyRoomId,
    onClearStage,
}: StagePlayViewProps) {
    const stageNum = currentStage.replace('MULTI_', '');

    // 엔딩 미션 상태
    const { isEndingMission, setEndingMission, nickname, players, isHost } = useGameStore();
    const [participantInfos, setParticipantInfos] = useState<ParticipantInfo[]>([]);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // LiveKit 참가자 정보 구독
    useEffect(() => {
        liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });
    }, []);

    // 서버로부터 엔딩 미션 시작/종료 이벤트 수신
    useEffect(() => {
        const handleEndingMissionStart = () => {
            console.log('[StagePlayView] Received ENDING_MISSION_START from server');
            setEndingMission(true);
        };

        const handleEndingMissionEnd = () => {
            console.log('[StagePlayView] Received ENDING_MISSION_END from server');
            setEndingMission(false);
            onClearStage(currentStage);
        };

        gameWebSocket.on('ENDING_MISSION_START', handleEndingMissionStart);
        gameWebSocket.on('ENDING_MISSION_END', handleEndingMissionEnd);

        return () => {
            gameWebSocket.off('ENDING_MISSION_START', handleEndingMissionStart);
            gameWebSocket.off('ENDING_MISSION_END', handleEndingMissionEnd);
        };
    }, [setEndingMission, onClearStage, currentStage]);

    // 엔딩 미션 시 이미지 캡처 완료 핸들러
    const handleCaptureComplete = async (captures: Blob[]) => {
        try {
            const stageNumber = parseInt(stageNum, 10);
            const participantUserIds = players
                .filter(p => p.nickname !== nickname)
                .map(p => parseInt(p.id, 10))
                .filter(id => !isNaN(id));

            // 실제 userId는 localStorage에서 가져옴
            const userId = parseInt(localStorage.getItem('loginId') || '0', 10);

            if (userId > 0) {
                await uploadAllEndingCaptures(
                    captures,
                    userId,
                    stageNumber,
                    participantUserIds,
                    roomId
                );
                console.log('[StagePlayView] Ending captures uploaded successfully');
            }
        } catch (error) {
            console.error('[StagePlayView] Failed to upload captures:', error);
        }
    };

    // 엔딩 미션 종료 핸들러 (로컬에서 닫기 버튼 클릭 시)
    const handleEndingMissionClose = () => {
        // 호스트인 경우 서버로 종료 신호 전송 (다른 클라이언트 동기화)
        if (isHost) {
            gameWebSocket.sendEndingMissionEnd(roomId);
        }
        setEndingMission(false);
        // 스테이지 클리어 처리
        onClearStage(currentStage);
    };

    // 테스트 버튼용: 호스트가 엔딩 미션 시작 (서버 동기화)
    const handleTestEndingMission = () => {
        if (isHost) {
            // 서버로 엔딩 미션 시작 신호 전송 (다른 클라이언트 동기화)
            gameWebSocket.sendEndingMissionStart(roomId);
        }
        // 로컬에서도 즉시 시작
        setEndingMission(true);
    };

    return (
        <div className={styles.gameContainer}>
            <PauseOverlay pausedBy={pausedBy} />
            <div className={`pixel-box ${styles.canvasWrapper}`}>
                <PhaserGame
                    startScene={`Stage${stageNum}Scene`}
                    onSendState={onSendState}
                    isSoloMode={isSoloMode}
                />
                <div className={styles.gameInfo}>
                    🎮 Stage {stageNum} 진행 중 | Room: <span className={styles.roomId}>{roomId}</span>
                    <button className={styles.copyBtn} onClick={onCopyRoomId} title="방 코드 복사">📋</button>
                </div>
                <button
                    className={styles.testClearBtn}
                    onClick={handleTestEndingMission}
                >
                    🏆 테스트: 엔딩 미션 시작
                </button>
                <CurseStackBar
                    stack={curseState.stack}
                    cursedPlayer={curseState.cursedPlayer}
                    isListening={isListening}
                />
            </div>
            <CameraArea />
            <FloatingButton
                onPress={() => setBoosterMode(true)}
                onRelease={() => setTimeout(() => setBoosterMode(false), 3000)}
                isActive={boosterActive}
            />

            {/* 엔딩 미션 오버레이 */}
            {isEndingMission && (
                <EndingMissionOverlay
                    participantInfos={participantInfos}
                    localVideoRef={localVideoRef}
                    nickname={nickname}
                    onCaptureComplete={handleCaptureComplete}
                    onClose={handleEndingMissionClose}
                />
            )}
        </div>
    );
}


