package com.d105.game;

import com.d105.dto.GameMessageDto;
import com.d105.game.constant.CurseType;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
public class GameRoom implements Runnable {

    // 60 TPS (약 16ms)
    private static final double TICK_DURATION = 1.0 / 60.0;
    // 브로드캐스트 빈도 (20 TPS - 네트워크 최적화)
    private static final double BROADCAST_INTERVAL = 1.0 / 20.0;
    @Getter
    private final String roomId;
    private final ObjectMapper objectMapper;
    // 타일맵 충돌 처리 매니저
    private final TileCollisionManager collisionManager;
    // 세션 관리 및 플레이어 상태 관리
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, PlayerState> players = new ConcurrentHashMap<>();
    // 입력 큐 (Thread-Safe)
    private final Queue<InputEvent> inputQueue = new ConcurrentLinkedQueue<>();
    private volatile boolean isRunning = true;
    private double broadcastAccumulator = 0;

    /**
     * GameRoom 생성자
     *
     * @param roomId       방 ID
     * @param objectMapper JSON 직렬화용
     * @param mapData      타일맵 데이터 (null이면 기본 맵 사용)
     */
    public GameRoom(String roomId, ObjectMapper objectMapper, Map<String, Object> mapData) {
        this.roomId = roomId;
        this.objectMapper = objectMapper;

        // 맵 데이터가 있으면 TileCollisionManager 생성, 없으면 기본 맵 사용
        if (mapData != null) {
            this.collisionManager = new TileCollisionManager(mapData);
        } else {
            // 기본 맵 데이터 생성 (15x20 맵, 바닥만 있음)
            this.collisionManager = createDefaultCollisionManager();
        }
    }

    /**
     * 기본 충돌 매니저 생성 (테스트/폴백용)
     */
    private TileCollisionManager createDefaultCollisionManager() {
        Map<String, Object> defaultMapData = new java.util.HashMap<>();
        defaultMapData.put("tileSize", 40);

        // 15행 x 20열 맵 생성 (마지막 행만 벽)
        java.util.List<java.util.List<Integer>> tiles = new java.util.ArrayList<>();
        for (int row = 0; row < 15; row++) {
            java.util.List<Integer> rowData = new java.util.ArrayList<>();
            for (int col = 0; col < 20; col++) {
                if (row == 14) {
                    rowData.add(1); // 바닥 (벽)
                } else {
                    rowData.add(0); // 빈 공간
                }
            }
            tiles.add(rowData);
        }
        defaultMapData.put("tiles", tiles);

        return new TileCollisionManager(defaultMapData);
    }

    // --- removePlayer 메소드 구현 ---
    public void removePlayer(WebSocketSession session) {
        String sessionId = session.getId();
        sessions.remove(sessionId);
        players.remove(sessionId);

        // 방에 아무도 없으면 루프 종료 신호
        if (sessions.isEmpty()) {
            this.isRunning = false;
        }
    }

    /**
     * 현재 방의 플레이어 수 반환
     */
    public int getPlayerCount() {
        return players.size();
    }

    public void addPlayer(WebSocketSession session, String username) {
        sessions.put(session.getId(), session);
        // 초기 시작 위치 (100, 100)
        players.put(session.getId(), new PlayerState(username, 100, 100));
    }

