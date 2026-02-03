/**
 * StagePlayView - 멀티플레이 스테이지 플레이 화면
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import PhaserGame from '../../../phaser/PhaserGame';
import splashStyles from '../../../components/SplashScreen/SplashScreen.module.css';

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

    // [FIX] LiveKit 연결 상태 추적
    const [isLiveKitConnected, setIsLiveKitConnected] = useState(liveKitService.isConnected);
    // const { nickname } = useGameStore(); // 이미 상단에서 가져옴

    // LiveKit 참가자 정보 및 연결 상태 구독 + [FIX] 재접속(새로고침) 시 연결 복구
    useEffect(() => {
        // 1. 이벤트 구독
        const unsubscribeParticipants = liveKitService.onParticipantsChange((infos) => {
            setParticipantInfos(infos);
        });

        const unsubscribeConnected = liveKitService.onConnected(() => {
            // console.log('StagePlayView: LiveKit Connected');
            setIsLiveKitConnected(true);
            // [OPTIMIZATION] 게임 플레이 중에는 대역폭 절약을 위해 360p 사용
            liveKitService.setVideoResolution('h360');
        });

        const unsubscribeDisconnected = liveKitService.onDisconnected(() => {
            // console.log('StagePlayView: LiveKit Disconnected');
            setIsLiveKitConnected(false);
        });

        // 2. 초기 상태 동기화
        setIsLiveKitConnected(liveKitService.isConnected);

        // 3. [Critical Fix] 게임 중 새로고침 시 LiveKit 직접 연결 시도
        // WaitingRoom을 거치지 않고 바로 들어온 경우 연결이 끊겨있을 수 있음
        const ensureConnection = async () => {
            if (!liveKitService.isConnected && roomId && nickname) {
                // console.log('[StagePlayView] LiveKit not connected (refresh detected). Connecting...');
                try {
                    await liveKitService.connect(roomId, nickname);
                } catch (e) {
                    console.error('[StagePlayView] Failed to reconnect LiveKit:', e);
                }
            }
        };
        ensureConnection();

        return () => {
            unsubscribeParticipants();
            unsubscribeConnected();
            unsubscribeDisconnected();
        };
    }, [roomId, nickname]);

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
            console.log(`[handleEndingMissionEnd] Received! stageNum=${stageNum}`);
            // 오버레이만 닫음 - 실제 스테이지 전환은 STAGE_TRANSITION 메시지에서 처리
            setEndingMission(false);

            // [FIX] 마지막 스테이지(4)인 경우, 여기서 결과 화면으로 전환
            // 호스트가 보낸 ENDING_MISSION_END 신호를 받으면 호스트/게스트 모두 실행됨
            if (stageNum === '4') {
                console.log('[handleEndingMissionEnd] Stage 4 - Showing ResultOverlay!');
                setShowResultOverlay(true);
                setIsLoading(false); // 로딩 끝
            }
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
        isProcessingEndRef.current = false; // [FIX] 스테이지 변경 시 종료 처리 락 해제
    }, [stageNum]);

    // [NEW] LiveKit 데이터 수신 (IMAGE_UPLOADED, ALL_UPLOADS_COMPLETE)
    useEffect(() => {
        const handleDataReceived = (payload: Uint8Array) => {
            try {
                const message = new TextDecoder().decode(payload);

                // [FIX] JSON 파싱 시도, 실패하면 plain text로 처리
                try {
                    const data = JSON.parse(message);

                    if (data.type === 'IMAGE_UPLOADED' && data.stage === stageNum) {
                        console.log(`[handleDataReceived] IMAGE_UPLOADED from userId=${data.userId}, isHost=${isHost}`);
                        // 호스트라면 업로드 카운트 추적 및 합성 트리거
                        if (isHost) {
                            uploadedUserIdsRef.current.add(data.userId);
                            checkAndGenerateComposite();
                        }
                    }

                    // [NEW] 모든 업로드 완료 신호 수신 (호스트가 브로드캐스트)
                    if (data.type === 'ALL_UPLOADS_COMPLETE' && data.stage === stageNum) {
                        console.log(`[handleDataReceived] ALL_UPLOADS_COMPLETE for stage=${data.stage}`);

                        // 스테이지 4: "빠져나가는 중..." 로딩 2초 표시 후 결과 화면
                        if (stageNum === '4') {
                            console.log('[handleDataReceived] Stage 4 - Showing Loading then ResultOverlay!');
                            setLoadingMessage("메아리의 숲을 빠져나가는 중...");
                            setIsLoading(true);
                            setEndingMission(false); // 오버레이 닫기

                            // 2초 후 결과 화면 표시
                            setTimeout(() => {
                                setIsLoading(false);
                                setShowResultOverlay(true);
                                console.log('[handleDataReceived] ResultOverlay shown!');
                            }, 2000);
                        }
                        // 다른 스테이지는 WebSocket ENDING_MISSION_END / NEXT_STAGE가 처리
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
    }, [isHost, stageNum, participantInfos, setEndingMission]);

    // 호스트 전용: 모든 참가자가 업로드했는지 확인하고 합성 요청
    const checkAndGenerateComposite = async () => {
        if (hasGeneratedImageRef.current) return;

        const currentCount = uploadedUserIdsRef.current.size;
        // Solo모드거나 참가자가 없으면(1명) 1명만 체크. 멀티면 (participantInfos.length + 1) 체크 (participantInfos는 원격 참가자만 포함하므로)
        const requiredCount = isSoloMode ? 1 : (participantInfos.length + 1);

        // [DEBUG] 로그 출력으로 상태 확인
        console.log(`[checkAndGenerateComposite] current=${currentCount}, required=${requiredCount}, participantInfos.length=${participantInfos.length}`);

        if (currentCount >= requiredCount) {
            hasGeneratedImageRef.current = true;

            try {
                const storedUserId = localStorage.getItem('userId');
                const hostUserId = storedUserId ? parseInt(storedUserId, 10) : 0;
                // 호스트가 대표로 요청
                await generateCompositeImage(roomId, hostUserId, parseInt(stageNum));

                // [FIX] 모든 참가자 업로드 완료 후 스테이지 전환 또는 결과 화면
                if (isHost) {
                    if (stageNum === '4') {
                        console.log('[checkAndGenerateComposite] Stage 4 - Sending ENDING_MISSION_END via LiveKit');
                        // [FIX] LiveKit으로 직접 브로드캐스트 (서버 의존 제거)
                        // WebSocket보다 LiveKit이 더 신뢰성 있게 작동함 (IMAGE_UPLOADED도 LiveKit 사용)
                        if (liveKitService.isConnected) {
                            const signal = JSON.stringify({ type: 'ALL_UPLOADS_COMPLETE', stage: stageNum });
                            await liveKitService.sendData(signal);
                            console.log('[checkAndGenerateComposite] LiveKit signal sent!');
                        }

                        // [FIX] 호스트 자신은 LiveKit 메시지를 수신하지 못하므로 직접 상태 변경
                        console.log('[checkAndGenerateComposite] Host self-transition: Loading then ResultOverlay');
                        setEndingMission(false); // 오버레이 닫기
                        setLoadingMessage("메아리의 숲을 빠져나가는 중...");
                        setIsLoading(true);

                        // 2초 후 결과 화면 표시
                        setTimeout(() => {
                            setIsLoading(false);
                            setShowResultOverlay(true);
                            console.log('[checkAndGenerateComposite] Host ResultOverlay shown!');
                        }, 2000);

                        // WebSocket도 보내기 (서버 상태 업데이트용, 옵션)
                        gameWebSocket.sendEndingMissionEnd(roomId);
                    } else {
                        // 중간 스테이지: 다음 스테이지로 이동
                        // [FIX] LiveKit으로 브로드캐스트
                        if (liveKitService.isConnected) {
                            const signal = JSON.stringify({ type: 'ALL_UPLOADS_COMPLETE', stage: stageNum });
                            await liveKitService.sendData(signal);
                        }
                        gameWebSocket.sendEndingMissionEnd(roomId);
                        setTimeout(() => {
                            gameWebSocket.sendNextStage(roomId);
                        }, 500);
                    }
                }
            } catch (error) {
                console.error('[StagePlayView] Composite generation failed:', error);
            }
        }
    };

    // [NEW] 로딩 화면 오버레이
    const [loadingMessage, setLoadingMessage] = useState("숲이 변하고 있습니다...");

    // [NEW] 씬 로딩 상태 관리 (복구)
    const [isLoading, setIsLoading] = useState(false);
    const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadingStartTimeRef = useRef<number>(0); // [NEW] 로딩 시작 시간 기록

    // 스테이지 변경 시 로딩 시작
    useEffect(() => {
        setIsLoading(true);
        setLoadingMessage("숲이 변하고 있습니다..."); // 기본 메시지 리셋
        loadingStartTimeRef.current = Date.now(); // [NEW] 시작 시간 기록
        // console.log(`[StagePlayView] Stage changed to ${stageNum}, Loading Started`);

        // 안전장치: 5초 후에도 로딩이 안 끝나면 강제 종료
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
            if (isLoading) {
                // console.warn('[StagePlayView] Loading timeout - Forcing loading finish');
                setIsLoading(false);
            }
        }, 5000);

        return () => {
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        };
    }, [stageNum]);

    // 엔딩 미션 시 이미지 캡처 완료 핸들러
    const handleCaptureComplete = async (captures: Blob[]) => {
        // [FIX] 업로드 중복 방지
        if (isUploadingRef.current) return;
        isUploadingRef.current = true;

        // [B안] 스테이지 4는 모두 완료 후에만 로딩 화면 표시
        // 개인 완료 시점에는 포즈 오버레이에 머무름 ("✅ 촬영 완료!" 표시)
        // 로딩은 ALL_UPLOADS_COMPLETE 신호 수신 시 handleDataReceived에서 표시
        const isFinalStage = stageNum === '4';
        // (Stage 4에서는 여기서 setIsLoading(true) 안 함)

        if (captures.length === 0) {
            // console.warn('[StagePlayView] No captures to upload!');
            return;
        }

        try {
            const stageNumber = parseInt(stageNum, 10);

            // 실제 userId는 localStorage에서 가져옴 (LoginForm에서 'userId'로 저장)
            const storedUserId = localStorage.getItem('userId');
            const userId = storedUserId ? parseInt(storedUserId, 10) : 0;

            if (!userId || isNaN(userId) || userId <= 0) {
                // console.warn('[StagePlayView] loginId not found in localStorage, skipping upload');
                return;
            }

            // 참가자 ID: 현재 구조에서는 nickname을 ID로 사용하므로 빈 배열로 전송
            const participantUserIds: number[] = [];

            // 업로드 실행
            const uploadResults = await uploadAllEndingCaptures(
                captures,
                userId,
                stageNumber,
                participantUserIds,
                roomId
            );

            // [FIX] 업로드 성공한 경우에만 신호 전송 (빈 결과면 실패한 것)
            if (uploadResults && uploadResults.length > 0) {
                // 2. [NEW] LiveKit으로 '업로드 완료' 신호 전송
                if (liveKitService.isConnected) {
                    const msg = JSON.stringify({ type: 'IMAGE_UPLOADED', stage: stageNum, userId });
                    await liveKitService.sendData(msg);
                }

                // [HOST SELF CHECK] 내가 호스트라면 내 업로드도 카운트에 포함
                if (isHost) {
                    uploadedUserIdsRef.current.add(userId);
                    checkAndGenerateComposite();
                }
            } else {
                console.error('[StagePlayView] All capture uploads failed. Not sending signal.');
            }

            // 싱글 모드거나 연결 안된 경우 (Fallback): 즉시 생성 시도
            if (isSoloMode || !liveKitService.isConnected) {
                if (!isHost) {
                    try {
                        await generateCompositeImage(roomId, userId, stageNumber);
                    } catch (e) { console.error(e); }
                }
            }
        } catch (error) {
            console.error('[StagePlayView] Failed to upload captures:', error);
        } finally {
            // [FIX] 스테이지 4는 소켓 신호 받을 때까지 로딩 유지 (여기서 끄지 않음)
            if (stageNum !== '4') {
                setIsLoading(false);
            }
            // 스테이지 전환은 checkAndGenerateComposite()에서 모든 참가자 완료 후 처리
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

    const handleSceneReady = useCallback(() => {
        // console.log('[StagePlayView] Scene Ready Signal Received');
        // 최소 로딩 시간 보장을 위해 약간의 지연 후 해제 (선택 사항)
        // setTimeout(() => setIsLoading(false), 500); 
        setIsLoading(false);
    }, []);

    return (
        <div className={styles.gameContainer}>
            {/* [NEW] 로딩 화면 오버레이 */}
            {isLoading && (
                <div className={splashStyles.container}>
                    <img
                        src="/assets/ui/leaf.png"
                        alt="Loading..."
                        className={splashStyles.leafLoader}
                    />
                    <div
                        className={splashStyles.loadingText}
                        style={{
                            fontFamily: 'Galmuri9',
                            textAlign: 'center'
                        }}
                    >
                        {loadingMessage}
                    </div>
                </div>
            )}

            <PauseOverlay pausedBy={pausedBy} />
            {/* [FIX] participantInfos 전달하여 원격 비디오 표시 */}
            {/* 상단 영역: 카메라 2개 + 정보 패널 + 카메라 2개 */}
            <div className={styles.topSection}>
                <CameraArea
                    startSlot={0}
                    endSlot={2}
                    participantInfos={participantInfos}
                    isLiveKitConnected={isLiveKitConnected}
                    refreshKey={isEndingMission ? 'ending' : 'playing'} // [FIX] 미션 종료 후 비디오 다시 점유
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
                    isLiveKitConnected={isLiveKitConnected}
                    refreshKey={isEndingMission ? 'ending' : 'playing'} // [FIX] 미션 종료 후 비디오 다시 점유
                />
            </div>

            <div className={`pixel-box ${styles.canvasWrapper}`}>
                <AudioController className={styles.gameAudioController} />
                <PhaserGame
                    startScene={`Stage${stageNum}Scene`}
                    onSendState={onSendState}
                    isSoloMode={isSoloMode}
                    roomId={roomId}
                    onSceneReady={handleSceneReady} // [NEW] 콜백 전달
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


