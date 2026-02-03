package com.d105.service;

import com.d105.dto.GameMessageDto;
import com.d105.game.GameRoom;
import com.d105.game.PlayerState;
import com.d105.manager.WebSocketSessionManager;
import com.d105.repository.GameRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameService {

    // 최대 인원 제한 (4명)
    private static final int MAX_PLAYERS = 4;

    // 의존성 주입
    private final GameRepository gameRepository;
    private final RedisRoomService redisRoomService;
    private final AiSentimentService aiSentimentService;
    private final ObjectMapper objectMapper;
    private final WebSocketSessionManager sessionManager;

    // 가상 스레드 실행기 (각 GameRoom의 Tick Loop를 돌리기 위함)
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /**
     * 방 생성 (CREATE)
     */
    public void handleCreate(WebSocketSession session, GameMessageDto message) throws IOException {
        String username = message.getUsername().trim();

        // 1. Redis에 방 생성 (방 코드 자동 생성)
        String roomId = redisRoomService.createRoom(username);

        // 2. GameRoom 생성 (null: 기본 맵 사용)
        GameRoom newRoom = new GameRoom(roomId, objectMapper, null);
        gameRepository.addRoom(roomId, newRoom);

        // 4. 플레이어 입장 처리
        joinProcess(session, newRoom, username);

        // 3. 별도의 가상 스레드에서 게임 루프 실행 (플레이어 입장 후 실행해야 종료되지 않음)
        executor.submit(newRoom);

        // 5. 방 생성 완료 알림 (방 코드 전송)
        sendSystemMessage(session, "ROOM_CREATED", roomId);
        log.info("Created GameRoom: {} by host: {}", roomId, username);
    }

    /**
     * 방 참가 (JOIN) - 게임 중 난입 및 재접속 지원
     */
    public void handleJoin(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = message.getRoomId();
        String username = message.getUsername().trim();

        // 1. Redis에서 방 존재 여부 체크 (게임 중 상태도 허용)
        if (!redisRoomService.roomExists(roomId)) {
            sendError(session, "Room not found: " + roomId);
            return;
        }

        // 2. GameRoom 가져오기 (없으면 생성)
        GameRoom room = gameRepository.getRoom(roomId);
        if (room == null) {
            room = new GameRoom(roomId, objectMapper, null);

            // [FIX] Redis에 저장된 진행 상황 복구
            int savedStage = redisRoomService.getCurrentStage(roomId);
            if (savedStage > 0) {
                room.setCurrentMapId(savedStage);
                log.info("Restored Room {} stage to {}", roomId, savedStage);
            }

            gameRepository.addRoom(roomId, room);
            executor.submit(room);
        }

        // 3. 재접속 여부 확인
        // GameRoom에 해당 유저(닉네임)가 이미 있는지 확인
        boolean isReconnect = room.hasPlayer(username);
        if (isReconnect) {
            log.info("Player {} rejoining room {} (Reconnect likely)", username, roomId);
        }

        // 4. 인원 제한 검사 (재접속이 아닌 경우에만)
        // 재접속일 경우 이미 room.players에 포함되어 있으므로 카운트 체크 패스
        if (!isReconnect && redisRoomService.getPlayerCount(roomId) >= MAX_PLAYERS) {
            sendError(session, "Room is full");
            return;
        }

        // 5. Redis에 플레이어 추가
        redisRoomService.joinRoom(roomId, username);

        // 6. 입장 처리 (GameRoom.addPlayer 내에서 재접속/신규 분기 처리)
        joinProcess(session, room, username);

        // 7. 재접속인 경우 별도 메시지 전송
        if (isReconnect) {
            sendSystemMessage(session, "RECONNECTED", roomId);
        }
    }

    /**
     * (공통) 입장 처리 로직
     */
    private void joinProcess(WebSocketSession session, GameRoom room, String username) {
        String roomId = room.getRoomId();

        // 세션 속성 저장
        session.getAttributes().put("roomId", roomId);
        session.getAttributes().put("username", username);

        // GameRoom에 플레이어 등록 (세션 + 상태 통합 관리)
        room.addPlayer(session, username);

        log.info("User joined room: {}, User: {}", roomId, username);

        // 입장 메시지 생성
        GameMessageDto joinMsg = new GameMessageDto();
        joinMsg.setType("JOIN");
        joinMsg.setRoomId(roomId);
        joinMsg.setUsername(username);
        joinMsg.setX(100.0); // 초기 좌표
        joinMsg.setY(100.0);
        joinMsg.setAnim("idle_down");

        room.broadcast(joinMsg, session.getId());
    }

    /**
     * 이동 처리 (Client-Authoritative)
     * 클라이언트가 보낸 좌표를 그대로 신뢰하고 저장
     */
    public void handleMove(WebSocketSession session, GameMessageDto message) {
        try {
            String roomId = (String) session.getAttributes().get("roomId");
            if (roomId == null)
                return;
            // String username = (String) session.getAttributes().get("username");

            GameRoom room = gameRepository.getRoom(roomId);

            if (room == null)
                return;

            // Client-Authoritative: 클라이언트가 보낸 좌표를 그대로 사용
            Double x = message.getX();
            Double y = message.getY();
            Double vx = message.getVx();
            Double vy = message.getVy();
            String anim = message.getAnim();

            // [DEBUG] 수신 데이터 확인
            // anim != null && !anim.equals("idle")) {
            // ("[MOVE Debug] session={}, vx={}, vy={}, anim={}",
            //
            //

            // 좌표가 있으면 PlayerState에 직접 반영 (물리 연산 X)
            if (x != null && y != null) {
                Boolean isDead = message.getIsDead();
                List<String> curses = message.getCurses();
                Boolean isHidden = message.getIsHidden(); // [NEW] 필드 추가

                room.updatePlayerPosition(session.getId(), x, y, vx, vy, anim, isDead, curses, isHidden);
            }
        } catch (Exception e) {
            log.error("[MOVE Error] Failed to process move message: {}", message.toString(), e);
        }
    }

    /**
     * AI 분석 결과 처리 (SpeechController에서 호출)
     */
    public void handleSpeechAnalysis(com.d105.dto.SpeechAnalysisResultDto dto) {
        GameRoom room = gameRepository.getRoom(dto.getRoomId());
        if (room == null)
            return;

        // 스택 증가 (dto.getStackDelta())
        // 만약 예외적으로 0이거나 음수는 무시할지 결정.
        if (dto.getStackDelta() > 0) {
            log.info("Applying Curse Stack Delta: +{} for Room {}", dto.getStackDelta(), dto.getRoomId());
            room.addTeamCurseStack(dto.getStackDelta());
        }
    }

    /**
     * 저주 해제 요청 처리 (클라이언트가 긍정어 감지 후 요청)
     */
    public void handleLiftCurseRequest(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null)
            return;
        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            room.attemptCurseLift(username);
        }
    }

    /**
     * 핑퐁 (Heartbeat) - PlayerState touch() 호출하여 Disconnect 방지
     */
    public void handlePing(WebSocketSession session, GameMessageDto message) throws IOException {
        String username = (String) session.getAttributes().get("username");
        String roomId = (String) session.getAttributes().get("roomId"); // Get roomId from session attributes

        if (roomId != null && username != null) {
            GameRoom room = gameRepository.getRoom(roomId); // Use gameRepository
            if (room != null) {
                // Find the player state by session ID to update its timestamp
                PlayerState player = room.getPlayerBySessionId(session.getId());
                if (player != null) {
                    player.touch(); // Update Last Update Time
                }
            }
        }

        GameMessageDto pong = new GameMessageDto();
        pong.setType("PONG");
        pong.setContent(message.getContent());
        sendMessage(session, pong);
    }

    /**
     * Pause Game
     */
    public void handlePause(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null)
            return;
        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            room.pause(username);
        }
    }

    /**
     * Resume Game
     */
    public void handleResume(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null)
            return;
        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            room.resume(username);
        }
    }

    /**
     * 퇴장 처리
     */
    public void handleLeave(WebSocketSession session) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId != null && username != null) {
            // Redis에서 퇴장 처리 (방장이면 방 폭파)
            boolean roomDestroyed = redisRoomService.leaveRoom(roomId, username);

            // GameRoom에서도 제거
            GameRoom room = gameRepository.getRoom(roomId);
            if (room != null) {
                if (roomDestroyed) {
                    // 방 폭파: 남은 플레이어들에게 알림
                    room.broadcastRoomClosed();
                    gameRepository.removeRoom(roomId);
                    log.info("Room {} destroyed (host left)", roomId);
                } else {
                    room.removePlayer(session);

                    // 방에 사람이 없으면 방 삭제
                    if (room.getPlayerCount() == 0) {
                        redisRoomService.deleteRoom(roomId);
                        gameRepository.removeRoom(roomId);
                        log.info("Room {} destroyed (empty)", roomId);
                    }
                }
            }
            log.info("User {} left room {}", username, roomId);
        }
    }

    /**
     * Ready 상태 변경
     */
    public void handleReady(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null) {
            sendError(session, "Not in a room");
            return;
        }

        // 방장은 Ready 불필요
        String hostId = redisRoomService.getHostId(roomId);
        if (hostId != null && hostId.equals(username)) {
            sendError(session, "Host cannot ready, use start button");
            return;
        }

        // Ready 상태 토글 또는 설정
        boolean isReady = "true".equals(message.getContent());
        redisRoomService.setReady(roomId, username, isReady);

        // Ready 상태 브로드캐스트
        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            GameMessageDto readyMsg = new GameMessageDto();
            readyMsg.setType("READY_STATUS");
            readyMsg.setRoomId(roomId);
            readyMsg.setUsername(username);
            readyMsg.setContent(String.valueOf(isReady));
            room.broadcast(readyMsg, null);
        }

        log.info("User {} ready: {} in room {}", username, isReady, roomId);
    }

    /**
     * 게임 시작 (방장만 가능)
     */
    public void handleStartGame(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null) {
            sendError(session, "Not in a room");
            return;
        }

        // 게임 시작 시도
        boolean started = redisRoomService.startGame(roomId, username);

        if (!started) {
            // 실패 이유 확인
            String hostId = redisRoomService.getHostId(roomId);
            if (!username.equals(hostId)) {
                sendError(session, "Only host can start the game");
            } else if (!redisRoomService.isAllReady(roomId)) {
                sendError(session, "Not all players are ready");
            } else {
                sendError(session, "Cannot start game");
            }
            return;
        }

        // 게임 시작 브로드캐스트
        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            GameMessageDto startMsg = new GameMessageDto();
            startMsg.setType("GAME_START");
            startMsg.setRoomId(roomId);
            startMsg.setContent("1"); // 스테이지 1
            room.broadcast(startMsg, null);
        }

        log.info("Game started in room {} by host {}", roomId, username);
    }

    // =========================================================
    // Private Helpers
    // =========================================================

    private void sendMessage(WebSocketSession session, Object message) throws IOException {
        if (session.isOpen()) {
            synchronized (session) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
            }
        }
    }

    private void sendError(WebSocketSession session, String errorMessage) throws IOException {
        GameMessageDto errorDto = new GameMessageDto();
        errorDto.setType("ERROR");
        errorDto.setContent(errorMessage);
        sendMessage(session, errorDto);
    }

    private void sendSystemMessage(WebSocketSession session, String type, String content) throws IOException {
        GameMessageDto msg = new GameMessageDto();
        msg.setType(type);
        msg.setContent(content);
        sendMessage(session, msg);
    }

    /**
     * 다음 스테이지로 진행 (방장만 가능)
     */
    public void handleNextStage(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null) {
            sendError(session, "Not in a room");
            return;
        }

        // 방장 확인
        String hostId = redisRoomService.getHostId(roomId);
        if (!username.equals(hostId)) {
            sendError(session, "Only host can advance stage");
            return;
        }

        // Redis에서 스테이지 진행
        int nextStage = redisRoomService.nextStage(roomId);

        // 모든 플레이어에게 브로드캐스트
        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            GameMessageDto stageMsg = new GameMessageDto();
            stageMsg.setType("STAGE_CHANGE");
            stageMsg.setRoomId(roomId);
            stageMsg.setContent(String.valueOf(nextStage));
            room.broadcast(stageMsg, null);
        }

        log.info("Room {} advanced to stage {}", roomId, nextStage);
    }

    /**
     * 스테이지 클리어 처리 (개별 플레이어)
     */
    public void handleStageClear(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            room.handleStageClear(username);
        }
    }

    /**
     * 스테이지 클리어 취소 처리 (골 탈출)
     */
    public void handleStageExit(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            room.handleStageExit(username);
        }
    }

    // =========================================================
    // STT 저주 시스템 핸들러
    // =========================================================

    /**
     * 발화 배치 처리 (SPEECH_BATCH)
     * 
     * 1. AI 서버에 배치 분석 요청
     * 2. 스택 증가량 적용
     * 3. 스택 업데이트 브로드캐스트
     * 4. 스택 >= 10 시 저주 발동
     */
    public void handleSpeechBatch(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        if (roomId == null) {
            log.warn("SPEECH_BATCH: 세션에 roomId 없음");
            return;
        }

        GameRoom room = gameRepository.getRoom(roomId);
        if (room == null) {
            log.warn("SPEECH_BATCH: 방을 찾을 수 없음 - {}", roomId);
            return;
        }

        var texts = message.getTexts();
        if (texts == null || texts.isEmpty()) {
            log.debug("SPEECH_BATCH: 빈 텍스트 목록");
            return;
        }

        log.info("🎤 Room {}: SPEECH_BATCH 수신 ({} 개 발화)", roomId, texts.size());

        // 1. AI 서버에 배치 분석 요청
        int delta = aiSentimentService.analyzeBatch(texts);

        if (delta > 0) {
            // [NEW] 저주 횟수(부정적인 말) 증가 - 발화자 기준
            // 세션에서 username 가져오기
            String username = (String) session.getAttributes().get("username");
            if (username != null) {
                redisRoomService.incrementCurse(roomId, username);
                log.info("🤬 User {} incremented Curse Count (delta: {})", username, delta);
            }

            // 2. 스택 증가
            boolean curseTrigger = room.addCurseStack(delta);
            int currentStack = room.getCurseStack();

            // 3. STACK_UPDATED 브로드캐스트
            GameMessageDto stackMsg = new GameMessageDto();
            stackMsg.setType("STACK_UPDATED");
            stackMsg.setRoomId(roomId);
            stackMsg.setStack(currentStack);
            stackMsg.setDelta(delta);
            stackMsg.setReason("negative_word");
            room.broadcast(stackMsg, null);

            // 4. 저주 발동 검사
            if (curseTrigger) {
                triggerCurse(room);
            }
        }
    }

    /**
     * 저주 해제 요청 처리 (CURSE_RELEASE)
     *
     * 긍정어(뽀뽀/사랑해/좋아해)로 저주 해제 시도
     *
     * [로직]
     * 1. 발화자가 저주 걸려있으면 해제 불가 (본인 저주는 풀 수 없음)
     * 2. 저주 큐에서 FIFO로 첫 번째 플레이어 선택
     * 3. 선택된 플레이어의 저주 효과 제거
     * 4. CURSE_RELEASED 브로드캐스트
     */
    public void handleCurseRelease(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null) {
            log.warn("CURSE_RELEASE: 세션 정보 없음");
            return;
        }

        GameRoom room = gameRepository.getRoom(roomId);
        if (room == null) {
            log.warn("CURSE_RELEASE: 방을 찾을 수 없음 - {}", roomId);
            return;
        }

        String word = message.getWord();
        log.info("💖 Room {}: CURSE_RELEASE from {} with word '{}'", roomId, username, word);

        // 1. 발화자가 저주 걸려있는지 확인
        if (room.isPlayerCursed(username)) {
            log.warn("🚫 Room {}: {} 는 저주 상태라 다른 사람의 저주를 풀 수 없음", roomId, username);
            // 클라이언트에서 이미 처리하지만, 안전장치로 서버에서도 체크
            return;
        }

        // 2. 저주 큐가 비어있으면 해제할 대상이 없음
        if (room.isCurseQueueEmpty()) {
            log.info("ℹ️ Room {}: 저주 큐가 비어있음 (해제할 대상 없음)", roomId);
            return;
        }

        // 3. 저주 큐에서 FIFO로 첫 번째 플레이어 선택
        String releasedUsername = room.releaseFromCurseQueue();
        if (releasedUsername == null) {
            log.warn("⚠️ Room {}: 저주 큐에서 플레이어 가져오기 실패", roomId);
            return;
        }

        // 4. 선택된 플레이어의 저주 효과 제거
        String releasedSessionId = room.findSessionIdByUsername(releasedUsername);
        if (releasedSessionId != null) {
            room.triggerCurseEvent(releasedSessionId, true); // isPositive = true
        }

        // 5. 뽀뽀 횟수(긍정적인 말) 증가
        redisRoomService.incrementKiss(roomId, username);
        log.info("😘 User {} incremented Kiss Count", username);

        // 6. CURSE_RELEASED 브로드캐스트
        GameMessageDto releaseMsg = new GameMessageDto();
        releaseMsg.setType("CURSE_RELEASED");
        releaseMsg.setRoomId(roomId);
        releaseMsg.setReleasedPlayerId(releasedUsername); // ✅ 해제된 플레이어 (FIFO)
        releaseMsg.setWord(word);
        room.broadcast(releaseMsg, null);

        log.info("✨ Room {}: {} 의 저주 해제됨 (긍정어: '{}', 발화자: {})", roomId, releasedUsername, word, username);
    }

    /**
     * 저주 발동 처리 (큐 시스템)
     *
     * 1. 랜덤 플레이어 선택
     * 2. 저주 큐에 추가
     * 3. 저주 효과 적용
     * 4. 스택 초기화 (다음 저주를 위해)
     * 5. CURSE_TRIGGERED 브로드캐스트
     */
    private void triggerCurse(GameRoom room) {
        // 랜덤 플레이어 선택
        String cursedUsername = room.getRandomPlayerUsername();
        if (cursedUsername == null) {
            log.warn("저주 발동 실패: 플레이어 없음");
            return;
        }

        // 저주 큐에 추가 (중복 체크는 CurseManager에서 처리)
        room.addToCurseQueue(cursedUsername);

        // 저주 효과 적용
        String sessionId = room.findSessionIdByUsername(cursedUsername);
        if (sessionId != null) {
            room.triggerCurseEvent(sessionId, false); // isPositive = false
        }

        // 스택 초기화 (다음 저주를 위해)
        room.resetCurseStack();

        // CURSE_TRIGGERED 브로드캐스트
        GameMessageDto curseMsg = new GameMessageDto();
        curseMsg.setType("CURSE_TRIGGERED");
        curseMsg.setRoomId(room.getRoomId());
        curseMsg.setCursedPlayerId(cursedUsername);
        curseMsg.setMapId(room.getCurrentMapId());
        room.broadcast(curseMsg, null);

        log.info("💀 Room {}: {} 에게 저주 발동! (Map: {})",
                room.getRoomId(), cursedUsername, room.getCurrentMapId());
    }

    /**
     * 게임 리셋 요청 처리 (협동 실패 시)
     * 플레이어 사망 등으로 인해 게임을 처음 상태로 되돌립니다.
     */
    public void handleGameReset(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        if (roomId == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            // GAME_RESET 브로드캐스트
            GameMessageDto resetMsg = new GameMessageDto();
            resetMsg.setType("GAME_RESET");
            resetMsg.setRoomId(roomId);
            resetMsg.setContent("reset");
            room.broadcast(resetMsg, null);

            log.info("🔄 Room {}: Game Reset triggered by {}", roomId,
                    (String) session.getAttributes().get("username"));
        }
    }

    // =========================================================
    // Map Object Synchronization Handlers (Hybrid Authority)
    // =========================================================

    /**
     * 엘리베이터 등 자동 기믹 동기화 (Host -> Clients)
     * 호스트가 보낸 위치 정보를 다른 클라이언트에게 중계합니다.
     */
    public void handleGimmickUpdate(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        if (roomId == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            // 보낸 사람(Host)을 제외하고 브로드캐스트
            room.broadcast(message, session.getId());
        }
    }

    /**
     * 미는 박스 동기화 (Interactor -> Clients)
     * 박스를 밀고 있는 유저가 보낸 위치 정보를 다른 클라이언트에게 중계합니다.
     */
    public void handleBlockUpdate(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        if (roomId == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            // 보낸 사람(Interactor)을 제외하고 브로드캐스트
            room.broadcast(message, session.getId());
        }
    }

    // =========================================================
    // Ending Mission Handlers (모든 플레이어 골 도달 시)
    // =========================================================

    /**
     * 엔딩 미션 시작 (Host -> Server -> All Clients)
     * 호스트가 모든 플레이어의 골 도달을 감지하면 전체 클라이언트에 브로드캐스트
     */
    public void handleEndingMissionStart(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            // 엔딩 미션 시작 메시지 생성
            GameMessageDto endingStartMsg = new GameMessageDto();
            endingStartMsg.setType("ENDING_MISSION_START");
            endingStartMsg.setRoomId(roomId);
            endingStartMsg.setUsername(username);

            // 모든 클라이언트에게 브로드캐스트 (자기 자신 포함 - 동기화를 위해)
            room.broadcast(endingStartMsg, null);

            log.info("🎉 Room {}: Ending Mission Started by {}", roomId, username);
        }
    }

    /**
     * 엔딩 미션 종료 (Host -> Server -> All Clients)
     * 캡처 완료 후 호스트가 종료 신호를 보내면 전체 클라이언트에 브로드캐스트
     */
    public void handleEndingMissionEnd(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");

        if (roomId == null || username == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            // 개별 플레이어 완료 처리 (GameRoom에서 모든 플레이어 완료 시 전환)
            room.handleEndingMissionComplete(username);
            log.info("📸 Room {}: {} sent ENDING_MISSION_END", roomId, username);
        }
    }

    /**
     * 아이템 획득 처리 (ITEM_COLLECTED)
     * 
     * 1. 해당 아이템이 이미 획득되었는지 확인 (GameRoom 내부 상태 - 추후 구현 필요)
     * 2. 획득되지 않았다면 획득 상태로 변경
     * 3. 같은 방의 모든 플레이어에게 아이템 제거 메시지 전송 (ITEM_REMOVED)
     */
    public void handleItemCollected(WebSocketSession session, GameMessageDto message) {
        String roomId = (String) session.getAttributes().get("roomId");
        String username = (String) session.getAttributes().get("username");
        String itemId = message.getItemId();

        if (roomId == null || username == null || itemId == null)
            return;

        GameRoom room = gameRepository.getRoom(roomId);
        if (room != null) {
            // [TODO] GameRoom에 아이템 상태 관리 로직 추가 (중복 획득 방지)
            // 현재는 클리이언트 신뢰: 요청이 오면 무조건 브로드캐스트

            // ITEM_REMOVED 브로드캐스트
            GameMessageDto removeMsg = new GameMessageDto();
            removeMsg.setType("ITEM_REMOVED");
            removeMsg.setRoomId(roomId);
            removeMsg.setItemId(itemId);
            removeMsg.setContent(itemId); // 호환성

            // 모든 클라이언트에게 전송 (본인 포함 - 확실한 제거 보장)
            room.broadcast(removeMsg, null);

            log.info("🍄 Room {}: Item {} collected by {}", roomId, itemId, username);
        }
    }

    /**
     * 중복 로그인 이벤트 처리
     * UserService에서 로그인 성공 시 발행
     * 
     * [CHANGE] Race Condition 문제로 인해 비활성화 (2025-01-29)
     * - 로그인 API 응답 전후로 WebSocket 연결 시점이 겹치면,
     * 새로 연결된 세션이 이 이벤트에 의해 KICK 당하는 문제가 발생할 수 있음.
     * - GameWebSocketHandler.afterConnectionEstablished 에서의 체크만으로도 충분함.
     */
    @org.springframework.context.event.EventListener
    public void handleDuplicateLogin(com.d105.event.UserLoggedInEvent event) {
        String username = event.getUsername();
        // String newToken = event.getNewToken();

        // 전역 세션 관리자에서 해당 유저의 기존 세션 강제 종료
        // (게임 중이든 로비에 있든 상관없이 처리됨)
        log.info("UserLoggedInEvent received for {}. Checking for active sessions...", username);
        sessionManager.kickSession(username, "DUPLICATE_LOGIN");
    }

}
