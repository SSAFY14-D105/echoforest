/**
 * StagePlayView - 멀티플레이 스테이지 플레이 화면
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import PhaserGame from '../../../phaser/PhaserGame';
import CameraArea from '../../../components/CameraArea/CameraArea';
import PauseOverlay from '../../../components/game/PauseOverlay';
import CurseStackBar from '../../../components/stt/CurseStackBar';
import EndingMissionOverlay from '../../../components/game/EndingMissionOverlay/EndingMissionOverlay';
import { useGameStore } from '../../../store/useGameStore';
import { liveKitService } from '../../../socket/LiveKitService';
import type { ParticipantInfo } from '../../../socket/LiveKitService';
import { gameWebSocket } from '../../../socket/GameWebSocket';
import { uploadAllEndingCaptures, generateCompositeImage } from '../../../apis/imageApi';
import ResultOverlay from '../../../components/game/ResultOverlay/ResultOverlay';
import AudioController from '../../../components/common/AudioController';
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
    onSendState,
    onCopyRoomId,
    onClearStage,
}: StagePlayViewProps) {
    const stageNum = currentStage.replace('MULTI_', '');

    // 엔딩 미션 상태
    const { isEndingMission, setEndingMission, nickname, isHost, leaveGame } = useGameStore();
    const [participantInfos, setParticipantInfos] = useState<ParticipantInfo[]>([]);

    // [NEW] 최종 결과 오버레이 상태
    const [showResultOverlay, setShowResultOverlay] = useState(false);

    // LiveKit 참가자 정보 구독
    useEffect(() => {
        const unsubscribe = liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });
        return unsubscribe;
    }, []);

    // 종료 처리 중복 방지 락
    const isProcessingEndRef = useRef(false);
    const isUploadingRef = useRef(false); // [FIX] 업로드 중복 방지 락
    // [NEW] 이미지 업로드 완료한 유저 ID 집합 (호스트가 추적)
    const uploadedUserIdsRef = useRef<Set<number>>(new Set());
    const hasGeneratedImageRef = useRef(false); // 이미 생성 요청했는지 여부

    // 서버로부터 엔딩 미션 시작/종료 이벤트 수신
    useEffect(() => {
        const handleEndingMissionStart = () => {
            setEndingMission(true);
        };

        const handleEndingMissionEnd = () => {
            // 오버레이만 닫음 - 실제 스테이지 전환은 STAGE_TRANSITION 메시지에서 처리
            setEndingMission(false);
        };

        gameWebSocket.on('ENDING_MISSION_START', handleEndingMissionStart);
        gameWebSocket.on('ENDING_MISSION_END', handleEndingMissionEnd);

        return () => {
            gameWebSocket.off('ENDING_MISSION_START', handleEndingMissionStart);
            gameWebSocket.off('ENDING_MISSION_END', handleEndingMissionEnd);
        };
    }, [setEndingMission, onClearStage, currentStage]);

    // [FIX] 스테이지 변경 시 상태 리셋 (중요: 이전 스테이지 업로드 기록이 남아서 다음 스테이지 합성을 방해하는 문제 해결)
    useEffect(() => {
        uploadedUserIdsRef.current.clear();
        hasGeneratedImageRef.current = false;
        isUploadingRef.current = false;
        console.log(`[StagePlayView] State reset for new Stage: ${stageNum}`);
    }, [stageNum]);

    // [NEW] LiveKit 데이터 수신 (IMAGE_UPLOADED)
    useEffect(() => {
        const handleDataReceived = (payload: Uint8Array) => {
            try {
                const message = new TextDecoder().decode(payload);

                // [FIX] JSON 파싱 시도, 실패하면 plain text로 처리
                try {
                    const data = JSON.parse(message);

                    if (data.type === 'IMAGE_UPLOADED' && data.stage === stageNum) {
                        console.log(`[StagePlayView] User ${data.userId} uploaded image for stage ${stageNum}`);

                        // 호스트라면 업로드 카운트 추적 및 합성 트리거
                        if (isHost) {
                            uploadedUserIdsRef.current.add(data.userId);
                            checkAndGenerateComposite();
                        }
                    }
                } catch (parseErr) {
                    // Plain text 메시지 (예: "POSE_CLEARED")는 무시
                    // 다른 컴포넌트(EndingMissionOverlay)에서 처리함
                }
            } catch (err) {
                console.error('[StagePlayView] Failed to decode data message:', err);
            }
        };

        const unsubscribe = liveKitService.onDataReceived(handleDataReceived);
        return unsubscribe;
    }, [isHost, stageNum, participantInfos]);

    // 호스트 전용: 모든 참가자가 업로드했는지 확인하고 합성 요청
    const checkAndGenerateComposite = async () => {
        if (hasGeneratedImageRef.current) return;

        const currentCount = uploadedUserIdsRef.current.size;
        // Solo모드거나 참가자가 없으면(1명) 1명만 체크. 멀티면 (participantInfos.length + 1) 체크 (participantInfos는 원격 참가자만 포함하므로)
        const requiredCount = isSoloMode ? 1 : (participantInfos.length + 1);

        console.log(`[StagePlayView] Check Generation: ${currentCount}/${requiredCount} uploaded. (isSolo=${isSoloMode}, remotes=${participantInfos.length})`);

        if (currentCount >= requiredCount) {
            console.log('[StagePlayView] All participants uploaded! Generating composite...');
            hasGeneratedImageRef.current = true;

            try {
                const storedUserId = localStorage.getItem('userId');
                const hostUserId = storedUserId ? parseInt(storedUserId, 10) : 0;
                // 호스트가 대표로 요청
                await generateCompositeImage(roomId, hostUserId, parseInt(stageNum));
                console.log('[StagePlayView] Composite generation requested successfully.');
            } catch (error) {
                console.error('[StagePlayView] Composite generation failed:', error);
            }
        }
    };

    // 엔딩 미션 시 이미지 캡처 완료 핸들러
    const handleCaptureComplete = async (captures: Blob[]) => {
        // [FIX] 업로드 중복 방지
        if (isUploadingRef.current) return;
        isUploadingRef.current = true;

        // console.log('[StagePlayView] handleCaptureComplete called with', captures.length, 'captures');

        if (captures.length === 0) {
            console.warn('[StagePlayView] No captures to upload!');
            return;
        }

        try {
            const stageNumber = parseInt(stageNum, 10);

            // 실제 userId는 localStorage에서 가져옴 (LoginForm에서 'userId'로 저장)
            const storedUserId = localStorage.getItem('userId');
            const userId = storedUserId ? parseInt(storedUserId, 10) : 0;

            // console.log('[StagePlayView] Upload params:', { loginId, userId, stageNumber, roomId });

            if (!userId || isNaN(userId) || userId <= 0) {
                console.warn('[StagePlayView] loginId not found in localStorage, skipping upload');
                // console.log('[StagePlayView] Available localStorage keys:', Object.keys(localStorage));
                return;
            }

            // 참가자 ID: 현재 구조에서는 nickname을 ID로 사용하므로 빈 배열로 전송
            // TODO: 백엔드와 협의하여 실제 userId를 동기화
            const participantUserIds: number[] = [];

            // console.log('[StagePlayView] Calling uploadAllEndingCaptures...');
            await uploadAllEndingCaptures(
                captures,
                userId,
                stageNumber,
                participantUserIds,
                roomId
            );

            // 2. [NEW] LiveKit으로 '업로드 완료' 신호 전송
            if (liveKitService.isConnected) {
                const msg = JSON.stringify({ type: 'IMAGE_UPLOADED', stage: stageNum, userId });
                await liveKitService.sendData(msg);
            } else {
                console.warn('[StagePlayView] LiveKit not connected, cannot send upload signal.');
            }

            // [HOST SELF CHECK] 내가 호스트라면 내 업로드도 카운트에 포함
            if (isHost) {
                uploadedUserIdsRef.current.add(userId);
                checkAndGenerateComposite();
            }

            // 싱글 모드거나 연결 안된 경우 (Fallback): 즉시 생성 시도
            if (isSoloMode || !liveKitService.isConnected) {
                if (!isHost) {
                    // 싱글모드인데 호스트가 아닐리 없지만, 혹시 모를 경우 직접 요청
                    // (다만 generateCompositeImage는 DB이미지 쓰므로 업로드 직후 호출하면 됨)
                    try {
                        await generateCompositeImage(roomId, userId, stageNumber);
                    } catch (e) { console.error(e); }
                }
            }
        } catch (error) {
            console.error('[StagePlayView] Failed to upload captures:', error);
        }
    };

    // 엔딩 미션 종료 핸들러 (오버레이 닫기/캡처 완료 시)
    const handleEndingMissionClose = useCallback(() => {
        // [FIX] 중복 호출 방지 (Ref 사용)
        if (isProcessingEndRef.current) return;

        // [NEW] 스테이지 4라면 결과 화면을 보여줌 (종료 프로세스 중단)
        if (stageNum === '4') {
            setShowResultOverlay(true);
            return;
        }

        isProcessingEndRef.current = true;

        // [FIX] 중복 방지: 호스트만 종료 신호를 보내도록 변경
        // 이렇게 하면 서버가 여러 번 ENDING_MISSION_END를 브로드캐스트하는 것을 근본적으로 방지 가능
        if (isHost && isEndingMission) {
            gameWebSocket.sendEndingMissionEnd(roomId);

            // [FIX] 서버가 ENDING_MISSION_END만으로 스테이지 전환을 안 할 경우 대비해 명시적 전환 요청
            setTimeout(() => {
                gameWebSocket.sendNextStage(roomId);
            }, 500); // 0.5초 딜레이로 순서 보장
        }

        // 안전장치: 10초 후 락 해제 (혹시 모를 상황 대비)
        setTimeout(() => {
            isProcessingEndRef.current = false;
            isUploadingRef.current = false; // [FIX] 업로드 락도 함께 해제
        }, 10000);
    }, [isHost, isEndingMission, roomId, stageNum]);

    // 최종 결과 화면 닫기 (메인으로 이동 또는 완전 종료)
    const handleResultClose = () => {
        leaveGame();
    };

    // 테스트 버튼용: 호스트가 엔딩 미션 시작 (서버가 모든 클라이언트에 브로드캐스트)
    const handleTestEndingMission = () => {
        if (isHost) {
            // 서버로 엔딩 미션 시작 신호 전송 → 서버가 ENDING_MISSION_START 브로드캐스트
            // 모든 클라이언트가 handleEndingMissionStart 이벤트로 동시 시작
            gameWebSocket.sendEndingMissionStart(roomId);
        } else {
            // 비호스트는 서버 브로드캐스트를 기다림 (호스트에게 테스트 요청)
            alert('호스트만 테스트를 시작할 수 있습니다.');
        }
    };

    return (
        <div className={styles.gameContainer}>
            <PauseOverlay pausedBy={pausedBy} />
            {/* [FIX] participantInfos 전달하여 원격 비디오 표시 */}
            {/* 상단 영역: 카메라 2개 + 정보 패널 + 카메라 2개 */}
            <div className={styles.topSection}>
                <CameraArea
                    startSlot={0}
                    endSlot={2}
                    participantInfos={participantInfos}
                    isLiveKitConnected={liveKitService.isConnected}
                />

                {/* 정보 패널 */}
                <div className={styles.infoPanel}>
                    <div
                        className={styles.roomInfo}
                        onClick={onCopyRoomId}
                        title="클릭하여 방 코드 복사"
                    >
                        🎮 Stage {stageNum} | Room: <span className={styles.roomId}>{roomId}</span>
                    </div>
                    {/* 저주 스택 바 이동 */}
                    <CurseStackBar
                        stack={curseState.stack}
                        cursedPlayer={curseState.cursedPlayer}
                        isListening={isListening}
                    />
                </div>

                <CameraArea
                    startSlot={2}
                    endSlot={4}
                    participantInfos={participantInfos}
                    isLiveKitConnected={liveKitService.isConnected}
                />
            </div>

            <div className={`pixel-box ${styles.canvasWrapper}`}>
                <AudioController className={styles.gameAudioController} />
                <PhaserGame
                    startScene={`Stage${stageNum}Scene`}
                    onSendState={onSendState}
                    isSoloMode={isSoloMode}
                />
                <button
                    className={styles.testClearBtn}
                    onClick={handleTestEndingMission}
                >
                    🏆 테스트: 엔딩 미션 시작
                </button>
            </div>
            {/* CameraArea moved to top */}

            {/* 엔딩 미션 오버레이 */}
            {isEndingMission && !showResultOverlay && (
                <EndingMissionOverlay
                    participantInfos={participantInfos}
                    nickname={nickname}
                    roomId={roomId}
                    stage={parseInt(stageNum)}
                    onCaptureComplete={handleCaptureComplete}
                    onClose={handleEndingMissionClose}
                />
            )}

            {/* [NEW] 최종 결과 화면 (스테이지 4 전용) */}
            {showResultOverlay && (
                <ResultOverlay
                    roomId={roomId}
                    onClose={handleResultClose}
                />
            )}
        </div>
    );
}


