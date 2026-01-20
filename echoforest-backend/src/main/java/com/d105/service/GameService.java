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
import java.util.UUID;
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
    private final ObjectMapper objectMapper;

    // 가상 스레드 실행기 (각 GameRoom의 Tick Loop를 돌리기 위함)
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /**
     * 방 생성 (CREATE)
     */
    public void handleCreate(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = message.getRoomId();

        // 1. 방 번호 자동 생성
        if (roomId == null || roomId.trim().isEmpty()) {
            roomId = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        }

        // 2. 중복 체크
        if (gameRepository.roomExists(roomId)) {
            sendError(session, "Room ID already exists: " + roomId);
            return;
        }

        // 3. GameRoom 생성 (null: 기본 맵 사용)
        GameRoom newRoom = new GameRoom(roomId, objectMapper, null);
        gameRepository.addRoom(roomId, newRoom);

        // 4. 별도의 가상 스레드에서 게임 루프 실행
        executor.submit(newRoom);

        // 5. 플레이어 입장 처리
        joinProcess(session, newRoom, message.getUsername());

        // 6. 방 생성 완료 알림
        sendSystemMessage(session, "ROOM_CREATED", roomId);
        log.info("Created GameRoom: {}", roomId);
    }

    /**
     * 방 참가 (JOIN)
     */
    public void handleJoin(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = message.getRoomId();

        // 1. 방 존재 여부 체크
        GameRoom room = gameRepository.getRoom(roomId);
        if (room == null) {
            sendError(session, "Room not found: " + roomId);
            return;
        }

        // 2. 인원 제한 검사
        if (room.getPlayerCount() >= MAX_PLAYERS) {
            sendError(session, "Room is full");
            return;
        }

        // 3. 입장 처리
        joinProcess(session, room, message.getUsername());
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
     * 이동/행동 처리 (MOVE, JUMP 등)
     */
    public void handleMove(WebSocketSession session, GameMessageDto message) {
        String roomId = message.getRoomId();
        GameRoom room = gameRepository.getRoom(roomId);

        if (room == null)
            return;

        // 예시: 클라이언트가 type="MOVE", content="LEFT_DOWN" 으로 보낸다고 가정
        String inputType = message.getContent();
        if (inputType == null)
            inputType = message.getAnim();

        if (inputType != null) {
            room.handleInput(session, inputType);
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
        if (roomId != null) {
            GameRoom room = gameRepository.getRoom(roomId);
            if (room != null) {
                room.removePlayer(session);

                // 방에 사람이 없으면 방 삭제 (게임 루프는 GameRoom 내부에서 자동 종료)
                if (room.getPlayerCount() == 0) {
                    gameRepository.removeRoom(roomId);
                    log.info("Room destroyed: {}", roomId);
                }
            }
            log.info("User left room: {}", roomId);
        }
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
}