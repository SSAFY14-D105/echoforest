package com.d105.service;

import com.d105.dto.GameMessageDto;
import com.d105.repository.GameRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameService {

    // 최대 인원 제한 (4명)
    private static final int MAX_PLAYERS = 4;
    private final GameRepository gameRepository;
    private final ObjectMapper objectMapper;
    // 가상 스레드 전용 실행기 (Java 21+)
    // 작업 하나당 가벼운 가상 스레드를 무제한으로 새로 생성하여 처리합니다.
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /**
     * 방 생성 (CREATE)
     * - 클라이언트가 roomId를 보낼 수도 있고, 안 보내면 서버가 랜덤 생성
     */
    public void handleCreate(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = message.getRoomId();

        // 1. 방 번호가 없으면 서버가 랜덤 생성 (6자리 코드)
        if (roomId == null || roomId.trim().isEmpty()) {
            roomId = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        }

        // 2. 이미 존재하는 방인지 체크 (중복 방지)
        if (gameRepository.roomExists(roomId)) {
            sendError(session, "Room ID already exists: " + roomId);
            return;
        }

        // 3. 방 생성 및 입장 처리
        joinProcess(session, roomId, message.getUsername());

        // 4. 생성된 방 번호를 클라이언트에게 알려줌 (친구 초대용 코드)
        sendSystemMessage(session, "ROOM_CREATED", roomId);
    }

    /**
     * 방 참가 (JOIN)
     * - 이제는 방이 존재하지 않으면 에러를 반환합니다.
     */
    public void handleJoin(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = message.getRoomId();

        // 1. 방 존재 여부 체크
        if (!gameRepository.roomExists(roomId)) {
            sendError(session, "Room not found: " + roomId);
            return;
        }

        // 2. 인원 제한 검사
        if (gameRepository.getRoomSize(roomId) >= MAX_PLAYERS) {
            sendError(session, "Room is full");
            return;
        }

        // 3. 입장 처리
        joinProcess(session, roomId, message.getUsername());
    }

    // (내부 공통 로직) 세션 저장 및 로그
    private void joinProcess(WebSocketSession session, String roomId, String username) {
        session.getAttributes().put("roomId", roomId);
        session.getAttributes().put("username", username);

        gameRepository.addSession(roomId, session);
        log.info("User joined room: {}, User: {}", roomId, username);
    }

    /**
     * 이동 처리 (비동기 브로드캐스팅)
     * - 가상 스레드를 통해 좌표 동기화 메시지를 병렬로 전송합니다.
     */
    public void handleMove(WebSocketSession session, GameMessageDto message) throws IOException {
        String roomId = message.getRoomId();

        // 방에 없는 유저가 이동하려 하면 무시
        if (roomId == null || !gameRepository.roomExists(roomId)) return;

        // 비동기 방식으로 변경
        broadcastAsync(roomId, message, session);
    }

    /**
     * 핑퐁 (지연 시간 측정)
     */
    public void handlePing(WebSocketSession session, GameMessageDto message) throws IOException {
        GameMessageDto pong = new GameMessageDto();
        pong.setType("PONG");
        pong.setContent(message.getContent());
        sendMessage(session, pong);
    }

    /**
     * 퇴장 처리 (연결 종료 시 호출)
     */
    public void handleLeave(WebSocketSession session) {
        String roomId = (String) session.getAttributes().get("roomId");
        if (roomId != null) {
            gameRepository.removeSession(roomId, session);
            log.info("User left room: {}", roomId);
        }
    }

    // =========================================================
    // Private Helpers
    // =========================================================

    /**
     * 비동기 브로드캐스팅 (Virtual Threads 활용)
     * - 각 전송 작업을 별도의 가상 스레드에 맡겨 병렬 처리합니다.
     */
    private void broadcastAsync(String roomId, GameMessageDto message, WebSocketSession sender) {
        Set<WebSocketSession> sessions = gameRepository.getSessions(roomId);

        for (WebSocketSession s : sessions) {
            // 본인을 제외한 참가자에게 전송
            if (s.isOpen() && !s.getId().equals(sender.getId())) {
                // 가상 스레드에 전송 작업 위임 (Non-blocking)
                executor.submit(() -> sendMessage(s, message));
            }
        }
    }

    // sendMessage는 기존과 동일하지만, 이제 가상 스레드 내부에서 실행됨
    private void sendMessage(WebSocketSession session, Object message) {
        try {
            // WebSocketSession은 내부적으로 동기화 처리가 되어 있어 스레드 안전하게 전송 가능
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        } catch (IOException e) {
            log.error("Error sending message", e);
        }
    }

    private void sendError(WebSocketSession session, String errorMessage) throws IOException {
        GameMessageDto errorDto = new GameMessageDto();
        errorDto.setType("ERROR");
        errorDto.setContent(errorMessage);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorDto)));
    }

    // 시스템 메시지 전송 (방 생성 알림 등)
    private void sendSystemMessage(WebSocketSession session, String type, String content) throws IOException {
        GameMessageDto msg = new GameMessageDto();
        msg.setType(type);
        msg.setContent(content);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(msg)));
    }
}