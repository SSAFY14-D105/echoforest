package com.d105.service;

import com.d105.dto.GameMessageDto;
import com.d105.game.GameRoom;
import com.d105.repository.GameRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Set;
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
    private final ObjectMapper objectMapper;

    // 가상 스레드 실행기 (각 GameRoom의 Tick Loop를 돌리기 위함)
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /**
     * 방 생성 (CREATE)
     */
    public void handleCreate(WebSocketSession session, GameMessageDto message) throws IOException {
        String username = message.getUsername();

        // 1. Redis에 방 생성 (방 코드 자동 생성)
        String roomId = redisRoomService.createRoom(username);

        // 2. GameRoom 생성 (null: 기본 맵 사용)
        GameRoom newRoom = new GameRoom(roomId, objectMapper, null);
        gameRepository.addRoom(roomId, newRoom);

        // 3. 별도의 가상 스레드에서 게임 루프 실행
        executor.submit(newRoom);

        // 4. 플레이어 입장 처리
        joinProcess(session, newRoom, username);

        // 5. 방 생성 완료 알림 (방 코드 전송)
        sendSystemMessage(session, "ROOM_CREATED", roomId);
        log.info("Created GameRoom: {} by host: {}", roomId, username);
    }

    /**
     * 방 참가 (JOIN) - 게임 중 난입 및 재접속 지원
     */
    public void handleJoin(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = message.getRoomId();
        String username = message.getUsername();

        // 1. Redis에서 방 존재 여부 체크 (게임 중 상태도 허용)
        if (!redisRoomService.roomExists(roomId)) {
            sendError(session, "Room not found: " + roomId);
            return;
        }

        // 2. GameRoom 가져오기 (없으면 생성)
        GameRoom room = gameRepository.getRoom(roomId);
        if (room == null) {
            room = new GameRoom(roomId, objectMapper, null);
            gameRepository.addRoom(roomId, room);
            executor.submit(room);
        }

        // 3. 재접속 처리: 같은 닉네임의 기존 플레이어가 있으면 제거
        boolean isReconnect = room.removePlayerByUsername(username);
        if (isReconnect) {
            log.info("Player {} reconnected to room {}", username, roomId);
        }

        // 4. 인원 제한 검사 (재접속이 아닌 경우에만)
        if (!isReconnect && redisRoomService.getPlayerCount(roomId) >= MAX_PLAYERS) {
            sendError(session, "Room is full");
            return;
        }

        // 5. Redis에 플레이어 추가
        redisRoomService.joinRoom(roomId, username);

        // 6. 입장 처리
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
        String roomId = message.getRoomId();
        GameRoom room = gameRepository.getRoom(roomId);

        if (room == null)
            return;

        // Client-Authoritative: 클라이언트가 보낸 좌표를 그대로 사용
        Double x = message.getX();
        Double y = message.getY();
        Double vx = message.getVx();
        Double vy = message.getVy();
        String anim = message.getAnim();

        // [DEBUG] 수신 데이터 확인 (배포 후 제거)
        if (anim != null && !anim.equals("idle")) {
            log.info("[MOVE Debug] session={}, vx={}, vy={}, anim={}",
                    session.getId().substring(0, 8), vx, vy, anim);
        }

        // 좌표가 있으면 PlayerState에 직접 반영 (물리 연산 X)
        if (x != null && y != null) {
            room.updatePlayerPosition(session.getId(), x, y, vx, vy, anim);
        }
    }

    /**
     * 음성 분석 결과 처리 (외부 컨트롤러/서비스에서 호출)
     *
     * @param roomId    방 번호
     * @param username  발화자
     * @param sentiment 감정 (POSITIVE / NEGATIVE)
     */
    public void handleSpeechEvent(String roomId, String username, String sentiment) {
        GameRoom room = gameRepository.getRoom(roomId);
        if (room == null)
            return;

        if ("NEGATIVE".equals(sentiment)) {
            // 랜덤 플레이어 저주
            String victimSessionId = room.getRandomPlayerSessionId();
            if (victimSessionId != null) {
                room.triggerCurseEvent(victimSessionId, false);
            }
        } else if ("POSITIVE".equals(sentiment)) {
            // 발화자 본인의 저주 해제 시도
            String speakerSessionId = room.findSessionIdByUsername(username);
            if (speakerSessionId != null) {
                room.triggerCurseEvent(speakerSessionId, true);
            }
        }
    }

    /**
     * 핑퐁
     */
    public void handlePing(WebSocketSession session, GameMessageDto message) throws IOException {
        GameMessageDto pong = new GameMessageDto();
        pong.setType("PONG");
        pong.setContent(message.getContent());
        sendMessage(session, pong);
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
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
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
}