    /**
     * 강제 퇴장 (방장이 특정 유저를 내보냄)
     */
    public void kickPlayer(String username) {
        // username으로 세션 찾기
        String targetSessionId = findSessionIdByUsername(username);
        if (targetSessionId == null) {
            return;
        }

        WebSocketSession targetSession = sessions.get(targetSessionId);

        // 퇴장 처리
        sessions.remove(targetSessionId);
        players.remove(targetSessionId);

        // 강퇴된 유저에게 알림
        if (targetSession != null && targetSession.isOpen()) {
            try {
                GameMessageDto kickedMsg = new GameMessageDto();
                kickedMsg.setType("KICKED");
                kickedMsg.setRoomId(roomId);
                kickedMsg.setContent("You have been kicked from the room");
                targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(kickedMsg)));
            } catch (Exception e) {
                log.error("Failed to send kick message to {}", username, e);
            }
        }

        // 다른 플레이어들에게 알림
        GameMessageDto leaveMsg = new GameMessageDto();
        leaveMsg.setType("PLAYER_LEFT");
        leaveMsg.setRoomId(roomId);
        leaveMsg.setUsername(username);
        leaveMsg.setContent("Kicked by host");
        broadcast(leaveMsg, null);

        log.info("Player {} kicked from room {}", username, roomId);
    }

    /**
     * 플레이어 위치 업데이트 (Client-Authoritative)
     * 클라이언트가 보낸 좌표를 그대로 신뢰하고 저장
     */
    public void updatePlayerPosition(String sessionId, Double x, Double y, Double vx, Double vy, String anim) {
        PlayerState player = players.get(sessionId);
        if (player == null)
            return;

        // 마지막 업데이트 시간 갱신 (AFK 감지용)
        player.touch();

        player.setX(x);
        player.setY(y);
        if (vx != null)
            player.setVx(vx);
        if (vy != null)
            player.setVy(vy);
        if (anim != null)
            player.setAnim(anim);
    }

    /**
     * 방 내의 참가자들에게 메시지를 전송하는 기능 (Broadcasting)
     * Service 계층에서 세션 목록을 직접 순회하지 않도록 캡슐화함.
     * * @param message 전송할 메시지 객체
     *
     * @param excludeSessionId 전송에서 제외할 세션 ID (본인 등) - null이면 전원 전송
     */
    public void broadcast(GameMessageDto message, String excludeSessionId) {
        try {
            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(message));
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    // 제외 대상이 아니거나, 제외 대상이 없으면 전송
                    if (excludeSessionId == null || !s.getId().equals(excludeSessionId)) {
                        s.sendMessage(textMsg);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Broadcast Error in Room {}", roomId, e);
        }
    }

    /**
     * 방 폭파 알림 (방장 퇴장 시)
     */
    public void broadcastRoomClosed() {
        try {
            GameMessageDto closeMsg = new GameMessageDto();
            closeMsg.setType("ROOM_CLOSED");
            closeMsg.setRoomId(roomId);
            closeMsg.setContent("Host left the room");

            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(closeMsg));
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) {
                    s.sendMessage(textMsg);
                }
            }

            // 게임 루프 종료
            this.isRunning = false;
        } catch (Exception e) {
            log.error("Broadcast Room Closed Error in Room {}", roomId, e);
        }
    }

    // 입력 처리
    public void handleInput(WebSocketSession session, String inputType) {
        if (!players.containsKey(session.getId()))
            return;
        inputQueue.offer(new InputEvent(session.getId(), inputType));
    }

    // --- 닉네임으로 세션 ID 찾기 ---
    public String findSessionIdByUsername(String username) {
        for (Map.Entry<String, PlayerState> entry : players.entrySet()) {
            if (entry.getValue().getUsername().equals(username)) {
                return entry.getKey(); // Session ID 반환
            }
        }
        return null;
    }

    // --- 랜덤 플레이어 세션 ID 찾기 ---
    public String getRandomPlayerSessionId() {
        if (players.isEmpty())
            return null;

        List<String> keys = new ArrayList<>(players.keySet());
        Random random = new Random();
        return keys.get(random.nextInt(keys.size()));
    }

    // 저주 이벤트 트리거
    public void triggerCurseEvent(String targetSessionId, boolean isPositive) {
        PlayerState p = players.get(targetSessionId);
        if (p == null)
            return;

        if (isPositive) {
            // 긍정적인 말: 모든 저주 해제
            p.clearCurses();
            // 시스템 메시지 전송 (선택 사항)
            // broadcastSystemMessage(p.getUsername() + "님이 긍정의 힘으로 저주를 풀었습니다!");
        } else {
            // 부정적인 말: 랜덤 저주 적용
            CurseType[] curses = CurseType.values();
            CurseType randomCurse = curses[new Random().nextInt(curses.length)];
            p.addCurse(randomCurse);
            // broadcastSystemMessage(p.getUsername() + "님이 부정적인 말로 저주에 걸렸습니다: " +
            // randomCurse);
        }
    }

    @Override
    public void run() {
        log.info("🚀 Game Loop Started (Relay Mode): {}", roomId);

        while (isRunning) {
            try {
                // 1. AFK 체크 및 처리
                checkAfkPlayers();

                // 2. 자동 퇴장 처리 (10초 이상 업데이트 없음)
                checkDisconnectedPlayers();

                // 3. 브로드캐스트 (20 TPS)
                broadcastState();

                // 50ms 대기 (20 TPS)
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        log.info("🏁 Game Loop Ended: {}", roomId);
    }

    /**
     * AFK 플레이어 체크 및 처리 (속도 0, 중력 적용)
     */
    private void checkAfkPlayers() {
        for (PlayerState player : players.values()) {
            player.checkAfkStatus();
        }
    }

    /**
     * 10초 이상 업데이트 없는 플레이어 자동 퇴장
     */
    private void checkDisconnectedPlayers() {
        java.util.List<String> toRemove = new java.util.ArrayList<>();

        for (java.util.Map.Entry<String, PlayerState> entry : players.entrySet()) {
            if (entry.getValue().shouldDisconnect()) {
                toRemove.add(entry.getKey());
                log.info("Player {} auto-disconnected (no update for 10s)", entry.getValue().getUsername());
            }
        }

        for (String sessionId : toRemove) {
            PlayerState removed = players.remove(sessionId);
            WebSocketSession session = sessions.remove(sessionId);

            if (removed != null) {
                // 다른 플레이어들에게 퇴장 알림
                GameMessageDto leaveMsg = new GameMessageDto();
                leaveMsg.setType("PLAYER_LEFT");
                leaveMsg.setRoomId(roomId);
                leaveMsg.setUsername(removed.getUsername());
                leaveMsg.setContent("Auto-disconnected (AFK)");
                broadcast(leaveMsg, null);
            }

            // 세션 닫기
            if (session != null && session.isOpen()) {
                try {
                    session.close();
                } catch (Exception e) {
                    log.error("Failed to close session", e);
                }
            }
        }

        // 방에 아무도 없으면 루프 종료
        if (players.isEmpty()) {
            this.isRunning = false;
        }
    }

    private void processInputs() {
        while (!inputQueue.isEmpty()) {
            InputEvent event = inputQueue.poll();
            PlayerState p = players.get(event.sessionId);
            if (p == null)
                continue;

            switch (event.inputType) {
                case "LEFT_DOWN" -> p.setInputX(-1);
                case "RIGHT_DOWN" -> p.setInputX(1);
                case "LEFT_UP", "RIGHT_UP" -> p.setInputX(0);
                case "JUMP" -> p.setInputJump(true); // 점프 예약
            }
        }
    }

    private void updatePhysics(double dt) {
        for (PlayerState player : players.values()) {
            // 1. 물리 연산 (저주 효과, 이동, 중력 적용)
            player.update(dt);

            // 2. 타일맵 충돌 해결
            collisionManager.resolveCollision(player);
        }
        // TODO: 게임 클리어/실패 조건 체크 로직 추가 가능
    }

    private void broadcastState() {
        try {
            // 전체 플레이어 상태를 리스트로 변환 (username 기준 정렬)
            List<Object> stateList = new ArrayList<>();
            List<PlayerState> sortedPlayers = new ArrayList<>(players.values());
            sortedPlayers.sort((a, b) -> a.getUsername().compareTo(b.getUsername()));

            for (PlayerState p : sortedPlayers) {
                Map<String, Object> pData = new HashMap<>();
                pData.put("serverTick", System.currentTimeMillis());
                pData.put("id", p.getUsername());
                // 소수점 2자리 반올림 (대역폭 절약)
                pData.put("x", Math.round(p.getX() * 100) / 100.0);
                pData.put("y", Math.round(p.getY() * 100) / 100.0);
                pData.put("vx", p.getVx());
                pData.put("vy", p.getVy());
                pData.put("anim", p.getAnim()); // 애니메이션 상태 추가
                // 저주로 크기 변경 시 클라이언트에 전달
                pData.put("width", p.getWidth());
                pData.put("height", p.getHeight());
                pData.put("hp", p.getHp());
                pData.put("isDead", p.isDead());
                pData.put("isAfk", p.isAfk()); // AFK 상태 추가
                pData.put("curses", p.getActiveCurses().keySet());
                stateList.add(pData);
            }

            GameMessageDto msg = new GameMessageDto();
            msg.setType("UPDATE");
            msg.setRoomId(roomId);
            msg.setContent(objectMapper.writeValueAsString(stateList));

            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(msg));

            // 모든 세션에 전송
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen())
                    s.sendMessage(textMsg);
            }
        } catch (Exception e) {
            log.error("Broadcast Error in Room {}", roomId, e);
        }
    }

    // 내부 레코드 (InputEvent)
    private record InputEvent(String sessionId, String inputType) {
    }
}